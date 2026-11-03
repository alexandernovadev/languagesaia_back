/**
 * Unified AI service for word-related operations
 * Uses centralized AI configuration and separated prompts
 */

import {
  generateText,
  generateChat,
  TextGenerationOptions,
} from "./textAIService";
import {
  createWordGenerationPrompt,
  createWordChatPrompt,
  createWordSynonymsPrompt,
  createWordTypesPrompt,
  createWordExamplesPrompt,
  createWordCodeSwitchingPrompt,
} from "./prompts/words";
import { Language } from "../../../../types/business";

// Options for word generation
export interface WordGenerationOptions extends TextGenerationOptions {
  userId?: string | null; // To look up user AI configuration
}

// Generate complete word data
export const generateWordData = async (
  prompt: string,
  language: Language = "en",
  wordDataExamples: any[] = [],
  options: WordGenerationOptions = {}
) => {

  // Create prompt using separated function
  const promptData = createWordGenerationPrompt({
    prompt,
    language,
    wordDataExamples,
  });

  // Generate using centralized service
  const response = await generateText(`${promptData.system}\n\n${promptData.user}`, {
      ...options,
      responseFormat: "json_object",
      temperature: options.temperature || 0.1,
    }
  );

  // Parse and return JSON response
  const content = response.choices[0].message.content;
  if (!content) {
    throw new Error("Completion content is null");
  }

  return JSON.parse(content);
};

// Generate word examples
export const generateWordExamples = async (
  word: string,
  language: Language = "en",
  oldExamples: string = "",
  options: WordGenerationOptions = {}
) => {

  const promptData = createWordExamplesPrompt({
    word: word,
    language,
    oldExamples,
  });

  const response = await generateText(`${promptData.system}\n\n${promptData.user}`, {
      ...options,
      responseFormat: "json_object",
      temperature: options.temperature || 0.5,
    }
  );

  const content = response.choices[0].message.content;
  if (!content) {
    throw new Error("Completion content is null");
  }

  return JSON.parse(content);
};

// Generate word code-switching examples
export const generateWordCodeSwitching = async (
  word: string,
  language: Language = "en",
  oldExamples: string = "",
  options: WordGenerationOptions = {}
) => {

  const promptData = createWordCodeSwitchingPrompt({
    prompt: word,
    language,
    oldExamples,
  });

  const response = await generateText(`${promptData.system}\n\n${promptData.user}`, {
      ...options,
      responseFormat: "json_object",
      temperature: options.temperature || 0.5,
    }
  );

  const content = response.choices[0].message.content;
  if (!content) {
    throw new Error("Completion content is null");
  }

  return JSON.parse(content);
};

// Generate word types
export const generateWordTypes = async (
  word: string,
  language: Language = "en",
  oldExamples: string = "",
  options: WordGenerationOptions = {}
) => {

  const promptData = createWordTypesPrompt({
    word,
    language,
    oldExamples,
  });

  const response = await generateText(`${promptData.system}\n\n${promptData.user}`, {
      ...options,
      responseFormat: "json_object",
      temperature: options.temperature || 0.5,
    }
  );

  const content = response.choices[0].message.content;
  if (!content) {
    throw new Error("Completion content is null");
  }

  return JSON.parse(content);
};

// Generate word synonyms
export const generateWordSynonyms = async (
  word: string,
  language: Language = "en",
  oldExamples: string = "",
  options: WordGenerationOptions = {}
) => {

  const promptData = createWordSynonymsPrompt({
    word,
    language,
    oldExamples,
  });

  const response = await generateText(`${promptData.system}\n\n${promptData.user}`, {
      ...options,
      responseFormat: "json_object",
      temperature: options.temperature || 0.5,
    }
  );

  const content = response.choices[0].message.content;
  if (!content) {
    throw new Error("Completion content is null");
  }

  return JSON.parse(content);
};

// Generate word chat (streaming)
export const generateWordChat = async (
  wordText: string,
  wordDefinition: string,
  userMessage: string,
  chatHistory: Array<{ role: string; content: string }> = [],
  options: WordGenerationOptions = {},
  language?: string,
  explainsLanguage?: string
) => {

  const promptData = createWordChatPrompt({
    wordText,
    wordDefinition,
    userMessage,
    chatHistory,
    language,
    explainsLanguage,
  });

  return generateChat(promptData.messages, {
    ...options,
    temperature: options.temperature || 0.7,
    stream: options.stream || true,
  });
};
