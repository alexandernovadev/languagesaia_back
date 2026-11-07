/**
 * Fills the shared dictionary from the entries Claude wrote by hand, in
 * scripts/data/claude-entries-<language>*.json. No AI is called: the entries
 * are already written, this only loads them.
 *
 * - A word already in the dictionary only gets its rank: its fields are kept.
 * - With --redo the entry from the file replaces the one in the dictionary.
 * - Safe to stop and run again: it continues with what's missing.
 * - Words go to the dictionary only, not to anyone's list.
 * - Repeated words across files are loaded once (the first one wins).
 *
 *   pnpm seed:dictionary pt
 *   pnpm seed:dictionary en --redo   rewrite the entries that came from these files
 */
import "../src/config/env";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import Word from "../src/app/db/models/Word";
import { normalizeWordKey } from "../src/app/utils/text/normalizeWordKey";
import { validateWordTypesForLanguage } from "../src/app/data/business/shared/wordTypeCatalog";

const SOURCE = "claude";

interface Entry {
  rank?: number;
  word: string;
  type?: string[];
  IPA?: string;
  definition: string;
  examples?: string[];
  spanish?: { word?: string; definition?: string };
  synonyms?: string[];
  conjugations?: unknown;
}

/** All the entry files of a language, in a stable order (pt, pt-2, pt-10…). */
function entryFiles(language: string): string[] {
  const dir = path.join(__dirname, "data");
  const number = (name: string) => Number(name.match(/-(\d+)\.json$/)?.[1] ?? 1);
  return fs
    .readdirSync(dir)
    .filter((name) => name.startsWith(`claude-entries-${language}`) && name.endsWith(".json"))
    .sort((a, b) => number(a) - number(b))
    .map((name) => path.join(dir, name));
}

async function main() {
  const language = process.argv[2];
  if (!language) throw new Error("Usage: pnpm seed:dictionary <language> [--redo]");
  const redo = process.argv.includes("--redo");

  const files = entryFiles(language);
  if (!files.length) throw new Error(`No claude-entries-${language}*.json files in scripts/data`);

  // First one wins: batches can repeat a word, the earliest file has the better rank
  const entries = new Map<string, Entry>();
  for (const file of files) {
    for (const entry of JSON.parse(fs.readFileSync(file, "utf8")) as Entry[]) {
      if (!entry?.word || !entry.definition) {
        console.log(`? skipped an entry without word/definition in ${path.basename(file)}`);
        continue;
      }
      const key = normalizeWordKey(entry.word);
      if (!entries.has(key)) entries.set(key, entry);
    }
  }

  await mongoose.connect(process.env.MONGO_URL!);
  const existing = await Word.find({ language }, { word: 1, wordKey: 1, source: 1 }).lean();
  const byKey = new Map(existing.map((w) => [w.wordKey as string, w]));

  const stats = { created: 0, ranked: 0, redone: 0, skipped: 0 };

  for (const [key, entry] of entries) {
    const check = validateWordTypesForLanguage(entry.type, language);
    const type = check.ok === false ? (entry.type as string[]).filter((t) => !check.invalid.includes(t)) : entry.type;
    const fields = {
      word: entry.word,
      language,
      definition: entry.definition,
      examples: entry.examples ?? [],
      type,
      IPA: entry.IPA,
      spanish: entry.spanish,
      synonyms: entry.synonyms ?? [],
      conjugations: entry.conjugations ?? null,
      rank: entry.rank,
      source: SOURCE,
    };

    const known = byKey.get(key);
    if (known && redo && known.source === SOURCE) {
      await Word.replaceOne({ _id: known._id }, { ...fields, wordKey: key });
      stats.redone++;
    } else if (known) {
      if (entry.rank != null) await Word.updateOne({ _id: known._id }, { rank: entry.rank }, { timestamps: false });
      stats.ranked++;
    } else {
      try {
        await Word.create({ ...fields, wordKey: key });
        stats.created++;
      } catch (error: any) {
        // a word added by hand while the script ran, or a schema rejection: report and continue
        console.log(`x ${entry.word}: ${String(error.message).slice(0, 120)}`);
        stats.skipped++;
      }
    }
  }

  console.log(`${files.length} files · ${entries.size} entries · ${JSON.stringify(stats)}`);
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
