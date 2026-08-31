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

const cleanTextForSpeech = (content: string): string =>
  content
    .replace(/```[\s\S]*?```/g, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#*_>`~-]/g, "")
    .replace(/<[^>]*>/g, "")
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
