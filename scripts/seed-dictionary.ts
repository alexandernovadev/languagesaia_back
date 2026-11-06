/**
 * Fills the shared dictionary from a list of common words. The AI writes each
 * entry and reviews it in a separate call. By default that's DeepSeek; with
 * --writer=gemma a local Gemma does both, without using any API (start the
 * server first, see docs/DICCIONARIO-ETL.md).
 *
 * - A word already in the dictionary only gets its rank: nothing is generated.
 * - Everything paid for is kept: an entry the review rejects is saved with its
 *   problems in `reviewNotes`, to fix it later.
 * - Safe to stop and run again: it continues with what's missing.
 * - Words go to the dictionary only, not to anyone's list.
 * - A word that differs only by an accent is skipped and reported: "esta" and
 *   "está" can be different words, so a person decides.
 *
 *   pnpm seed:dictionary pt
 *   pnpm seed:dictionary pt --writer=gemma    the local model writes
 *   pnpm seed:dictionary pt --redo=<source>   rewrites the entries of that source
 */
import "../src/config/env";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import OpenAI from "openai";
import { TEXT_AI } from "../src/config/aiConfig";
import Word from "../src/app/db/models/Word";
import { normalizeWordKey } from "../src/app/utils/text/normalizeWordKey";
import { validateWordTypesForLanguage } from "../src/app/data/business/shared/wordTypeCatalog";
import { createDictionaryEntryPrompt, createDictionaryReviewPrompt } from "../src/app/services/ai/prompts/words/dictionaryPrompts";

const WORKERS = 2;
const TIMEOUT_MS = 90_000;
const RETRIES = 5;
/** After this many failures in a row something is wrong: better stop than burn through the list. */
const MAX_FAILURES_IN_A_ROW = 5;
const LOCAL_URL = "http://127.0.0.1:8088/v1";
const LOCAL_MODEL = "mlx-community/gemma-4-26b-a4b-it-4bit";

const client = new OpenAI({ apiKey: TEXT_AI.apiKey, baseURL: TEXT_AI.baseURL, maxRetries: 0 });
const local = new OpenAI({ apiKey: "local", baseURL: LOCAL_URL, maxRetries: 0 });
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The local model can wrap its JSON in a code block. */
async function askLocal(prompt: string, attempt = 0): Promise<{ json: any; tokens: number }> {
  const res: any = await local.chat.completions.create(
    { model: LOCAL_MODEL, messages: [{ role: "user", content: prompt }], temperature: 0.1, max_tokens: 1600 } as any,
    { timeout: 300_000 },
  );
  const text: string = res.choices[0].message.content ?? "";
  try {
    return { json: JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)), tokens: res.usage?.completion_tokens ?? 0 };
  } catch (error) {
    if (attempt >= 1) throw error;
    return askLocal(prompt, attempt + 1);
  }
}

/** Fireworks answers 429 under load: waits a little longer each time. */
async function ask(prompt: string, attempt = 0): Promise<{ json: any; tokens: number }> {
  try {
    const res: any = await client.chat.completions.create(
      {
        model: TEXT_AI.models.default,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        response_format: { type: "json_object" },
        reasoning_effort: "low",
      } as any,
      { timeout: TIMEOUT_MS },
    );
    return { json: JSON.parse(res.choices[0].message.content), tokens: res.usage?.completion_tokens ?? 0 };
  } catch (error: any) {
    if (attempt >= RETRIES || (error.status && error.status !== 429 && error.status < 500)) throw error;
    await wait(2000 * 2 ** attempt);
    return ask(prompt, attempt + 1);
  }
}

const withoutAccents = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "");

async function main() {
  const language = process.argv[2];
  if (!language) throw new Error("Usage: pnpm seed:dictionary <language> [--redo=<source>]");
  const redo = process.argv.find((a) => a.startsWith("--redo="))?.split("=")[1];
  const source = process.argv.find((a) => a.startsWith("--writer="))?.split("=")[1] ?? "deepseek";
  const write = source === "gemma" ? askLocal : ask;
  const list: string[] = JSON.parse(fs.readFileSync(path.join(__dirname, `data/common-words-${language}.json`), "utf8"));

  await mongoose.connect(process.env.MONGO_URL!);
  const existing = await Word.find({ language }, { word: 1, wordKey: 1, source: 1 }).lean();
  const byKey = new Map(existing.map((w) => [w.wordKey as string, w]));
  const byBareKey = new Map(existing.map((w) => [withoutAccents(w.wordKey as string), w]));

  const stats = { created: 0, flagged: 0, ranked: 0, failed: 0, similar: 0 };
  const totals = { secs: 0, tokens: 0 };
  const pending: Array<{ word: string; rank: number; replaces?: unknown }> = [];

  for (const [index, word] of list.entries()) {
    const rank = index + 1;
    const key = normalizeWordKey(word);
    const known = byKey.get(key);
    if (known && redo && known.source === redo) {
      pending.push({ word, rank, replaces: known._id });
      continue;
    }
    if (known) {
      await Word.updateOne({ _id: known._id }, { rank }, { timestamps: false });
      stats.ranked++;
      continue;
    }
    const similar = byBareKey.get(withoutAccents(key));
    if (similar) {
      // same word but for an accent: a person has to decide, the AI isn't paid for it
      console.log(`? "${word}" looks like "${similar.word}": skipped`);
      stats.similar++;
      continue;
    }
    pending.push({ word, rank });
  }

  console.log(`${list.length} words · ${pending.length} to generate · ${stats.ranked} already there`);
  const started = Date.now();
  let next = 0;
  let failuresInARow = 0;

  await Promise.all(
    Array.from({ length: WORKERS }, async () => {
      while (next < pending.length && failuresInARow < MAX_FAILURES_IN_A_ROW) {
        const { word, rank, replaces } = pending[next++];
        const callStarted = Date.now();
        try {
          const { json: entry, tokens } = await write(createDictionaryEntryPrompt(word, language));
          totals.secs += (Date.now() - callStarted) / 1000;
          totals.tokens += tokens;

          let reviewNotes: string[] | undefined;
          try {
            const { json: review } = await write(createDictionaryReviewPrompt({ word, ...entry }, language));
            if (!review.ok) reviewNotes = (review.problems ?? []).map(String);
          } catch (error: any) {
            reviewNotes = [`Not reviewed: ${error.message}`.slice(0, 200)];
          }

          const check = validateWordTypesForLanguage(entry.type, language);
          const type = check.ok === false ? (entry.type as string[]).filter((t) => !check.invalid.includes(t)) : entry.type;
          const fields = { ...entry, type, word, language, rank, source };

          if (replaces) await Word.replaceOne({ _id: replaces }, { ...fields, wordKey: normalizeWordKey(word), ...(reviewNotes && { reviewNotes }) });
          else await Word.create({ ...fields, reviewNotes });
          stats.created++;
          failuresInARow = 0;
          if (reviewNotes) stats.flagged++;
          console.log(`${reviewNotes ? "!" : "+"} ${word}${reviewNotes ? ` — ${reviewNotes.join(" | ").slice(0, 170)}` : ""}`);
        } catch (error: any) {
          stats.failed++;
          failuresInARow++;
          console.log(`x ${word}: ${String(error.message).slice(0, 120)}`);
        }
      }
    }),
  );

  if (failuresInARow >= MAX_FAILURES_IN_A_ROW) console.log(`Stopped after ${failuresInARow} failures in a row. Check the server and run it again.`);
  console.log(`\nDone in ${Math.round((Date.now() - started) / 1000)} s: ${JSON.stringify(stats)}`);
  if (stats.created) console.log(`${(totals.secs / stats.created).toFixed(1)} s and ${Math.round(totals.tokens / stats.created)} tokens per entry`);
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
