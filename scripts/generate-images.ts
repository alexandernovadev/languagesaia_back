/**
 * Generates word pictures on this Mac and stores them in PocketBase, straight
 * on each word. Details and setup in docs/IMAGENES-LOCAL.md.
 *
 *   npx tsx scripts/generate-images.ts en pasta,priest,hallway
 *
 * A word that already has a picture is skipped.
 */
import "../src/config/env";
import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import mongoose from "mongoose";
import PocketBase from "pocketbase";
import sharp from "sharp";
import { wordImagePrompt } from "../src/app/services/ai/prompts/imagePrompts";

const LAB = path.join(os.homedir(), ".cache/glota-images");
const MODEL = "dhairyashil/FLUX.1-schnell-mflux-4bit";
const COLLECTION = "word_images";
const SIZE = 768;
const WEBP_QUALITY = 80;

async function main() {
  const [language, list] = process.argv.slice(2);
  if (!language || !list) throw new Error("Usage: npx tsx scripts/generate-images.ts <language> <word,word,...>");

  const pb = new PocketBase(process.env.POCKETBASE_URL);
  await pb.collection("_superusers").authWithPassword(process.env.POCKETBASE_ADMIN_EMAIL!, process.env.POCKETBASE_ADMIN_PASSWORD!);

  await mongoose.connect(process.env.MONGO_URL!);
  const words = mongoose.connection.db!.collection("words");
  fs.mkdirSync(path.join(LAB, "out"), { recursive: true });

  for (const name of list.split(",")) {
    const word: any = await words.findOne({ language, wordKey: name.toLowerCase() });
    if (!word) {
      console.log(`x ${name}: not in the dictionary`);
      continue;
    }
    if (word.img) {
      console.log(`= ${name}: already has a picture`);
      continue;
    }

    const started = Date.now();
    const prompt = await wordImagePrompt(word);
    const png = path.join(LAB, "out", `${name}.png`);
    const run = spawnSync(
      path.join(LAB, ".venv/bin/mflux-generate"),
      ["--model", MODEL, "--base-model", "schnell", "--steps", "4", "--width", String(SIZE), "--height", String(SIZE), "--prompt", prompt, "--output", png],
      { encoding: "utf8", timeout: 600_000 },
    );
    if (run.status !== 0 || !fs.existsSync(png)) {
      console.log(`x ${name}: ${(run.stderr || run.error?.message || "").slice(-300)}`);
      continue;
    }

    const webp = await sharp(png).webp({ quality: WEBP_QUALITY, effort: 5 }).toBuffer();
    const form = new FormData();
    form.append("wordId", String(word._id));
    form.append("word", word.word);
    form.append("image", new Blob([new Uint8Array(webp)], { type: "image/webp" }), `${name}.webp`);
    const record = await pb.collection(COLLECTION).create(form);

    const url = `${process.env.POCKETBASE_URL!.replace(/\/$/, "")}/api/files/${COLLECTION}/${record.id}/${record.image}`;
    await words.updateOne({ _id: word._id }, { $set: { img: url } });
    console.log(`+ ${name}: ${Math.round((Date.now() - started) / 1000)} s, ${Math.round(webp.length / 1024)} KB`);
  }

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
