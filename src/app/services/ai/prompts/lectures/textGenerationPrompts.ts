export interface LectureTextGenerationPromptParams {
  prompt: string;
  level: string;
  typeWrite: string;
  promptWords?: string;
  language: string;
  rangeMin?: number;
  rangeMax?: number;
  grammarTopics?: string[];
  selectedWords?: string[];
}

export const createLectureTextGenerationPrompt = (params: LectureTextGenerationPromptParams) => {
  const {
    prompt,
    level,
    typeWrite,
    promptWords = "",
    language,
    rangeMin,
    rangeMax,
    grammarTopics = [],
    selectedWords = [],
  } = params;

  const selectedWordsInstructions = selectedWords.length > 0 
    ? `
🎯 SELECTED WORDS REQUIREMENT:
You MUST include these specific words naturally in the text: ${selectedWords.join(', ')}
- Use each word at least once in appropriate contexts
- Integrate them naturally into the narrative/story
- Do NOT create a separate vocabulary list or word bank
- Do NOT explain the meaning of these words
- These words should appear as part of the normal flow of the content
- Ensure the text feels natural while incorporating all selected words
`
    : "";

  const grammarInstructions = grammarTopics.length > 0 
    ? `
🎯 GRAMMAR TOPICS REQUIREMENT:
Use these grammar patterns implicitly in the sentences: ${grammarTopics.join(', ')}
- Integrate them NATURALLY in the narrative/dialogue; do NOT name or explain the grammar
- NO headings, subtitles, or paragraphs that mention the grammar names
- NO meta explanations, definitions, or tutorials about grammar
- The topic "${prompt || 'random'}" is the main theme; grammar is only reflected in how sentences are written
- Vary sentence structures so the selected grammar appears multiple times, but always as part of the story/content
`
    : "";

  return {
    system: `
Generate a Markdown text in language "${language}" according to ISO 639-1 standards for languages. 
This text is for educational purposes with a "${typeWrite}" style, using vocabulary and 
complexity appropriate for a ${level} level. 

CRITICAL - Vocabulary:
- ALWAYS use everyday, common vocabulary regardless of level. Never use rare, archaic, or overly formal words.
- Complexity comes from grammar and sentence structure, NOT from obscure vocabulary.
- Each word should be clickable and easily searchable in a dictionary.

Formatting guidelines:
- Title must be "# Title".
- ALWAYS write a space after the # characters in every heading (e.g. "# Title", "## Subtitle", "### Subtitle"). NEVER write "#Title" or "##Subtitle" without the space.
- NEVER repeat the # symbol in a heading. NEVER write "## # Subtitle" or "# # Title" or any heading with more than one group of # symbols.
- Use one main subtitle as "## Subtitle".
- Use additional subtitles as "### Subtitle" frequently (every 2-3 paragraphs) for clear structure.
- You can use h4 (####) and h5 (#####) headers for sub-sections.
- Avoid using additional H1 or H2 headers after the initial title and subtitle.
- Don't use old fashioned words.
- Don't use nested lists (sub-lists) in the Markdown.

CRITICAL - FORBIDDEN FORMATS:
- NEVER use Markdown tables, pipe characters (|), or any tabular/column layout (no header rows, no "---" separator rows, no cells).
- NEVER use HTML tables or any multi-column structure.
- Content must be written as paragraphs and flat lists (no nesting) only.
- NEVER use blockquotes (the ">" character) for dialogue, quotes, or anything else — write dialogue as regular paragraphs.
- If you need to present multiple items, use a simple flat list, never a table.

Rich markdown formatting:
- Use **bold** generously to highlight key vocabulary, important concepts, and punchy phrases (2-4 per paragraph).
- Use *italic* for emphasis, emotions, or to draw attention to specific words.
- Vary paragraph length—mix short impactful sentences with longer descriptive ones.
- Make the text visually rich and engaging with clear visual hierarchy.

Content guidelines:
- For ${level} level:
  - **A1-A2:** Use simple words, basic sentences, and give short, clear examples. Define complex words as needed.
  - **B1-B2:** Use intermediate vocabulary, compound sentences, and provide real-world examples.
  - **C1-C2:** Use everyday, common English vocabulary (same as A1-B2). Only increase complexity through grammar, sentence structure, and nuance—never through rare or fancy words. Deeper analysis but with simple, accessible words.
- Include quotes or examples to enrich the content where relevant.
- If grammar topics are provided, REFLECT them only through sentence construction. Do NOT mention or explain grammar topics explicitly.
${promptWords ? `Include these easy words: ${promptWords}` : ""}
- CRITICAL: Do NOT end the text with conclusions, closing phrases, or summary statements.
- CRITICAL: Do NOT use phrases like "in conclusion", "to conclude", "in summary", "to finalize", "para finalizar", "en conclusión", "para concluir", or any similar closing phrases.
- The text should end naturally with the content itself, without explicit conclusions or endings.

- Length MUST BE between ${rangeMin || 200} and ${rangeMax || 400} WORDS (not characters).
- CRITICAL: The text must have AT LEAST ${rangeMin || 200} words. Count the words carefully.
- CRITICAL: Do NOT stop generating until you reach the minimum word count of ${rangeMin || 200} words.
- Must make a subtitle and not just put "subtitle" or "subtitle 1" or "subtitle 2".

Learning aids:
- For C1-C2 levels, include a brief summary of the main points.
${grammarInstructions}
${selectedWordsInstructions}
`.trim(),
    user: prompt && prompt.trim().length > 0
      ? "The topic would be " + prompt
      : "Generate a random everyday-life topic and write the text accordingly.",
  };
};

export interface LectureContinuationPromptParams {
  content: string;
  level: string;
  typeWrite: string;
  language: string;
  rangeMin?: number;
  rangeMax?: number;
  instructions?: string;
}

export const createContinuationPrompt = (params: LectureContinuationPromptParams) => {
  const {
    content,
    level,
    typeWrite,
    language,
    rangeMin = 150,
    rangeMax = 250,
    instructions = "",
  } = params;

  const instructionsSection = instructions && instructions.trim().length > 0
    ? `
🎯 USER INSTRUCTIONS (MANDATORY):
${instructions.trim()}
- Follow these instructions as the main plot direction for the continuation.
`
    : "";

  return {
    system: `
You are continuing an existing story for language learning purposes.
LANGUAGE: Always write in "${language}" according to ISO 639-1 standards.
This text is for educational purposes with a "${typeWrite}" style, using vocabulary and
complexity appropriate for a ${level} level.

CRITICAL - Vocabulary:
- ALWAYS use everyday, common vocabulary regardless of level. Never use rare, archaic, or overly formal words.
- Complexity comes from grammar and sentence structure, NOT from obscure vocabulary.
- Each word should be clickable and easily searchable in a dictionary.

CONTINUATION RULES (MANDATORY):
- Continue the story EXACTLY from where the existing text ends. The first sentence must follow naturally from the last sentence of the existing text.
- Keep the SAME characters, names, places, setting, tone, and style as the existing text.
- NEVER repeat, summarize, recap, or retell anything that already happened in the existing text.
- NEVER introduce a new title, new headings, or "#" marks of any kind.
- Do NOT add conclusions, closing phrases, or summaries at the end ("in conclusion", "to conclude", "the end", "para finalizar", "en conclusión", etc.).
- The continuation must end in a way that could naturally continue further (another part may be generated later).
- If user instructions are given, weave them naturally into the plot without explaining them.

PARAGRAPH BREAKS (CRITICAL):
- ALWAYS separate paragraphs with an empty line: write "\n\n" between paragraphs (an empty line between them).
- NEVER write two paragraphs on the same line.
- NEVER join the whole text into a single line or a single block without line breaks.
- Use 1-3 sentences per paragraph, then a blank line, then the next paragraph.

Formatting guidelines:
- Write plain paragraphs and flat lists only.
- ALWAYS write a space after the # characters in every heading (e.g. "# Title"). NEVER write "#Title" without the space.
- Don't use old fashioned words.
- Don't use nested lists (sub-lists) in the Markdown.

CRITICAL - FORBIDDEN FORMATS:
- NEVER use Markdown tables, pipe characters (|), or any tabular/column layout (no header rows, no "---" separator rows, no cells).
- NEVER use HTML tables or any multi-column structure.
- Content must be written as paragraphs and flat lists (no nesting) only.
- NEVER use blockquotes (the ">" character) for dialogue, quotes, or anything else — write dialogue as regular paragraphs.
- If you need to present multiple items, use a simple flat list, never a table.

Rich markdown formatting:
- Use **bold** generously to highlight key vocabulary, important concepts, and punchy phrases (2-4 per paragraph).
- Use *italic* for emphasis, emotions, or to draw attention to specific words.
- Vary paragraph length—mix short impactful sentences with longer descriptive ones.
- Make the text visually rich and engaging with clear visual hierarchy.

Length:
- The continuation MUST be between ${rangeMin} and ${rangeMax} WORDS (not characters).
- CRITICAL: Do NOT stop generating until you reach at least ${rangeMin} words.
- CRITICAL: Do NOT exceed ${rangeMax} words.
${instructionsSection}
`.trim(),
    user: `This is the existing text so far (it may be truncated; only the end matters). Continue the story EXACTLY from where it ends, following all rules:

"""
${content}
"""

Write ONLY the continuation text. No titles, no headings, no explanations.`,
  };
};
