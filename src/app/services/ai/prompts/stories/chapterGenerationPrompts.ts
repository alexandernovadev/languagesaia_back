import { getLangLabel, getVariantRules } from "../langUtils";

export interface ChapterPromptParams {
  title: string;
  description: string;
  protagonist: string;
  genre: string;
  level: string;
  language: string;
  chapterNumber: number;
  totalChapters: number;
  /** Summaries of every earlier chapter, in order. */
  summaries: string[];
  /** The whole previous chapter, to continue from its last line. */
  previousText?: string;
  /** Words the learner is reviewing. */
  words: string[];
}

const LEVEL_RULES: Record<string, string> = {
  A1: "Very short sentences in the present tense. Only the most common everyday words.",
  A2: "Short, simple sentences. Common everyday words. Present and simple past.",
  B1: "Simple and compound sentences, everyday vocabulary, the main past and future tenses.",
  B2: "Natural, varied sentences with common idioms and all the usual tenses.",
  C1: "Rich, natural prose. Complexity comes from sentence structure, never from rare words.",
  C2: "Rich, natural prose. Complexity comes from sentence structure, never from rare words.",
};

export const createChapterPrompt = (p: ChapterPromptParams) => {
  const lang = getLangLabel(p.language);
  const isFirst = p.chapterNumber === 1;
  const isLast = p.chapterNumber === p.totalChapters;

  const position = isFirst
    ? "This is the first chapter: open inside a scene, and introduce the protagonist and the problem."
    : isLast
      ? "This is the last chapter: resolve the main conflict and give a satisfying ending."
      : "This is a middle chapter: move the plot forward and end on a moment that makes the reader want the next one.";

  const history = p.summaries.length
    ? `\nWhat happened so far:\n${p.summaries.map((s, i) => `Chapter ${i + 1}: ${s}`).join("\n")}\n`
    : "";
  const previous = p.previousText
    ? `\nPrevious chapter, to continue from exactly where it stopped. Never retell it:\n${p.previousText}\n`
    : "";

  return {
    system: `You write short graded fiction for adults learning ${lang}. The reader must want to know what happens next.

Language: only ${lang}. ${getVariantRules(p.language)}
Level ${p.level}: ${LEVEL_RULES[p.level] ?? LEVEL_RULES.B1}

Writing rules:
- Between 180 and 220 words.
- Plain text. No Markdown, no headings, no lists.
- Paragraphs of 1 to 3 sentences, separated by one blank line.
- Show events and dialogue, with concrete details. Avoid clichés and moral lessons.
- Keep the same protagonist, names, places and tone in every chapter.

Respond with only a JSON object:
{
  "title": "chapter title, 2 to 6 words, without the word chapter",
  "content": "the chapter text, with \\n\\n between paragraphs",
  "summary": "what happened, in 2 sentences, in English, naming characters and facts to remember",
  "usedForms": ["each word from the list that you really used, exactly as it appears in the text, for example fell or batia"],
  "questions": [
    { "question": "comprehension question in ${lang}", "options": ["three short options"], "answer": 0 }
  ]
}
Write exactly 3 questions about facts in this chapter, each with exactly 3 options. "answer" is the index of the right option, and the right option changes position between questions.`,
    user: `Story: ${p.title}
Genre: ${p.genre}
Premise: ${p.description}
Protagonist: ${p.protagonist}
Chapter ${p.chapterNumber} of ${p.totalChapters}. ${position}
${history}${previous}
Use these words naturally, at least 5 of them, conjugated or inflected when needed, without explaining them: ${p.words.join(", ") || "none"}.`,
  };
};
