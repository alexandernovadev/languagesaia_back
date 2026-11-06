import { createChapterPrompt, ChapterPromptParams } from "./prompts/stories/chapterGenerationPrompts";
import { createStoryIdeaPrompt, StoryIdeaPromptParams } from "./prompts/stories/storyIdeaPrompts";
import { generateAIContent, AIContentOptions } from "./aiGenerationHelper";

export interface StoryIdea {
  title: string;
  description: string;
  protagonist: string;
}

export interface ChapterDraft {
  title: string;
  content: string;
  summary: string;
  usedForms: string[];
  questions: { question: string; options: string[]; answer: number }[];
}

const json = (promptData: { system: string; user: string }, options: AIContentOptions, defaultTemperature: number) =>
  generateAIContent({ promptData, options, stream: false, defaultTemperature, nonStreamResponseFormat: "json_object", parseJSON: true });

export const generateStoryIdea = (params: StoryIdeaPromptParams, options: AIContentOptions = {}): Promise<StoryIdea> =>
  json(createStoryIdeaPrompt(params), options, 0.9);

const isValid = (c: ChapterDraft) =>
  !!c?.title && !!c.content && !!c.summary && c.questions?.length === 3 &&
  c.questions.every((q) => q.question && q.options?.length === 3 && [0, 1, 2].includes(q.answer));

/** A chapter with a broken shape can't be read, so it gets one more try. */
export const generateChapter = async (params: ChapterPromptParams, options: AIContentOptions = {}): Promise<ChapterDraft> => {
  const promptData = createChapterPrompt(params);
  const first: ChapterDraft = await json(promptData, options, 0.8);
  if (isValid(first)) return first;
  const second: ChapterDraft = await json(promptData, options, 0.8);
  if (isValid(second)) return second;
  throw new Error("The chapter came back incomplete");
};
