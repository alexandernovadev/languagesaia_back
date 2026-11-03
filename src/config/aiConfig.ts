/**
 * AI providers.
 * - DeepSeek: every text generation (OpenAI-compatible API).
 * - OpenAI: only images (DALL·E) and audio (TTS + Whisper), which DeepSeek doesn't offer.
 */

export const DEEPSEEK = {
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com",
  models: {
    chat: "deepseek-chat",
    reasoner: "deepseek-reasoner",
  },
} as const;

export type DeepSeekModel = (typeof DEEPSEEK.models)[keyof typeof DEEPSEEK.models];

export const OPENAI = {
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "https://api.openai.com/v1",
  imageModel: "dall-e-3",
} as const;
