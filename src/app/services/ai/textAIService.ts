/**
 * Text generation. Provider and models come from config/aiConfig.ts (TEXT_AI).
 */

import OpenAI from "openai";
import { TEXT_AI, TextModelTier } from "../../../config/aiConfig";
import logger from "../../utils/logger";

const client = new OpenAI({ apiKey: TEXT_AI.apiKey, baseURL: TEXT_AI.baseURL, maxRetries: 0 });

export interface TextGenerationOptions {
  /** Which model from TEXT_AI.models to use. Defaults to "default". */
  tier?: TextModelTier;
  temperature?: number;
  stream?: boolean;
  maxTokens?: number;
  responseFormat?: "text" | "json_object";
  /** Override how much the model thinks (default comes from TEXT_AI.reasoningEffort[tier]). */
  reasoningEffort?: "none" | "low" | "medium" | "high";
}

type ChatMessage = { role: string; content: string };

/**
 * Sends the request to the main model; if it doesn't start answering within
 * TEXT_AI.primaryTimeoutMs (streams) / primaryTimeoutMsFull (full answers) (or fails with a timeout/connection/5xx error),
 * retries once with TEXT_AI.fallback. For streams, "start answering" means the
 * response headers arrived, so a hanging provider is detected quickly.
 */
/** While Date.now() is below this, the main model is skipped (it failed recently). */
let primaryDownUntil = 0;

const complete = async (messages: ChatMessage[], options: TextGenerationOptions) => {
  const tier = options.tier ?? "default";
  const base: any = {
    messages,
    temperature: options.temperature ?? 0.7,
    stream: options.stream ?? false,
  };
  if (options.maxTokens) base.max_tokens = options.maxTokens;
  if (options.responseFormat === "json_object") base.response_format = { type: "json_object" };

  const effort = options.reasoningEffort ?? TEXT_AI.reasoningEffort[tier];
  const primary = { ...base, model: TEXT_AI.models[tier], reasoning_effort: effort };
  const backup = { ...base, model: TEXT_AI.fallback, reasoning_effort: effort };

  // The main model failed recently: don't make the user wait again, go straight to the backup.
  if (TEXT_AI.fallback && Date.now() < primaryDownUntil) {
    return client.chat.completions.create(backup, { timeout: TEXT_AI.timeoutMs });
  }
  try {
    return await client.chat.completions.create(primary, { timeout: base.stream ? TEXT_AI.primaryTimeoutMs : TEXT_AI.primaryTimeoutMsFull });
  } catch (error: any) {
    const status = error?.status as number | undefined;
    const retriable = status === undefined || status === 408 || status === 429 || status >= 500;
    if (!retriable || !TEXT_AI.fallback) throw error;
    primaryDownUntil = Date.now() + TEXT_AI.primaryCooldownMs;
    logger.warn(`[AI] ${primary.model} did not answer (${error?.name ?? "error"}${status ? ` ${status}` : ""}); using fallback ${TEXT_AI.fallback} for the next ${TEXT_AI.primaryCooldownMs / 60000} min`);
    return client.chat.completions.create(backup, { timeout: TEXT_AI.timeoutMs });
  }
};

/** Single prompt sent as one user message. */
export const generateText = (prompt: string, options: TextGenerationOptions = {}) =>
  complete([{ role: "user", content: prompt }], options);

/** Full conversation (system/user/assistant messages). */
export const generateChat = (messages: ChatMessage[], options: TextGenerationOptions = {}) =>
  complete(messages, options);
