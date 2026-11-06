import { AUDIO_AI, NARRATION_AI } from "../../../config/aiConfig";

export const DEFAULT_TTS_VOICE: string = AUDIO_AI.defaultVoice;

const LANGUAGE_BOOST: Record<string, string> = {
  en: "English",
  pt: "Portuguese",
  es: "Spanish",
  fr: "French",
  it: "Italian",
};

async function callFal<T>(model: string, input: unknown): Promise<T> {
  const response = await fetch(`https://fal.run/${model}`, {
    method: "POST",
    headers: { Authorization: `Key ${AUDIO_AI.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
  return (await response.json()) as T;
}

async function download(url: string): Promise<Buffer> {
  const file = await fetch(url);
  if (!file.ok) throw new Error(`Audio download failed: ${file.status}`);
  return Buffer.from(await file.arrayBuffer());
}

export async function synthesizeSpeech(text: string, language: string, voice: string = DEFAULT_TTS_VOICE): Promise<Buffer> {
  const { audio } = await callFal<{ audio?: { url?: string } }>(AUDIO_AI.ttsModel, {
    prompt: text,
    language_boost: LANGUAGE_BOOST[language],
    output_format: "url",
    voice_setting: { voice_id: voice },
    audio_setting: { format: "mp3", sample_rate: AUDIO_AI.sampleRate, bitrate: AUDIO_AI.bitrate },
  });
  if (!audio?.url) throw new Error("No audio returned");
  return download(audio.url);
}

export interface AudioWordTiming {
  word: string;
  start: number;
  end: number;
}

interface CharacterTimes {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

/** Joins the characters into words, split by whitespace just like the reader splits the text. */
function wordTimings(chunks: CharacterTimes[]): AudioWordTiming[] {
  const words: AudioWordTiming[] = [];
  let current: AudioWordTiming | null = null;
  for (const chunk of chunks) {
    chunk.characters.forEach((character, i) => {
      if (!character.trim()) {
        current = null;
        return;
      }
      const end = chunk.character_end_times_seconds[i];
      if (current) {
        current.word += character;
        current.end = end;
      } else {
        current = { word: character, start: chunk.character_start_times_seconds[i], end };
        words.push(current);
      }
    });
  }
  return words;
}

export const narrationVoice = (language: string) => NARRATION_AI.voices[language] ?? NARRATION_AI.defaultVoice;

export async function narrateChapter(content: string, language: string) {
  if (content.length > NARRATION_AI.maxCharacters) throw new Error(`Chapter is too long to narrate: ${content.length} characters`);
  const { audio, timestamps } = await callFal<{ audio?: { url?: string }; timestamps?: CharacterTimes[] }>(NARRATION_AI.model, {
    text: content,
    voice: narrationVoice(language),
    language_code: language,
    timestamps: true,
  });
  if (!audio?.url || !timestamps?.length) throw new Error("The narration came back incomplete");
  return { buffer: await download(audio.url), alignment: wordTimings(timestamps) };
}

