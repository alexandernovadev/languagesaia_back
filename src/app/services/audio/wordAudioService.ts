/**
 * Pronunciation made the first time someone asks for it, then kept for
 * everyone: a word's on the word, any other text as a SpeechClip.
 */
import { createHash } from "crypto";
import SpeechClip from "../../db/models/SpeechClip";
import Word from "../../db/models/Word";
import { IWord } from "../../../../types/models";
import { WORD_AUDIO_AI } from "../../../config/aiConfig";
import { uploadAudioToPocketBase } from "./pocketBaseService";

const LANGUAGE_BOOST: Record<string, string> = {
  en: "English",
  pt: "Portuguese",
  es: "Spanish",
  fr: "French",
  it: "Italian",
};

/** Two quick taps on the same text must not pay for it twice. */
const inFlight = new Map<string, Promise<string>>();

function once(key: string, create: () => Promise<string>) {
  const running = inFlight.get(key);
  if (running) return running;
  const job = create().finally(() => inFlight.delete(key));
  inFlight.set(key, job);
  return job;
}

async function synthesize(text: string, language: string): Promise<Buffer> {
  const response = await fetch(`${WORD_AUDIO_AI.baseURL}/${WORD_AUDIO_AI.model}`, {
    method: "POST",
    headers: { Authorization: `Key ${WORD_AUDIO_AI.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: text,
      language_boost: LANGUAGE_BOOST[language],
      output_format: "url",
      voice_setting: { voice_id: WORD_AUDIO_AI.voice },
      audio_setting: { format: "mp3", sample_rate: WORD_AUDIO_AI.sampleRate, bitrate: WORD_AUDIO_AI.bitrate },
    }),
  });
  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);

  const { audio } = (await response.json()) as { audio?: { url?: string } };
  if (!audio?.url) throw new Error("No audio returned");
  const file = await fetch(audio.url);
  if (!file.ok) throw new Error(`Audio download failed: ${file.status}`);
  return Buffer.from(await file.arrayBuffer());
}

async function record(text: string, language: string, contentId: string) {
  const buffer = await synthesize(text, language);
  const { url } = await uploadAudioToPocketBase(buffer, `${contentId}.mp3`, { contentId, voice: WORD_AUDIO_AI.voice });
  return url;
}

export function wordAudio(word: IWord): Promise<string> {
  if (word.audio) return Promise.resolve(word.audio);
  const id = String(word._id);
  return once(id, async () => {
    const url = await record(word.word, word.language, id);
    await Word.updateOne({ _id: word._id }, { audio: url }, { timestamps: false });
    return url;
  });
}

export async function textAudio(raw: string, language: string): Promise<string> {
  const text = raw.replace(/[*`]/g, "").trim(); // Markdown marks would be read aloud
  const key = createHash("sha256").update(text.toLowerCase()).digest("hex");
  const saved = await SpeechClip.findOne({ language, key }).lean();
  if (saved) return saved.url;
  return once(`${language}:${key}`, async () => {
    const url = await record(text, language, key.slice(0, 24));
    await SpeechClip.create({ language, key, text, url });
    return url;
  });
}
