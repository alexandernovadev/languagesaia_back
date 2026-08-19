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
  meta: { lectureId: string; voice: string }
): Promise<{ url: string; recordId: string }> => {
  const client = await ensureAuth();
  const formData = new FormData();
  formData.append("lectureId", meta.lectureId);
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
