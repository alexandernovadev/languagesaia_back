import { generateText } from "./aiService";
import { TextProvider } from "../../../config/aiConfig";
import { createChapterGenerationPrompt } from "./prompts/stories/chapterGenerationPrompts";
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
