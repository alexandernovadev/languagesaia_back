import { createChapterGenerationPrompt } from "./prompts/stories/chapterGenerationPrompts";
import { createStoryIdeaPrompt } from "./prompts/stories/storyIdeaPrompts";
import { createChapterTitlePrompt } from "./prompts/stories/chapterTitlePrompts";
import { generateAIContent, AIContentOptions } from "./aiGenerationHelper";

export type StoryTextGenerationOptions = AIContentOptions;

export const generateChapterText = async (
  params: Parameters<typeof createChapterGenerationPrompt>[0],
  options: StoryTextGenerationOptions = {}
) => {
  return generateAIContent({
    feature: "story",
    operation: "text",
    promptData: createChapterGenerationPrompt(params),
    options,
    stream: true,
    defaultTemperature: 0.7,
  });
};

export const generateChapterTitle = async (
  params: Parameters<typeof createChapterTitlePrompt>[0],
  options: StoryTextGenerationOptions = {}
): Promise<string> => {
  return generateAIContent({
    feature: "story",
    operation: "title",
    promptData: createChapterTitlePrompt(params),
    options,
    stream: false,
    defaultTemperature: 0.8,
  });
};

export const generateStoryIdea = async (
  params: Parameters<typeof createStoryIdeaPrompt>[0],
  options: StoryTextGenerationOptions = {}
): Promise<{ title: string; description: string }> => {
  return generateAIContent({
    feature: "story",
    operation: "topic",
    promptData: createStoryIdeaPrompt(params),
    options,
    stream: false,
    defaultTemperature: 0.8,
    nonStreamResponseFormat: "json_object",
    parseJSON: true,
  });
};
