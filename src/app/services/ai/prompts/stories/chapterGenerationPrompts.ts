import { getLangLabel } from "../langUtils";

export interface ChapterGenerationPromptParams {
  storyTitle: string;
  storyDescription: string;
  storyGenre: string;
  languageLevel: string;
  language?: string;
  targetVocabulary: string[];
  targetGrammar: string[];
  previousChapters: { title: string; content: string }[];
  chapterNumber: number;
  instructions?: string;
  requestEnding?: boolean;
}

export const createChapterGenerationPrompt = (params: ChapterGenerationPromptParams) => {
  const {
    storyTitle,
    storyGenre,
    languageLevel,
    language = "en",
    targetVocabulary,
    targetGrammar,
    previousChapters,
    chapterNumber,
    instructions = "",
    requestEnding = false,
  } = params;
  const langLabel = getLangLabel(language);

  const vocabInstruction = targetVocabulary.length > 0
    ? `
🎯 TARGET VOCABULARY (MUST USE):
These words MUST appear naturally in the chapter, each at least 2-3 times: ${targetVocabulary.join(", ")}
- Integrate them naturally into the narrative and dialogue.
- Do NOT create a vocabulary list or word bank.
- Do NOT explain the meaning of these words.
- The words should appear as part of the normal flow of the story.
`
    : "";

  const grammarInstruction = targetGrammar.length > 0
    ? `
🎯 TARGET GRAMMAR (MUST USE):
These grammar patterns MUST be used naturally in the chapter: ${targetGrammar.join(", ")}
- Integrate them NATURALLY in the narrative and dialogue; do NOT name or explain the grammar.
- NO meta explanations about grammar.
- Vary sentence structures so the grammar appears multiple times.
`
    : "";

  const RECENT_FULL_COUNT = 2;
  const recentChapters = previousChapters.slice(-RECENT_FULL_COUNT);
  const earlierChapters = previousChapters.slice(0, -RECENT_FULL_COUNT);

  const contextInstruction = previousChapters.length > 0
    ? `
PREVIOUS CHAPTERS CONTEXT:
${earlierChapters.length > 0
    ? `Earlier chapters so far (titles only, for background — do not re-narrate them): ${earlierChapters.map((ch) => `"${ch.title}"`).join(", ")}\n`
    : ""}
FULL TEXT of the ${recentChapters.length === 1 ? "previous chapter" : `last ${recentChapters.length} chapters`} (continue naturally from exactly where the most recent one ends):

${recentChapters.map((ch, i) => `--- Chapter ${chapterNumber - recentChapters.length + i}: "${ch.title}" ---\n${ch.content}`).join("\n\n")}

CONTINUATION RULES (MANDATORY):
- Continue the story EXACTLY from where the chapter above ended.
- Keep the SAME characters, names, and overall tone/style, unless the USER INSTRUCTIONS above explicitly ask for a change.
- Keep the SAME places/setting UNLESS the USER INSTRUCTIONS above explicitly request a new location or scene — in that case, transition into it naturally.
- NEVER repeat, summarize, recap, or retell anything that already happened.
- NEVER introduce a new title for this chapter within the content (the chapter title is separate).
`
    : `
FIRST CHAPTER RULES (MANDATORY):
- This is the FIRST chapter of the story.
- Introduce the setting, main character(s), and initial situation naturally.
- Do NOT start with "Once upon a time" or cliché openings. Start with an engaging scene.
`;

  const endingInstruction = requestEnding
    ? `
ENDING RULES:
- The user has requested a final chapter. Bring the story to a satisfying conclusion.
- Resolve the main conflict(s) naturally.
- Do NOT leave the story open-ended.
`
    : `
CONTINUATION RULES (MANDATORY):
- The story is a MULTIVERSE — it should NOT have a final ending unless explicitly requested.
- End the chapter in a way that could naturally continue further.
- Do NOT add conclusions, closing phrases, or summaries at the end.
- Do NOT use phrases like "in conclusion", "to conclude", "the end", "para finalizar", "en conclusión", etc.
`;

  const userInstructions = instructions
    ? `
🎯 USER INSTRUCTIONS FOR THIS CHAPTER (HIGHEST PRIORITY — MUST FOLLOW):
"${instructions}"
- This is the single most important requirement for this chapter. Build the chapter's events around it.
- If it implies a change of scene, location, or focus, make that change happen — adapt the setting/scene as needed while keeping the same established characters and overall story tone.
- Do NOT ignore, water down, or just vaguely gesture at this instruction — it must be clearly reflected in what actually happens in the chapter.
- Weave it naturally into the narrative; do NOT explain it or break the fourth wall about it.
`
    : "";

  return {
    system: `
You are a skilled storyteller writing a ${storyGenre} story titled "${storyTitle}" for ${langLabel} language learners at ${languageLevel} level.

STORY DESCRIPTION:
${params.storyDescription}
${userInstructions}
CHAPTER ${chapterNumber} GENERATION RULES:

PARAGRAPH BREAKS (CRITICAL):
- ALWAYS separate paragraphs with an empty line: write "\n\n" between paragraphs.
- NEVER write two paragraphs on the same line.
- NEVER join the whole text into a single line or a single block without line breaks.
- Use 1-3 sentences per paragraph, then a blank line, then the next paragraph.

FORMATTING:
- NEVER use Markdown tables, pipe characters (|), or any tabular/column layout.
- NEVER use blockquotes (the ">" character) for dialogue, quotes, or anything else — write dialogue as regular paragraphs.
- Use **bold** generously to highlight key vocabulary, important concepts, and punchy phrases (2-4 per paragraph).
- Use *italic* for emphasis, emotions, or to draw attention to specific words.
- Use <u>underline</u> the first time a character name or place name is introduced.
- Use <mark>highlight</mark> for idiomatic expressions or important plot turns (1-2 per chapter, not more).
- Mix all of these naturally across the chapter — don't cluster them all in one paragraph and leave the rest plain.
- ALWAYS write a space after the # characters in every heading (e.g. "# Title", "## Subtitle"). NEVER write "#Title".
- NEVER repeat the # symbol in a heading. NEVER write "## # Subtitle" or "# # Title".
- Do NOT add any headings within the chapter content. The chapter title is provided separately.

LEVEL-APPROPRIATE LANGUAGE:
- For ${languageLevel} level:
  - **A1-A2:** Use simple words, basic sentences, short clear examples.
  - **B1-B2:** Use intermediate vocabulary, compound sentences, real-world examples.
  - **C1-C2:** Use everyday, common ${langLabel} vocabulary. Complexity comes from grammar and sentence structure, NOT from rare or fancy words.

${vocabInstruction}
${grammarInstruction}
${contextInstruction}
${endingInstruction}

LENGTH:
- The chapter MUST be between 600 and 700 words (not characters).
- CRITICAL: Do NOT stop generating until you reach at least 600 words.
- Count words carefully.

LANGUAGE: Always write in ${langLabel} only.
`,
    user: `Write chapter ${chapterNumber} of "${storyTitle}" (${storyGenre}). ${requestEnding ? "This is the FINAL chapter — bring the story to a satisfying conclusion." : "Continue the story naturally without a final ending."}${instructions ? ` Make sure this chapter follows this specific instruction: "${instructions}".` : ""}`,
  };
};
