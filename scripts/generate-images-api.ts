/**
 * Generates word pictures through the app's own API (fal.ai + Cloudinary), the
 * same as the image button in the app. Talks only to the API, never to Mongo.
 *
 *   npx tsx scripts/generate-images-api.ts en --missing=50       (next 50 words without a picture, by rank)
 *   npx tsx scripts/generate-images-api.ts en pasta,priest       (these words)
 *   npx tsx scripts/generate-images-api.ts en words.txt          (one word per line)
 *   flags: --force (redo words that already have a picture), --dry (only list them)
 *
 * Logs in as the admin from GLOTA_ENV (default .env.vps.bak: USER_NOVA / PASSWORD_NOVA)
 * against GLOTA_API_URL (default prod). Words go one by one: AI routes allow 20 calls/min.
 */
import dotenv from "dotenv";
import fs from "fs";
import os from "os";
import path from "path";

const API = (process.env.GLOTA_API_URL ?? "https://languagesapi.nova-inns.pro").replace(/\/$/, "");
const ENV_FILE = process.env.GLOTA_ENV ?? ".env.vps.bak";
const GAP_MS = 3500; // stays under 20 calls/min even when fal answers fast

let token = "";
/** One login, reused across runs: the auth route allows only 10 logins per 15 minutes. */
const TOKEN_FILE = path.join(os.homedir(), ".cache/glota-api-token.json");

const call = async (path: string, init: RequestInit = {}) => {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
  });
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path.split("?")[0]} → ${res.status} ${body.error ?? body.message ?? ""} ${body.detail?.hint ?? ""}`.trim());
  return body.data;
};

const login = async () => {
  try {
    const saved = JSON.parse(fs.readFileSync(TOKEN_FILE, "utf8"));
    if (saved.api === API && saved.token) {
      token = saved.token;
      await call("/api/labs/system"); // admin-only: proves the token still works
      return;
    }
  } catch {
    token = "";
  }
  const env = dotenv.config({ path: ENV_FILE, processEnv: {}, quiet: true }).parsed ?? {};
  if (!env.USER_NOVA || !env.PASSWORD_NOVA) throw new Error(`USER_NOVA / PASSWORD_NOVA missing in ${ENV_FILE}`);
  const data = await call("/api/auth/login", { method: "POST", body: JSON.stringify({ username: env.USER_NOVA, password: env.PASSWORD_NOVA }) });
  if (data?.user?.role !== "admin") throw new Error("That user is not an admin");
  token = data.token;
  fs.mkdirSync(path.dirname(TOKEN_FILE), { recursive: true });
  fs.writeFileSync(TOKEN_FILE, JSON.stringify({ api: API, token }), { mode: 0o600 });
};

async function main() {
  const [language, source, ...rest] = process.argv.slice(2);
  const flags = [source, ...rest].filter((arg) => arg?.startsWith("--"));
  const missing = Number(flags.find((flag) => flag.startsWith("--missing="))?.split("=")[1] ?? 0);
  if (!language || (!missing && (!source || source.startsWith("--")))) {
    throw new Error("Usage: npx tsx scripts/generate-images-api.ts <language> <word,word,...|file.txt|--missing=50> [--force] [--dry]");
  }
  const force = flags.includes("--force");
  const dry = flags.includes("--dry");

  await login();
  console.log(`API ${API} (admin OK)`);

  const names: string[] = missing
    ? ((await call(`/api/dictionary?language=${language}&missing=image&sort=rank&limit=${missing}&page=1`))?.data ?? []).map((w: any) => w.word)
    : (fs.existsSync(source) ? fs.readFileSync(source, "utf8") : source).split(/[\n,]/).map((name) => name.trim()).filter(Boolean);

  if (dry) {
    console.log(`${names.length} words: ${names.join(", ")}`);
    return;
  }

  let made = 0;
  for (const [i, name] of names.entries()) {
    const tag = `[${i + 1}/${names.length}] ${name}`;
    try {
      const word = await call(`/api/words/${encodeURIComponent(name)}/word?language=${language}`);
      if (word.img && !force) {
        console.log(`= ${tag}: already has a picture`);
        continue;
      }
      const started = Date.now();
      const result = await call(`/api/words/${word._id}/generate-image`, {
        method: "POST",
        body: JSON.stringify({ word: word.word, imgOld: word.img }),
      });
      made++;
      console.log(`+ ${tag}: ${Math.round((Date.now() - started) / 1000)} s ${result?.img ?? ""}`);
      await new Promise((resolve) => setTimeout(resolve, GAP_MS));
    } catch (error) {
      console.log(`x ${tag}: ${(error as Error).message}`);
    }
  }
  console.log(`\n${made} new pictures of ${names.length} words`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
