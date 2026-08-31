import { getLangLabel } from "../langUtils";

export interface ChapterTitlePromptParams {
  storyTitle: string;
  storyGenre: string;
  language?: string;
  chapterContent: string;
}

export const createChapterTitlePrompt = (params: ChapterTitlePromptParams) => {
  const { storyTitle, storyGenre, language = "en", chapterContent } = params;
  const langLabel = getLangLabel(language);

  return {
    system: `
You are naming a chapter of a ${storyGenre} story titled "${storyTitle}".

Read the chapter content below and generate a short, evocative title for it in ${langLabel}.

REQUIREMENTS:
- The title MUST be at most 11 characters long. Count carefully — this is a hard limit.
- It must reflect what actually happens in THIS chapter, not the story as a whole.
- Do NOT use generic titles like "Chapter 1" or "The Beginning".
- Do NOT include the word "Chapter" or any chapter number.
- No quotes, no markdown, no trailing punctuation.
- Output ONLY the title text, nothing else.
`.trim(),
    user: `Chapter content:\n\n${chapterContent.slice(0, 3000)}\n\nGenerate the title.`,
  };
};
