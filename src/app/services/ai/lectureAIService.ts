import { generateText } from "./aiService";
import { TextProvider } from "../../../config/aiConfig";
import {
  createLectureTextGenerationPrompt,
  createTopicGenerationPrompt,
  createLectureImagePrompt,
  createContinuationPrompt,
} from "./prompts/lectures";
import { getAIProvider } from "./aiConfigHelper";

export interface LectureTextGenerationOptions {
  provider?: TextProvider;
  userId?: string | null; // To look up user AI configuration
  stream?: boolean;
  [key: string]: any;
}

export const generateLectureText = async (
  params: Parameters<typeof createLectureTextGenerationPrompt>[0],
  options: LectureTextGenerationOptions = {}
) => {
  const provider = await getAIProvider(options.userId, 'lecture', 'text', options);
  const promptData = createLectureTextGenerationPrompt(params);
  
  // Stream mode: return the stream directly
  // Use "text" format for streaming since we send plain text, not JSON
  if (options.stream) {
    return generateText(
      provider,
      `${promptData.system}\n\n${promptData.user}`,
      undefined,
      {
        ...options,
        responseFormat: "text",
        temperature: options.temperature || 0.5,
        stream: true,
      }
    );
  }
  
  // Non-streaming: return parsed JSON (original behavior)
  const response = await generateText(
    provider,
    `${promptData.system}\n\n${promptData.user}`,
    undefined,
    {
      ...options,
      responseFormat: "json_object",
      temperature: options.temperature || 0.5,
      stream: false,
    }
  );
  const content = response.choices[0].message.content;
  if (!content) throw new Error("Completion content is null");
  return JSON.parse(content);
};

export const generateLectureTopic = async (
  params: Parameters<typeof createTopicGenerationPrompt>[0],
  options: LectureTextGenerationOptions = {}
) => {
  const provider = await getAIProvider(options.userId, 'lecture', 'topic', options);
  const promptData = createTopicGenerationPrompt(params);
  
  // Stream mode: return the stream directly
  if (options.stream) {
    return generateText(
      provider,
      `${promptData.system}\n\n${promptData.user}`,
      undefined,
      {
        ...options,
        responseFormat: "text",
        temperature: options.temperature || 0.7,
        stream: true,
      }
    );
  }

  // Non-streaming: return plain text (original behavior)
  const response = await generateText(
    provider,
    `${promptData.system}\n\n${promptData.user}`,
    undefined,
    {
      ...options,
      responseFormat: "text",
      temperature: options.temperature || 0.7,
      stream: false,
    }
  );
  const content = response.choices[0].message.content;
  if (!content) throw new Error("Completion content is null");
  return content.trim();
};

// For images, only returns the prompt — generation is handled by the image service
export { createLectureImagePrompt };

export const generateLectureContinuation = async (
  params: Parameters<typeof createContinuationPrompt>[0],
  options: LectureTextGenerationOptions = {}
) => {
  const provider = await getAIProvider(options.userId, 'lecture', 'text', options);
  const promptData = createContinuationPrompt(params);

  return generateText(
    provider,
    `${promptData.system}\n\n${promptData.user}`,
    undefined,
    {
      ...options,
      responseFormat: "text",
      temperature: options.temperature || 0.7,
      stream: true,
    }
  );
};
