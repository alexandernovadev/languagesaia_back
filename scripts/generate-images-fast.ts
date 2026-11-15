/**
 * Fast word pictures: runs the whole pipeline on this Mac, in parallel, and
 * only touches the prod API to list words and save the links.
 *
 *   npx tsx scripts/generate-images-fast.ts pt --missing=500
 *   npx tsx scripts/generate-images-fast.ts en --missing=500 --parallel=10   (fal allows 10 at once)
 *
 * Per word: scene (DeepSeek) → FLUX on fal → WebP 768/q80 → PocketBase word_images.
 * Every SAVE_EVERY pictures the links go to prod in one batch update, so a crash
 * loses at most one batch and a rerun picks up whatever is still missing.
 *
 * Needs in .env: FAL_KEY, DEEPSEEK_API_KEY, POCKETBASE_URL / _ADMIN_EMAIL / _ADMIN_PASSWORD.
 * Prod login: same token cache and .env.vps.bak as generate-images-api.ts.
 */
import "../src/config/env";
import dotenv from "dotenv";
import fs from "fs";
import os from "os";
import path from "path";
import sharp from "sharp";
import { generateImage } from "../src/app/services/ai/imageAIService";
import { wordImagePrompt } from "../src/app/services/ai/prompts/imagePrompts";
import { uploadWordImageToPocketBase } from "../src/app/services/audio/pocketBaseService";

const API = (process.env.GLOTA_API_URL ?? "https://languagesapi.nova-inns.pro").replace(/\/$/, "");
const ENV_FILE = process.env.GLOTA_ENV ?? ".env.vps.bak";
const TOKEN_FILE = path.join(os.homedir(), ".cache/glota-api-token.json");
const SIZE = 768;
const QUALITY = 80;
const SAVE_EVERY = 50;
const BASIC_RANK = 300;

let token = "";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Prod API call. Waits on 429 instead of failing. */
const call = async (route: string, init: RequestInit = {}, tries = 20): Promise<any> => {
  const res = await fetch(`${API}${route}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
  });
  if (res.status === 429 && tries > 0) {
    console.log("… prod 429, waiting 60 s");
    await sleep(60_000);
    return call(route, init, tries - 1);
  }
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${route.split("?")[0]} → ${res.status} ${body.error ?? body.message ?? ""}`.trim());
  return body.data;
};

/** One login, reused across runs: prod allows only 10 logins per 15 minutes. */
const login = async () => {
  try {
    const saved = JSON.parse(fs.readFileSync(TOKEN_FILE, "utf8"));
    if (saved.api === API && saved.token) {
      token = saved.token;
      await call("/api/labs/system");
      return;
    }
  } catch {
    token = "";
  }
  const env = dotenv.parse(fs.readFileSync(ENV_FILE));
  if (!env.USER_NOVA || !env.PASSWORD_NOVA) throw new Error(`USER_NOVA / PASSWORD_NOVA missing in ${ENV_FILE}`);
  const data = await call("/api/auth/login", { method: "POST", body: JSON.stringify({ username: env.USER_NOVA, password: env.PASSWORD_NOVA }) });
  token = data?.token ?? data?.accessToken;
  if (!token) throw new Error("Login gave no token");
  fs.mkdirSync(path.dirname(TOKEN_FILE), { recursive: true });
  fs.writeFileSync(TOKEN_FILE, JSON.stringify({ api: API, token }));
};

/** The next `count` words without a picture, by rank. The API gives at most 100 per page. */
const missingWords = async (language: string, count: number) => {
  const words: any[] = [];
  for (let page = 1; words.length < count; page++) {
    const list = (await call(`/api/dictionary?language=${language}&missing=image&sort=rank&limit=100&page=${page}`))?.data ?? [];
    words.push(...list);
    if (list.length < 100) break;
  }
  return words.slice(0, count);
};

const GRAMMAR = ["auxiliary verb", "modal verb", "pronoun", "preposition", "conjunction", "determiner", "interjection", "particle"];

/** fal sometimes says "too many requests" or drops a call: a few retries with a growing pause. */
const withRetry = async <T>(work: () => Promise<T>, tries = 4): Promise<T> => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await work();
    } catch (error) {
      if (attempt >= tries) throw error;
      await sleep(attempt * 5_000);
    }
  }
};

async function main() {
  const [language, ...flags] = process.argv.slice(2);
  const missing = Number(flags.find((flag) => flag.startsWith("--missing="))?.split("=")[1] ?? 0);
  const parallel = Number(flags.find((flag) => flag.startsWith("--parallel="))?.split("=")[1] ?? 10);
  if (!language || !missing) throw new Error("Usage: npx tsx scripts/generate-images-fast.ts <language> --missing=500 [--parallel=10] [--dry]");

  await login();
  const words = await missingWords(language, missing);
  console.log(`API ${API} · ${words.length} ${language} words · ${parallel} at a time`);
  if (flags.includes("--dry")) {
    console.log(words.map((w) => w.word).join(", "));
    return;
  }

  const started = Date.now();
  let pending: Array<{ wordId: string; img: string }> = [];
  let made = 0;
  let saved = 0;
  const failed: string[] = [];

  const flush = async () => {
    if (!pending.length) return;
    const batch = pending;
    pending = [];
    // a deploy can restart prod mid-run: keep trying for a few minutes so no link is lost
    const result = await withRetry(() => call("/api/labs/words/batch-update-images", { method: "POST", body: JSON.stringify({ updates: batch }) }), 8);
    saved += result?.updated ?? 0;
    console.log(`  ✓ saved ${result?.updated}/${batch.length} links in prod (${saved} total)`);
    if (result?.failed) failed.push(`${result.failed} links not saved`);
  };

  let next = 0;
  const worker = async () => {
    while (next < words.length) {
      const i = next++;
      let word = words[i];
      const tag = `[${i + 1}/${words.length}] ${word.word}`;
      try {
        // basic words use their example sentence, which the list doesn't bring
        if ((word.rank != null && word.rank <= BASIC_RANK) || word.type?.some((t: string) => GRAMMAR.includes(t))) {
          word = { ...word, ...(await call(`/api/dictionary/${word._id}`)) };
        }
        const t0 = Date.now();
        const prompt = await wordImagePrompt(word);
        const { b64_json } = await withRetry(() => generateImage(prompt));
        const webp = await sharp(Buffer.from(b64_json, "base64")).resize(SIZE, SIZE).webp({ quality: QUALITY, effort: 5 }).toBuffer();
        const img = await withRetry(() => uploadWordImageToPocketBase(webp, `${word.wordKey || word.word}.webp`, { wordId: String(word._id), word: word.word }));
        pending.push({ wordId: String(word._id), img });
        made++;
        console.log(`+ ${tag}: ${Math.round((Date.now() - t0) / 1000)} s`);
        if (pending.length >= SAVE_EVERY) await flush();
      } catch (error) {
        failed.push(word.word);
        console.log(`x ${tag}: ${error instanceof Error ? error.message : error}`);
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(parallel, words.length) }, worker));
  await flush();

  const minutes = (Date.now() - started) / 60_000;
  console.log(`\n${made} new pictures, ${saved} saved in prod, ${failed.length} failed · ${minutes.toFixed(1)} min (${Math.round(made / minutes)}/min)`);
  if (failed.length) console.log(`failed: ${failed.join(", ")}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
