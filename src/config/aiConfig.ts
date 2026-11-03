/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  AI CONFIG — the ONE file to touch when changing AI providers or models.
 * ─────────────────────────────────────────────────────────────────────────────
 *  Every AI call in the app reads from here. Nothing else hardcodes a provider,
 *  URL, key or model name. All providers must speak the OpenAI-compatible API.
 *
 *  To switch a provider: change its `baseURL`, `apiKey` env var and model names.
 */

/** Text generation: words, expressions, stories, reader, chats, exams. */
export const TEXT_AI = {
  name: "Fireworks",
  apiKey: process.env.FIREWORKS_API_KEY,
  baseURL: "https://api.fireworks.ai/inference/v1",
  models: {
    /** Default for every text task. */
    default: "accounts/fireworks/models/qwen3p8-2p4t-a95b",
    /** Tasks that need careful reasoning (exam validation & correction). */
    reasoning: "accounts/fireworks/models/qwen3p8-2p4t-a95b",
  },
} as const;

/** Image generation: word / expression / story pictures. */
export const IMAGE_AI = {
  name: "OpenAI",
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "https://api.openai.com/v1",
  model: "dall-e-3",
} as const;

/** Audio: chapter narration (TTS) and word timestamps for karaoke (transcription). */
export const AUDIO_AI = {
  name: "OpenAI",
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "https://api.openai.com/v1",
  ttsModel: "gpt-4o-mini-tts",
  transcriptionModel: "whisper-1",
  defaultVoice: "coral",
  instructions:
    "Speak like an engaging storyteller. Use a warm, expressive and cheerful tone. " +
    "Speak slowly and clearly, with natural pauses between sentences. " +
    "Pronounce every word carefully. Keep the energy positive and animated, but never exaggerated.",
} as const;

export type TextModelTier = keyof typeof TEXT_AI.models;
