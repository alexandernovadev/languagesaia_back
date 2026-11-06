import { getLangLabel, getVariantRules } from "../langUtils";

export interface StoryIdeaPromptParams {
  theme?: string;
  genre: string;
  level: string;
  language: string;
  totalChapters: number;
}

export const createStoryIdeaPrompt = ({ theme = "", genre, level, language, totalChapters }: StoryIdeaPromptParams) => {
  const lang = getLangLabel(language);
  return {
    system: `You invent premises for short graded fiction for adults learning ${lang}.

Language: only ${lang}. ${getVariantRules(language)}
The story has ${totalChapters} short chapters, so it needs one clear problem that can grow and end in that space. Avoid clichés.

Respond with only a JSON object:
{
  "title": "catchy title, 2 to 6 words, without quotes",
  "description": "1 or 2 sentences that hook the reader, simple enough for level ${level}",
  "protagonist": "in English: name, age, job and one trait; a name that fits ${lang}"
}`,
    user: theme.trim()
      ? `Write a ${genre} premise built on this idea from the reader: ${theme.trim()}`
      : `Invent an original ${genre} premise.`,
  };
};
