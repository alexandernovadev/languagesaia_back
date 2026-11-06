import { AUDIO_AI } from "../../../config/aiConfig";

export const DEFAULT_TTS_VOICE: string = AUDIO_AI.defaultVoice;

const LANGUAGE_BOOST: Record<string, string> = {
  en: "English",
  pt: "Portuguese",
  es: "Spanish",
  fr: "French",
  it: "Italian",
};

async function callFal<T>(model: string, input: unknown): Promise<T> {
  const response = await fetch(`${AUDIO_AI.baseURL}/${model}`, {
    method: "POST",
    headers: { Authorization: `Key ${AUDIO_AI.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
  return (await response.json()) as T;
}

export interface Speech {
  buffer: Buffer;
  /** Where fal keeps the file for a while: enough to transcribe it. */
  url: string;
}

export async function synthesizeSpeech(text: string, language: string, voice: string = DEFAULT_TTS_VOICE): Promise<Speech> {
  const { audio } = await callFal<{ audio?: { url?: string } }>(AUDIO_AI.ttsModel, {
    prompt: text,
    language_boost: LANGUAGE_BOOST[language],
    output_format: "url",
    voice_setting: { voice_id: voice },
    audio_setting: { format: "mp3", sample_rate: AUDIO_AI.sampleRate, bitrate: AUDIO_AI.bitrate },
  });
  if (!audio?.url) throw new Error("No audio returned");
  const file = await fetch(audio.url);
  if (!file.ok) throw new Error(`Audio download failed: ${file.status}`);
  return { buffer: Buffer.from(await file.arrayBuffer()), url: audio.url };
}

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

export const generateChapterAudio = async (content: string, language: string, voice = DEFAULT_TTS_VOICE): Promise<Speech> => {
  const input = cleanTextForSpeech(content);
  if (!input) throw new Error("Chapter content is empty");
  if (input.length > AUDIO_AI.maxCharacters) throw new Error(`Chapter is too long for one recording: ${input.length} characters`);
  return synthesizeSpeech(input, language, voice);
};

export interface AudioWordTiming {
  word: string;
  start: number;
  end: number;
}

export const transcribeAudioWithWordTimestamps = async (audioUrl: string, language: string): Promise<AudioWordTiming[]> => {
  const { chunks = [] } = await callFal<{ chunks?: Array<{ text?: string; timestamp?: [number, number] }> }>(AUDIO_AI.transcriptionModel, {
    audio_url: audioUrl,
    language,
    chunk_level: "word",
  });

  return chunks
    .map(({ text, timestamp }) => ({ word: String(text ?? "").trim(), start: Number(timestamp?.[0]), end: Number(timestamp?.[1]) }))
    .filter((item) => item.word && Number.isFinite(item.start) && Number.isFinite(item.end));
};
