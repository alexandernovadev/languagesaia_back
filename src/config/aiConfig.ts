/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  AI CONFIG — the ONE file to touch when changing AI providers or models.
 * ─────────────────────────────────────────────────────────────────────────────
 *  Every AI call in the app reads from here. Nothing else hardcodes a provider,
 *  URL, key or model name.
 *
 *  To switch a provider: change its `baseURL`, `apiKey` env var and model names.
 *  TEXT_AI and AUDIO_AI must speak the OpenAI-compatible API; IMAGE_AI uses
 *  fal.ai's REST API (see services/ai/imageAIService.ts).
 */

/** Text generation: words, expressions, stories, reader, chats, exams. */
export const TEXT_AI = {
  name: "Fireworks",
  apiKey: process.env.FIREWORKS_API_KEY,
  baseURL: "https://api.fireworks.ai/inference/v1",
  /**
   * Must be a SERVERLESS model on Fireworks (or a deployment you own).
   * Qwen 3.8 (qwen3p8-*) was too slow / often hanging on Fireworks serverless.
   */
  models: {
    /** Default for every text task. */
    default: "accounts/fireworks/models/deepseek-v4p1-flash",
    /** Tasks that need careful reasoning (exam validation & correction). */
    reasoning: "accounts/fireworks/models/deepseek-v4p1-flash",
  },
  /** How much the model "thinks" before answering, per tier (low | medium | high | none). */
  reasoningEffort: {
    default: "low",
    reasoning: "medium",
  },
  /**
   * Backup model. If the main model doesn't START answering within
   * `primaryTimeoutMs` (Fireworks sometimes leaves requests hanging),
   * the same request is retried here so the app never gets stuck.
   */
  fallback: "accounts/fireworks/models/kimi-k3",
  primaryTimeoutMs: 20_000,
  /** Same, for non-streamed calls: there the whole answer must arrive (exam generation takes 15–25 s). */
  primaryTimeoutMsFull: 45_000,
  /** After the main model fails, use the backup directly for this long, then try the main one again. */
  primaryCooldownMs: 5 * 60_000,
  /** Hard limit for the backup request. */
  timeoutMs: 90_000,
} as const;

/** Image generation: word / expression / story pictures. */
export const IMAGE_AI = {
  name: "fal.ai",
  apiKey: process.env.FAL_KEY,
  baseURL: "https://fal.run",
  model: "fal-ai/flux/schnell",
  /** square_hd = 1024x1024. Others: square, portrait_4_3, portrait_16_9, landscape_4_3, landscape_16_9 */
  size: "square_hd",
  outputFormat: "jpeg",
  /**
   * Glota's house style, appended to every scene. FLUX reads descriptions, not
   * rules: say what the picture IS, never "no …" (it would draw it).
   */
  styles: {
    vocabulary:
      "Flat vector illustration, soft pastel colors (lilac, sky blue, mint, peach, butter yellow), rounded friendly shapes, single centered subject, plain soft pastel background, gentle lighting, clean and minimal, cheerful educational picture-book style",
    story:
      "Storybook cover illustration, painterly digital art, soft pastel palette with rich atmosphere, cinematic lighting, clear focal point, wide calm background",
  },
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
