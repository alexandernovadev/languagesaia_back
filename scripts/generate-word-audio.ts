/**
 * Generates the pronunciation of every word without audio on this Mac and
 * stores it in PocketBase. Details and setup in docs/AUDIO-LOCAL.md.
 *
 *   npx tsx scripts/generate-word-audio.ts en              all the words missing audio
 *   npx tsx scripts/generate-word-audio.ts en --limit=100  the 100 most common
 *   npx tsx scripts/generate-word-audio.ts en --dry        only the files, nothing is saved
 *   npx tsx scripts/generate-word-audio.ts en --prod       prod's words: listed and saved through the API
 *   npx tsx scripts/generate-word-audio.ts en --prod --words="deadbolt,flip through"   only these
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
const API = (process.env.GLOTA_API_URL ?? "https://languagesapi.nova-inns.pro").replace(/\/$/, "");
const TOKEN_FILE = path.join(os.homedir(), ".cache/glota-api-token.json");

/** Prod, with the admin token the image scripts keep (generate-images-api.ts logs in and saves it). */
const prodCall = async (route: string, init: RequestInit = {}) => {
  const { token } = JSON.parse(fs.readFileSync(TOKEN_FILE, "utf8"));
  const res = await fetch(`${API}${route}`, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${route.split("?")[0]} → ${res.status} ${body.error ?? ""}`);
  return body.data;
};

const prodMissing = async (language: string, limit: number) => {
  const words: { _id: string; word: string }[] = [];
  for (let page = 1; !limit || words.length < limit; page++) {
    const list = (await prodCall(`/api/dictionary?language=${language}&missing=audio&sort=rank&limit=100&page=${page}`))?.data ?? [];
    words.push(...list);
    if (list.length < 100) break;
  }
  return limit ? words.slice(0, limit) : words;
};

async function main() {
  const [language, ...flags] = process.argv.slice(2);
  if (!language) throw new Error("Usage: npx tsx scripts/generate-word-audio.ts <language> [--limit=100] [--dry]");
  const dry = flags.includes("--dry");
  const limit = Number(flags.find((flag) => flag.startsWith("--limit="))?.split("=")[1] ?? 0);

  const prod = flags.includes("--prod");
  const words = prod ? null : (await mongoose.connect(process.env.MONGO_URL!), mongoose.connection.db!.collection("words"));
  const only = flags.find((flag) => flag.startsWith("--words="))?.slice(8).split(",").map((w) => w.trim().toLowerCase()).filter(Boolean);
  const missing = prod
    ? (await prodMissing(language, only ? 0 : limit)).filter((w) => !only || only.includes(w.word.toLowerCase()))
    : await words!.find({ language, audio: { $in: [null, ""] } }, { projection: { word: 1 } }).sort({ rank: 1 }).limit(limit).toArray();
  if (prod) console.log(`API ${API}`);
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
      if (prod) await prodCall("/api/labs/words/batch-update-audio", { method: "POST", body: JSON.stringify({ updates: [{ wordId: said.id, audio: url }] }) });
      else await words!.updateOne({ _id: new mongoose.Types.ObjectId(said.id) }, { $set: { audio: url } });
      fs.rmSync(said.file);
    } catch (error) {
      console.log(`x ${said.word}: ${(error as Error).message}`); // it stays without audio, so the next run takes it
    }
  }

  if (!prod) await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
