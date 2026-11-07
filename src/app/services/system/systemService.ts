/**
 * Everything the admin panel shows about the running system. It never returns
 * a secret: API keys are reported as present or missing, never with their value.
 */
import fs from "fs/promises";
import path from "path";
import mongoose from "mongoose";
import { AUDIO_AI, IMAGE_AI, TEXT_AI } from "../../../config/aiConfig";
import { healthCheck } from "../../db/mongoConnection";
import { getTextAIStatus } from "../ai/textAIService";
import { LOG_DIR } from "../../utils/logger";
import packageJson from "../../../../package.json";

const RECENT_ERRORS = 8;
const LOG_TAIL_BYTES = 64 * 1024;
const MAX_ERROR_LENGTH = 240;

const modelName = (model: string) => model.split("/").pop() ?? model;

/** Written by scripts/build-date.js next to main.js; it doesn't exist in development. */
async function readBuildDate(): Promise<string | null> {
  try {
    const file = path.join(__dirname, "../../../build-info.json");
    return JSON.parse(await fs.readFile(file, "utf8")).date ?? null;
  } catch {
    return null;
  }
}

async function readDatabase() {
  const { connection } = mongoose;
  const online = await healthCheck();
  if (!online || !connection.db) return { online, host: connection.host ?? null, name: connection.name ?? null, sizeMb: null, collections: [] };

  const [stats, list] = await Promise.all([connection.db.stats(), connection.db.listCollections().toArray()]);
  const collections = await Promise.all(
    list.map(async (c) => ({ name: c.name, count: await connection.db!.collection(c.name).countDocuments() }))
  );
  return {
    online,
    host: `${connection.host}:${connection.port}`,
    name: connection.name,
    sizeMb: Number((stats.dataSize / 1024 / 1024).toFixed(2)),
    collections: collections.filter((c) => c.count > 0).sort((a, b) => b.count - a.count),
  };
}

/** Last lines of errors.log, newest first. Connection strings lose their credentials. */
async function readRecentErrors() {
  try {
    const handle = await fs.open(path.join(LOG_DIR, "errors.log"), "r");
    try {
      const { size } = await handle.stat();
      const length = Math.min(size, LOG_TAIL_BYTES);
      const buffer = Buffer.alloc(length);
      await handle.read(buffer, 0, length, size - length);

      return buffer
        .toString("utf8")
        .split(/\n-{10,}\n?/)
        .map((entry) => entry.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) ERROR:\n(.*)/))
        .filter((match) => match !== null)
        .slice(-RECENT_ERRORS)
        .reverse()
        .map(([, time, message]) => ({
          time,
          message: message.replace(/:\/\/[^@\s]+@/g, "://***@").slice(0, MAX_ERROR_LENGTH),
        }));
    } finally {
      await handle.close();
    }
  } catch {
    return [];
  }
}

export async function getSystemInfo() {
  const [buildDate, database, errors] = await Promise.all([readBuildDate(), readDatabase(), readRecentErrors()]);
  const memory = process.memoryUsage();

  return {
    server: {
      environment: process.env.NODE_ENV || "development",
      version: packageJson.version,
      buildDate,
      node: process.version,
      uptimeSeconds: Math.round(process.uptime()),
      memoryMb: Math.round(memory.rss / 1024 / 1024),
    },
    database,
    ai: {
      ...getTextAIStatus(),
      text: { provider: TEXT_AI.name, model: modelName(TEXT_AI.models.default), fallback: modelName(TEXT_AI.fallback) },
      image: { provider: IMAGE_AI.name, model: modelName(IMAGE_AI.model) },
      audio: { provider: AUDIO_AI.name, model: modelName(AUDIO_AI.ttsModel) },
    },
    integrations: [
      { name: TEXT_AI.name, purpose: "Texto", configured: Boolean(TEXT_AI.apiKey) },
      { name: "fal.ai", purpose: "Imágenes y audio", configured: Boolean(IMAGE_AI.apiKey) },
      { name: "Cloudinary", purpose: "Guardar imágenes", configured: Boolean(process.env.CLOUDINARY_API_KEY) },
      { name: "PocketBase", purpose: "Guardar audio", configured: Boolean(process.env.POCKETBASE_URL) },
      { name: "Gmail", purpose: "Backups", configured: Boolean(process.env.GMAIL_APP_PASSWORD) },
    ],
    errors,
  };
}
