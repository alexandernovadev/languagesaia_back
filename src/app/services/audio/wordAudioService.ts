/**
 * Pronunciation made the first time someone asks for it, then kept for
 * everyone: a word's on the word, any other text as a SpeechClip.
 */
import { createHash } from "crypto";
import SpeechClip from "../../db/models/SpeechClip";
import Word from "../../db/models/Word";
import { IWord } from "../../../../types/models";
import { uploadAudioToPocketBase } from "./pocketBaseService";
import { DEFAULT_TTS_VOICE, synthesizeSpeech } from "./textToSpeechService";

/** Two quick taps on the same text must not pay for it twice. */
const inFlight = new Map<string, Promise<string>>();

function once(key: string, create: () => Promise<string>) {
  const running = inFlight.get(key);
  if (running) return running;
  const job = create().finally(() => inFlight.delete(key));
  inFlight.set(key, job);
  return job;
}

async function record(text: string, language: string, contentId: string) {
  const buffer = await synthesizeSpeech(text, language);
  const { url } = await uploadAudioToPocketBase(buffer, `${contentId}.mp3`, { contentId, voice: DEFAULT_TTS_VOICE });
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
