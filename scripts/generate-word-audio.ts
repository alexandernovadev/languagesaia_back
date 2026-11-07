/**
 * Generates the pronunciation of every word without audio on this Mac and
 * stores it in PocketBase. Details and setup in docs/AUDIO-LOCAL.md.
 *
 *   npx tsx scripts/generate-word-audio.ts en              all the words missing audio
 *   npx tsx scripts/generate-word-audio.ts en --limit=100  the 100 most common
 *   npx tsx scripts/generate-word-audio.ts en --dry        only the files, nothing is saved
 *
 * It can be stopped and run again: it goes on with what's missing. A word that
 * failed the check is saved anyway and listed in review-<language>.jsonl.
 */
import "../src/config/env";
import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import readline from "readline";
import mongoose from "mongoose";
import { uploadAudioToPocketBase } from "../src/app/services/audio/pocketBaseService";

const LAB = path.join(os.homedir(), ".cache/glota-audio");
const VOICE = "Matilda (Qwen3-TTS)";

async function main() {
  const [language, ...flags] = process.argv.slice(2);
  if (!language) throw new Error("Usage: npx tsx scripts/generate-word-audio.ts <language> [--limit=100] [--dry]");
  const dry = flags.includes("--dry");
  const limit = Number(flags.find((flag) => flag.startsWith("--limit="))?.split("=")[1] ?? 0);

  await mongoose.connect(process.env.MONGO_URL!);
  const words = mongoose.connection.db!.collection("words");
  const missing = await words
    .find({ language, audio: { $in: [null, ""] } }, { projection: { word: 1 } })
    .sort({ rank: 1 })
    .limit(limit)
    .toArray();
  console.log(`${missing.length} words to say in ${language}`);

  const out = path.join(LAB, "out", language);
  fs.mkdirSync(out, { recursive: true });
  const list = path.join(LAB, `list-${language}.json`);
  fs.writeFileSync(list, JSON.stringify(missing.map((word) => ({ id: String(word._id), word: word.word }))));

  const voice = spawn(path.join(LAB, ".venv/bin/python"), [path.join(__dirname, "word-audio.py"), language, list, out], { stdio: ["ignore", "pipe", "inherit"] });
  const review = path.join(LAB, `review-${language}.jsonl`);
  let done = 0;

  for await (const line of readline.createInterface({ input: voice.stdout })) {
    if (!line.startsWith("{")) continue;
    const said = JSON.parse(line);
    done += 1;
    if (said.review) fs.appendFileSync(review, `${line}\n`);
    console.log(`${said.review ? "?" : "+"} ${done}/${missing.length} ${said.word}: ${said.seconds} s, heard "${said.heard}"`);
    if (dry) continue;

    try {
      const { url } = await uploadAudioToPocketBase(fs.readFileSync(said.file), `${said.id}.mp3`, { contentId: said.id, voice: VOICE });
      await words.updateOne({ _id: new mongoose.Types.ObjectId(said.id) }, { $set: { audio: url } });
      fs.rmSync(said.file);
    } catch (error) {
      console.log(`x ${said.word}: ${(error as Error).message}`); // it stays without audio, so the next run takes it
    }
  }

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
