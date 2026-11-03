/**
 * Text generation. Provider and models come from config/aiConfig.ts (TEXT_AI).
 */

import OpenAI from "openai";
import { TEXT_AI, TextModelTier } from "../../../config/aiConfig";

const client = new OpenAI({ apiKey: TEXT_AI.apiKey, baseURL: TEXT_AI.baseURL });

export interface TextGenerationOptions {
  /** Which model from TEXT_AI.models to use. Defaults to "default". */
  tier?: TextModelTier;
  temperature?: number;
  stream?: boolean;
  maxTokens?: number;
  responseFormat?: "text" | "json_object";
}

type ChatMessage = { role: string; content: string };

const complete = (messages: ChatMessage[], options: TextGenerationOptions) => {
  const request: any = {
    model: TEXT_AI.models[options.tier ?? "default"],
    messages,
    temperature: options.temperature ?? 0.7,
    stream: options.stream ?? false,
  };
  if (options.maxTokens) request.max_tokens = options.maxTokens;
  if (options.responseFormat === "json_object") {
    request.response_format = { type: "json_object" };
  }
  return client.chat.completions.create(request);
};

/** Single prompt sent as one user message. */
export const generateText = (prompt: string, options: TextGenerationOptions = {}) =>
  complete([{ role: "user", content: prompt }], options);

/** Full conversation (system/user/assistant messages). */
export const generateChat = (messages: ChatMessage[], options: TextGenerationOptions = {}) =>
  complete(messages, options);
