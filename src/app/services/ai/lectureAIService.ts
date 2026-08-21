import {
  createLectureTextGenerationPrompt,
  createTopicGenerationPrompt,
  createLectureImagePrompt,
  createContinuationPrompt,
} from "./prompts/lectures";
import { generateAIContent, AIContentOptions } from "./aiGenerationHelper";

export type LectureTextGenerationOptions = AIContentOptions;

export const generateLectureText = async (
  params: Parameters<typeof createLectureTextGenerationPrompt>[0],
  options: LectureTextGenerationOptions = {}
) => {
  return generateAIContent({
    feature: "lecture",
    operation: "text",
    promptData: createLectureTextGenerationPrompt(params),
    options,
    stream: !!options.stream,
    defaultTemperature: 0.5,
    nonStreamResponseFormat: "json_object",
    parseJSON: true,
  });
};

export const generateLectureTopic = async (
  params: Parameters<typeof createTopicGenerationPrompt>[0],
  options: LectureTextGenerationOptions = {}
) => {
  return generateAIContent({
    feature: "lecture",
    operation: "topic",
    promptData: createTopicGenerationPrompt(params),
    options,
    stream: !!options.stream,
    defaultTemperature: 0.7,
    nonStreamResponseFormat: "text",
    parseJSON: false,
  });
};

// For images, only returns the prompt — generation is handled by the image service
export { createLectureImagePrompt };

export const generateLectureContinuation = async (
  params: Parameters<typeof createContinuationPrompt>[0],
  options: LectureTextGenerationOptions = {}
) => {
  return generateAIContent({
    feature: "lecture",
    operation: "text",
    promptData: createContinuationPrompt(params),
    options,
    stream: true,
    defaultTemperature: 0.7,
  });
};
