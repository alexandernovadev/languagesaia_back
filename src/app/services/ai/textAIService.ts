/**
 * Text generation — always DeepSeek.
 */

import OpenAI from "openai";
import { DEEPSEEK, DeepSeekModel } from "../../../config/aiConfig";

const client = new OpenAI({ apiKey: DEEPSEEK.apiKey, baseURL: DEEPSEEK.baseURL });

export interface TextGenerationOptions {
  model?: DeepSeekModel;
  temperature?: number;
  stream?: boolean;
  maxTokens?: number;
  responseFormat?: "text" | "json_object";
}

type ChatMessage = { role: string; content: string };

const complete = (messages: ChatMessage[], options: TextGenerationOptions) => {
  const request: any = {
    model: options.model ?? DEEPSEEK.models.chat,
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
