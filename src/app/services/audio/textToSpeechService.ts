import OpenAI from "openai";
import { AI_CONFIG } from "../../../config/aiConfig";

export const DEFAULT_TTS_VOICE = "coral";
export const DEFAULT_TTS_INSTRUCTIONS =
  "Speak like an engaging storyteller. Use a warm, expressive and cheerful tone. " +
  "Speak slowly and clearly, with natural pauses between sentences. " +
  "Pronounce every word carefully. Keep the energy positive and animated, but never exaggerated.";

const client = new OpenAI({
  apiKey: AI_CONFIG.providers.openai.apiKey,
  baseURL: AI_CONFIG.providers.openai.baseURL,
});

// Keep this as close as possible to what KaraokeView.tsx treats as "spoken words"
// (front/src/shared/components/lecture/KaraokeView.tsx parseContent/tokenize): same
// markers stripped (headings, list bullets, blockquotes, emphasis), hyphens inside
// words preserved. The closer these two texts are, the fewer gaps the word-alignment
// algorithm has to interpolate.
const cleanTextForSpeech = (content: string): string =>
  content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/~~~[\s\S]*?~~~/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<u>([^<]*)<\/u>/gi, "$1")
    .replace(/<[^>]*>/g, " ")
    .split("\n")
    .map((line) =>
      line
        .replace(/^\s{0,3}#{1,6}\s+/, "")
        .replace(/^\s*>\s?/, "")
        .replace(/^\s*\d+[.)]\s+/, "")
        .replace(/^\s*[-*+]\s+/, "")
        .replace(/^\s*[-*_]{3,}\s*$/, "")
    )
    .join("\n")
    .replace(/\*\*\*([^*\n]+)\*\*\*/g, "$1")
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/__([^_\n]+)__/g, "$1")
    .replace(/_([^_\n]+)_/g, "$1")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

export const generateChapterAudio = async (
  content: string,
  voice = DEFAULT_TTS_VOICE
): Promise<Buffer> => {
  const input = cleanTextForSpeech(content);
  if (!input) throw new Error("Chapter content is empty");

  const response = await client.audio.speech.create({
    model: "gpt-4o-mini-tts",
    voice,
    input,
    instructions: DEFAULT_TTS_INSTRUCTIONS,
    response_format: "mp3",
  });

  return Buffer.from(await response.arrayBuffer());
};

export interface AudioWordTiming {
  word: string;
  start: number;
  end: number;
}

export const transcribeAudioWithWordTimestamps = async (
  audioBuffer: Buffer,
  filename: string
): Promise<AudioWordTiming[]> => {
  const response = await client.audio.transcriptions.create({
    file: new File([new Uint8Array(audioBuffer)], filename, { type: "audio/mpeg" }),
    model: "whisper-1",
    response_format: "verbose_json",
    timestamp_granularities: ["word"],
  } as any);

  return ((response as any).words || []).map((item: any) => ({
    word: String(item.word || "").trim(),
    start: Number(item.start),
    end: Number(item.end),
  })).filter((item: AudioWordTiming) => item.word && Number.isFinite(item.start) && Number.isFinite(item.end));
};
