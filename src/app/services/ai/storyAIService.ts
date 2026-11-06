import { createChapterDetailsPrompt, createChapterPrompt, ChapterDetailsParams, ChapterPromptParams } from "./prompts/stories/chapterGenerationPrompts";
import { createStoryIdeaPrompt, StoryIdeaPromptParams } from "./prompts/stories/storyIdeaPrompts";
import { generateAIContent, AIContentOptions } from "./aiGenerationHelper";

export interface StoryIdea {
  title: string;
  description: string;
  protagonist: string;
}

export interface ChapterDetails {
  summary: string;
  /** The reader's idea, with its mistakes corrected. */
  idea?: string;
  usedForms: string[];
  questions: { question: string; options: string[]; answer: number }[];
}

const json = (promptData: { system: string; user: string }, options: AIContentOptions, defaultTemperature: number) =>
  generateAIContent({ promptData, options, stream: false, defaultTemperature, nonStreamResponseFormat: "json_object", parseJSON: true });

export const generateStoryIdea = (params: StoryIdeaPromptParams, options: AIContentOptions = {}): Promise<StoryIdea> =>
  json(createStoryIdeaPrompt(params), options, 0.9);

/** The title on the first line, then the text, as it's written. No thinking first: it held the first word back over 20 s. */
export const streamChapter = (params: ChapterPromptParams, options: AIContentOptions = {}) =>
  generateAIContent({ promptData: createChapterPrompt(params), options: { ...options, reasoningEffort: "none" }, stream: true, defaultTemperature: 0.8 });

const isValid = (c: ChapterDetails) =>
  !!c?.summary && c.questions?.length === 3 &&
  c.questions.every((q) => q.question && q.options?.length === 3 && [0, 1, 2].includes(q.answer));

/** Broken details get one more try. After that the chapter stays readable, without questions. */
export const generateChapterDetails = async (params: ChapterDetailsParams, options: AIContentOptions = {}): Promise<ChapterDetails> => {
  const promptData = createChapterDetailsPrompt(params);
  for (let attempt = 0; attempt < 2; attempt++) {
    const details: ChapterDetails | null = await json(promptData, options, 0.3).catch(() => null);
    if (details && isValid(details)) return details;
  }
  return { summary: "", usedForms: [], questions: [] };
};
