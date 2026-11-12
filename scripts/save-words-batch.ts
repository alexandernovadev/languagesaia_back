/**
 * Saves pre-generated word entries directly to the dictionary.
 * No AI calls — the data is passed in as JSON.
 * Checks the DB to avoid duplicates.
 *
 *   npx tsx scripts/save-words-batch.ts <json-file>
 *
 * Example:
 *   npx tsx scripts/save-words-batch.ts scripts/data/batch-en.json
 */
import "../src/config/env";
import fs from "fs";
import mongoose from "mongoose";
import Word from "../src/app/db/models/Word";
import { normalizeWordKey } from "../src/app/utils/text/normalizeWordKey";
import { validateWordTypesForLanguage } from "../src/app/data/business/shared/wordTypeCatalog";

interface WordEntry {
  rank?: number;
  word: string;
  language: string;
  definition: string;
  examples?: string[];
  synonyms?: string[];
  type?: string[];
  IPA?: string;
  spanish?: { word?: string; definition?: string };
  conjugations?: any;
}

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Usage: npx tsx scripts/save-words-batch.ts <json-file>");

  const entries: WordEntry[] = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!entries.length) throw new Error("No entries in file");

  const language = entries[0].language;
  console.log(`\n📖 File: ${file}`);
  console.log(`🌍 Language: ${language}`);
  console.log(`📝 Entries: ${entries.length}\n`);

  await mongoose.connect(process.env.MONGO_URL!);
  const wordsCol = mongoose.connection.db!.collection("words");

  // Get existing words from DB
  const existing = await wordsCol
    .find({ language }, { projection: { wordKey: 1 } })
    .toArray();
  const existingKeys = new Set(existing.map((w: any) => w.wordKey));
  console.log(`📚 Existing in DB: ${existingKeys.size} words\n`);

  const stats = { created: 0, skipped: 0, errors: 0 };

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const progress = `[${i + 1}/${entries.length}]`;

    try {
      const key = normalizeWordKey(entry.word);

      // Skip if already exists
      if (existingKeys.has(key)) {
        console.log(`${progress} = "${entry.word}" already exists`);
        stats.skipped++;
        continue;
      }

      // Validate word types
      const check = validateWordTypesForLanguage(entry.type, language);
      const type = check.ok === false
        ? (entry.type || []).filter((t) => !check.invalid.includes(t))
        : entry.type;

      // Ensure minimum lengths
      if (!entry.definition || entry.definition.length < 5) {
        console.log(`${progress} ⚠️  "${entry.word}": definition too short`);
        stats.skipped++;
        continue;
      }
      if (!entry.spanish?.definition || entry.spanish.definition.length < 5) {
        console.log(`${progress} ⚠️  "${entry.word}": spanish definition too short`);
        stats.skipped++;
        continue;
      }

      const wordData = {
        word: entry.word,
        language,
        definition: entry.definition,
        examples: entry.examples || [],
        synonyms: entry.synonyms || [],
        type: type || [],
        IPA: entry.IPA || "",
        spanish: entry.spanish || {},
        conjugations: entry.conjugations || null,
        rank: entry.rank,
        source: "batch-agent",
      };

      await Word.create(wordData);
      existingKeys.add(key);
      stats.created++;
      console.log(`${progress} ✅ "${entry.word}" (${type?.join(", ") || "?"})`);
    } catch (error: any) {
      stats.errors++;
      const msg = error.message?.slice(0, 100) || String(error);
      console.log(`${progress} ❌ "${entry.word}": ${msg}`);
    }
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(`✅ Created: ${stats.created}`);
  console.log(`⏭️  Skipped: ${stats.skipped}`);
  console.log(`❌ Errors:  ${stats.errors}`);
  console.log(`${"=".repeat(50)}\n`);

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
