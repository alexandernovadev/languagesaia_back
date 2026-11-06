/**
 * Turns a raw frequency list ("word count" per line) into the list of common
 * words that seed-dictionary uses: inflected forms become their base form
 * ("foi" → "ser") and names, other languages and profanity are dropped. The
 * order of the source is kept, so a word's position is its real frequency.
 *
 *   npx tsx scripts/build-word-list.ts pt <file> 1000
 *
 * Runs on the local Gemma server, see docs/DICCIONARIO-ETL.md.
 */
import "../src/config/env";
import fs from "fs";
import path from "path";
import OpenAI from "openai";
import { getLangLabel, getVariantRules } from "../src/app/services/ai/prompts/langUtils";

const FORMS_PER_WORD = 3.5; // how many raw forms it takes to get one base word
const BATCH = 60;
const WORKERS = 2;
const LOCAL_MODEL = "mlx-community/gemma-4-26b-a4b-it-4bit";

const client = new OpenAI({ apiKey: "local", baseURL: "http://127.0.0.1:8088/v1", maxRetries: 2 });

async function toBaseForms(forms: string[], language: string): Promise<Record<string, string | null>> {
  const label = getLangLabel(language);
  const res: any = await client.chat.completions.create(
    {
      model: LOCAL_MODEL,
      temperature: 0,
      max_tokens: 1600,
      messages: [
        {
          role: "user",
          content: `These ${label} forms come from a frequency list of film subtitles.
${getVariantRules(language)}
For each one give its dictionary form, with correct accents: verbs in the infinitive ("foi" → "ser", "went" → "go"), nouns in singular, adjectives in their base form ("better" → "good"), contractions to their main word ("do" → "de", "don't" → "do").
Use a single dash for proper names, words of other languages, profanity, abbreviations and fragments that aren't words.

FORMS: ${forms.join(" ")}

Answer one form per line, nothing else, like this:
went -> go
houses -> house
john -> -`,
        },
      ],
    } as any,
    { timeout: 120_000 },
  );
  const lemmas: Record<string, string | null> = {};
  for (const line of (res.choices[0].message.content ?? "").split("\n")) {
    const [form, base] = line.split("->").map((part: string) => part.trim());
    if (form && base) lemmas[form] = base === "-" ? null : base;
  }
  return lemmas;
}

async function main() {
  const [language, file, size] = process.argv.slice(2);
  const wanted = Number(size);
  const forms = fs
    .readFileSync(file, "utf8")
    .split("\n")
    .map((line) => line.split(" ")[0])
    .filter((form) => form && !form.includes("'"))
    .slice(0, Math.ceil(wanted * FORMS_PER_WORD));

  const batches: string[][] = [];
  for (let i = 0; i < forms.length; i += BATCH) batches.push(forms.slice(i, i + BATCH));

  const results: Array<Record<string, string | null>> = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: WORKERS }, async () => {
      while (next < batches.length) {
        const n = next++;
        results[n] = await toBaseForms(batches[n], language).catch((error) => {
          console.log(`batch ${n + 1} failed: ${error.message}`);
          return {};
        });
        console.log(`batch ${n + 1}/${batches.length}: ${Object.keys(results[n]).length} forms`);
      }
    }),
  );

  const merged = Object.assign({}, ...results);
  const words: string[] = [];
  const seen = new Set<string>();
  for (const form of forms) {
    const base = merged[form];
    if (typeof base !== "string" || !base.trim()) continue;
    const word = base.trim().toLowerCase();
    if (seen.has(word) || word.includes(" ")) continue;
    seen.add(word);
    words.push(word);
  }

  const list = words.slice(0, wanted);
  fs.writeFileSync(path.join(__dirname, `data/common-words-${language}.json`), JSON.stringify(list, null, 0) + "\n");
  console.log(`${forms.length} forms → ${words.length} base words → saved ${list.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
