import { generateText } from "./textAIService";
import {
  createExpressionGenerationPrompt,
  createExpressionChatPrompt,
  ExpressionGenerationPromptParams,
  ExpressionChatPromptParams,
} from "./prompts/expressions";
import { generateChat } from "./textAIService";

export interface ExpressionGenerationOptions {
  userId?: string | null; // To look up user AI configuration
  [key: string]: any;
}

export const generateExpressionData = async (
  params: ExpressionGenerationPromptParams,
  options: ExpressionGenerationOptions = {}
) => {
  const promptData = createExpressionGenerationPrompt(params);
  const response = await generateText(`${promptData.system}\n\n${promptData.user}`, {
      ...options,
      responseFormat: "json_object",
      temperature: options.temperature || 0.2,
    }
  );
  const content = response.choices[0].message.content;
  if (!content) throw new Error("Completion content is null");
  return JSON.parse(content);
};

export const generateExpressionChat = async (
  params: ExpressionChatPromptParams,
  options: ExpressionGenerationOptions = {}
) => {
  const promptData = createExpressionChatPrompt(params);
  return generateChat(promptData.messages, {
    ...options,
    temperature: options.temperature || 0.7,
    stream: options.stream || true,
  });
};
