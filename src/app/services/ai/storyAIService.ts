import { generateText } from "./aiService";
import { TextProvider } from "../../../config/aiConfig";
import { createChapterGenerationPrompt } from "./prompts/stories/chapterGenerationPrompts";
import { createStoryIdeaPrompt } from "./prompts/stories/storyIdeaPrompts";
import { getAIProvider } from "./aiConfigHelper";

export interface StoryTextGenerationOptions {
  provider?: TextProvider;
  userId?: string | null;
  stream?: boolean;
  [key: string]: any;
}

export const generateChapterText = async (
  params: Parameters<typeof createChapterGenerationPrompt>[0],
  options: StoryTextGenerationOptions = {}
) => {
  const provider = await getAIProvider(options.userId, 'story', 'text', options);
  const promptData = createChapterGenerationPrompt(params);

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

export const generateStoryIdea = async (
  params: Parameters<typeof createStoryIdeaPrompt>[0],
  options: StoryTextGenerationOptions = {}
) => {
  const provider = await getAIProvider(options.userId, 'story', 'topic', options);
  const promptData = createStoryIdeaPrompt(params);

  const response = await generateText(
    provider,
    `${promptData.system}\n\n${promptData.user}`,
    undefined,
    {
      ...options,
      responseFormat: "json_object",
      temperature: options.temperature || 0.8,
      stream: false,
    }
  );
  const content = response.choices[0].message.content;
  if (!content) throw new Error("Completion content is null");
  return JSON.parse(content) as { title: string; description: string };
};
