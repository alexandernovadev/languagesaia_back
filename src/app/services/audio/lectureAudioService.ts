import OpenAI from "openai";
import { execFile } from "child_process";
import { promisify } from "util";
import ffmpegPath from "ffmpeg-static";
import { AI_CONFIG } from "../../../config/aiConfig";
import Lecture from "../../db/models/Lecture";
import { uploadAudioToPocketBase, deleteAudioFromPocketBase } from "./pocketBaseService";
import logger from "../../utils/logger";

const execFileAsync = promisify(execFile);

const TTS_MODEL = process.env.TTS_MODEL || "gpt-4o-mini-tts";
const TTS_VOICE = process.env.TTS_VOICE || "nova";
const TTS_INSTRUCTIONS =
  process.env.TTS_INSTRUCTIONS ||
  "Narrate like a storyteller reading a fairy tale: warm, expressive, calm and clear, with gentle emphasis on key moments.";
const MAX_CHARS = 4096;

const getClient = () =>
  new OpenAI({
    apiKey: AI_CONFIG.providers.openai.apiKey,
    baseURL: AI_CONFIG.providers.openai.baseURL,
  });

const stripMarkdown = (text: string): string => {
  if (!text) return "";
  return text
    .replace(/^#{1,6}\s+(.+)$/gm, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/!\[([^\]]*)\]\([^\)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^[\s]*[-*+]\s+/gm, "")
    .replace(/^[\s]*\d+\.\s+/gm, "")
    .replace(/^>\s+/gm, "")
    .replace(/^[-*]{3,}$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

const chunkByParagraphs = (text: string, maxChars: number): string[] => {
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";
  for (const paragraph of paragraphs) {
    if (current && current.length + paragraph.length + 2 > maxChars) {
      chunks.push(current);
      current = "";
    }
    if (paragraph.length > maxChars) {
      for (let i = 0; i < paragraph.length; i += maxChars) {
        const slice = paragraph.slice(i, i + maxChars);
        if (current) {
          chunks.push(current);
          current = "";
        }
        chunks.push(slice);
      }
    } else {
      current = current ? current + "\n\n" + paragraph : paragraph;
    }
  }
  if (current) chunks.push(current);
  return chunks;
};

const synthChunk = async (
  text: string,
  voice: string,
  instructions?: string
): Promise<Buffer> => {
  const client = getClient();
  const response = await client.audio.speech.create({
    model: TTS_MODEL,
    voice,
    input: text,
    instructions,
    response_format: "mp3",
  });
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
};

const concatMp3 = async (buffers: Buffer[]): Promise<Buffer> => {
  if (buffers.length === 1) return buffers[0];
  const tmpDir = "/tmp/languagesai-tts";
  const { mkdirSync, writeFileSync, readFileSync, unlinkSync } = await import("fs");
  const { join } = await import("path");
  mkdirSync(tmpDir, { recursive: true });

  const filePaths = buffers.map((buf, i) => {
    const p = join(tmpDir, `chunk-${Date.now()}-${i}.mp3`);
    writeFileSync(p, buf);
    return p;
  });
  const listFile = join(tmpDir, `list-${Date.now()}.txt`);
  writeFileSync(listFile, filePaths.map((p) => `file '${p}'`).join("\n"));

  try {
    const out = join(tmpDir, `merged-${Date.now()}.mp3`);
    await execFileAsync(ffmpegPath, [
      "-y",
      "-f", "concat",
      "-safe", "0",
      "-i", listFile,
      "-c", "copy",
      out,
    ]);
    const result = readFileSync(out);
    unlinkSync(out);
    return result;
  } finally {
    for (const p of filePaths) unlinkSync(p);
    unlinkSync(listFile);
  }
};

export const generateLectureAudio = async (
  lectureId: string,
  voice: string = TTS_VOICE,
  instructions?: string
): Promise<{ urlAudio: string; recordId: string }> => {
  const lecture = await Lecture.findById(lectureId);
  if (!lecture) throw new Error("Lecture not found");
  if (!lecture.content?.trim()) throw new Error("Lecture has no content");

  const plainText = stripMarkdown(lecture.content);
  if (!plainText) throw new Error("Lecture content is empty after cleaning");

  const effectiveInstructions = instructions || TTS_INSTRUCTIONS;
  const chunks = chunkByParagraphs(plainText, MAX_CHARS);
  const buffers: Buffer[] = [];
  for (let i = 0; i < chunks.length; i++) {
    logger.info(`Generando audio chunk ${i + 1}/${chunks.length} para lecture ${lectureId}`);
    buffers.push(await synthChunk(chunks[i], voice, effectiveInstructions));
  }

  const audioBuffer = await concatMp3(buffers);
  const filename = `lecture-${lectureId}-${Date.now()}.mp3`;

  const { url, recordId } = await uploadAudioToPocketBase(audioBuffer, filename, {
    lectureId,
    voice,
  });

  const updated = await Lecture.findByIdAndUpdate(
    lectureId,
    { urlAudio: url, audioRecordId: recordId, voice },
    { new: true }
  );

  logger.info("Audio de lectura generado y guardado", { lectureId, url });
  return {
    urlAudio: updated?.urlAudio || url,
    recordId,
  };
};

export const removeLectureAudio = async (lectureId: string): Promise<void> => {
  const lecture = await Lecture.findById(lectureId);
  if (!lecture) return;
  if (lecture.audioRecordId) {
    await deleteAudioFromPocketBase(lecture.audioRecordId);
  }
  await Lecture.findByIdAndUpdate(lectureId, { urlAudio: "", audioRecordId: null });
};
