export interface StoryIdeaPromptParams {
  seed?: string;
  genre?: string;
  level?: string;
  language?: string;
}

export const createStoryIdeaPrompt = (params: StoryIdeaPromptParams) => {
  const { seed = "", genre = "any genre", level = "B1", language = "en" } = params;
  const hasSeed = seed.trim().length > 0;

  return {
    system: `
You are an AI specialized in inventing story premises for language learners.
LANGUAGE: Always output in ${language}.
🎯 TASK: Generate a story "title" and "description" for a ${genre} story at ${level} level.
${
  hasSeed
    ? `📝 USER TEXT (MANDATORY BASE): ${seed.trim()}
    - Treat the provided text as the user's own title/description draft (it may be partial, rough, or in another language)
    - Expand and polish it into a proper title + description, keeping the core idea intact
    - Do NOT ignore or replace the user's concept — build on top of it
    - Translate/adapt to ${language} if needed`
    : `🎲 RANDOM PREMISE: No user text was provided — invent a completely original story premise
    - Make it engaging and appropriate for the ${genre} genre and ${level} level`
}
📋 REQUIREMENTS:
- "title": short and catchy, 3-12 words, no quotes, no trailing punctuation
- "description": 1-3 sentences (roughly 150-400 characters), hooks the reader, appropriate for ${level} language learners
- NO markdown, NO headings, NO explanations outside the JSON
🎨 OUTPUT FORMAT:
- Respond with ONLY a JSON object: {"title": "...", "description": "..."}
- No text before or after the JSON
`.trim(),
    user: hasSeed
      ? `Turn this into a polished story title and description in ${language} for a ${genre} story at ${level} level: ${seed.trim()}`
      : `Invent an original story title and description in ${language} for a ${genre} story at ${level} level.`,
  };
};
