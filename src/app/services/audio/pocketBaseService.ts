import PocketBase from "pocketbase";
import logger from "../../utils/logger";

const PB_URL = process.env.POCKETBASE_URL || "http://127.0.0.1:8090";
const PB_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL || "";
const PB_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD || "";
const AUDIO_COLLECTION = "lecture_audio";

let pb: PocketBase | null = null;

const getClient = (): PocketBase => {
  if (!pb) pb = new PocketBase(PB_URL);
  return pb;
};

const ensureAuth = async (): Promise<PocketBase> => {
  const client = getClient();
  if (client.authStore.isValid) {
    try {
      await client.collection("_superusers").authRefresh();
      return client;
    } catch {
      // token expirado, re-autenticar
    }
  }
  await client.collection("_superusers").authWithPassword(PB_EMAIL, PB_PASSWORD);
  return client;
};

export const audioFileUrl = (record: any): string => {
  const filename = record?.audio;
  if (!filename) return "";
  return `${PB_URL}/api/files/${AUDIO_COLLECTION}/${record.id}/${filename}`;
};

export const uploadAudioToPocketBase = async (
  audioBuffer: Buffer,
  filename: string,
  meta: { contentId: string; voice: string }
): Promise<{ url: string; recordId: string }> => {
  const client = await ensureAuth();
  const formData = new FormData();
  formData.append("contentId", meta.contentId);
  formData.append("voice", meta.voice);
  formData.append("audio", new Blob([new Uint8Array(audioBuffer)], { type: "audio/mpeg" }), filename);

  const record = await client.collection(AUDIO_COLLECTION).create(formData as any);
  logger.info("Audio subido a PocketBase", { recordId: record.id, filename });
  return { url: audioFileUrl(record), recordId: record.id };
};

export const deleteAudioFromPocketBase = async (recordId: string): Promise<void> => {
  try {
    const client = await ensureAuth();
    await client.collection(AUDIO_COLLECTION).delete(recordId);
    logger.info("Audio eliminado de PocketBase", { recordId });
  } catch (err) {
    logger.error("Error eliminando audio de PocketBase", { recordId, err });
  }
};

// ── Word pictures (same collection as scripts/generate-images.ts) ──

const IMAGE_COLLECTION = "word_images";

export const uploadWordImageToPocketBase = async (webp: Buffer, filename: string, meta: { wordId: string; word: string }): Promise<string> => {
  const client = await ensureAuth();
  const formData = new FormData();
  formData.append("wordId", meta.wordId);
  formData.append("word", meta.word);
  formData.append("image", new Blob([new Uint8Array(webp)], { type: "image/webp" }), filename);
  const record = await client.collection(IMAGE_COLLECTION).create(formData as any);
  logger.info("Imagen subida a PocketBase", { recordId: record.id, filename });
  return `${PB_URL.replace(/\/$/, "")}/api/files/${IMAGE_COLLECTION}/${record.id}/${record.image}`;
};

/** Takes the picture's URL, as saved in word.img. Ignores URLs from anywhere else. */
export const deleteWordImageFromPocketBase = async (url: string): Promise<void> => {
  const recordId = url.match(new RegExp(`/api/files/${IMAGE_COLLECTION}/([^/]+)/`))?.[1];
  if (!recordId) return;
  try {
    const client = await ensureAuth();
    await client.collection(IMAGE_COLLECTION).delete(recordId);
    logger.info("Imagen eliminada de PocketBase", { recordId });
  } catch (err) {
    logger.error("Error eliminando imagen de PocketBase", { recordId, err });
  }
};
