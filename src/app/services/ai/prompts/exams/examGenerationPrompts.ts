export type QuestionType = "multiple" | "unique" | "fillInBlank" | "translateText";

export interface ExamGenerationParams {
  language: string;
  grammarTopics: string[];
  difficulty: string;
  questionCount: number;
  questionTypes: QuestionType[];
  topic?: string;
}

const typeDescriptions: Record<QuestionType, string> = {
  multiple:
    "4 options, 2+ correct (select all that apply). Schema: text, options[], correctIndices [0-3], grammarTopic, explanation. Wrong options MUST be clearly incorrect for the question.",
  unique:
    "4 options, EXACTLY ONE correct. Schema: text, options[], correctIndex (0-3), grammarTopic, explanation. Wrong options: plausible learner errors that are GRAMMATICALLY WRONG in context.",
  fillInBlank:
    "Sentence with _____ for blank(s). 4 options, EXACTLY ONE correct. Schema: text, options[], correctIndex (0-3), grammarTopic, explanation. Wrong options: verb forms/tenses that make the sentence grammatically wrong.",
  translateText:
    "Translate text to exam language. Schema: text (Spanish), correctAnswer (in exam language), grammarTopic, explanation.",
};

export const createExamGenerationPrompt = (params: ExamGenerationParams) => {
  const { language, grammarTopics, difficulty, questionCount, questionTypes, topic } = params;

  const topicHint = topic ? `General topic: ${topic}. ` : "";
  const typesList = questionTypes.length ? questionTypes.join(", ") : "multiple";
  const typeInstructions = questionTypes
    .map((t) => `- ${t}: ${typeDescriptions[t]}`)
    .join("\n");

  return {
    system: `You are an expert language teacher creating a grammar exam.
Generate exactly ${questionCount} questions. Types to use (in order, cycle if needed): ${typesList}

PARAMS:
- Language: ${language}
- Grammar topics (MUST use these): ${grammarTopics.join(", ")}
- Difficulty (CEFR): ${difficulty}
${topicHint}

QUESTION TYPES - generate each according to its schema:
${typeInstructions}

OUTPUT: Return ONLY valid JSON. No markdown, no explanation.
{
  "title": "string",
  "questions": [
    { "type": "multiple", "text": "...", "options": ["A","B","C","D"], "correctIndices": [0,2], "grammarTopic": "...", "explanation": "..." },
    { "type": "unique", "text": "...", "options": ["A","B","C","D"], "correctIndex": 1, "grammarTopic": "...", "explanation": "..." },
    { "type": "fillInBlank", "text": "She _____ to school.", "options": ["goes","go","going","gone"], "correctIndex": 0, "grammarTopic": "...", "explanation": "..." },
    { "type": "translateText", "text": "Texto en español", "correctAnswer": "Translation in exam language", "grammarTopic": "...", "explanation": "..." }
  ]
}

RULES:
- Each question has "type" matching the requested type
- Distribute grammar topics across questions
- Match vocabulary and structures to ${difficulty} level
- explanation: brief, pedagogical, in ${language}

CRITICAL - UNIQUENESS:
- Each question must be clearly different from the others. No duplicate or near-duplicate questions.
- Use varied contexts, vocabulary, and sentence structures. Avoid repeating the same grammar point with the same wording.

CRITICAL - COHERENCE BETWEEN QUESTION AND OPTIONS:
- The question text and options MUST be tightly linked. The blank or question must directly test what the options offer.
- Options must fit the grammatical context. Never use options that are unrelated to the question.

CRITICAL - SINGLE CHOICE (unique, fillInBlank):
- EXACTLY ONE option is correct. The other 3 MUST be grammatically wrong when inserted/selected.
- Distractors = plausible learner errors: forms a learner might try (e.g. "go" instead of "goes") but that make the sentence INCORRECT. They test the specific grammar point.
- BAD: 4 options that could all work in different contexts. GOOD: 1 correct + 3 wrong forms (wrong tense, wrong agreement, wrong structure).
- Example fillInBlank "She _____ to school": correct "goes"; wrong "go" (no -s), "going" (needs auxiliary), "gone" (past participle wrong). All wrong options are plausible mistakes but clearly incorrect.

CRITICAL - ASPECT/NUANCE GRAMMAR TOPICS (e.g. simple past vs past continuous, present perfect vs simple past, simple vs continuous forms):
- For these topics, more than one tense/aspect can be grammatically valid in an underspecified sentence (e.g. "When I _____ the article, I realized my mistake" - both "read" and "was reading" are grammatical, just different nuance). This is NOT a valid single-choice question as-is.
- You MUST add disambiguating context (a time marker, a second clause, an adverb, an interrupting action, a duration phrase) so that ONLY ONE option is correct in that specific sentence. Do not rely on the blank alone to force a single answer.
- Example: instead of "When I _____ the article, I realized my mistake" use "I _____ the article for ten minutes when the phone suddenly rang" (forces past continuous) or "As soon as I _____ the article, I closed the book" (forces simple past).
- Before finalizing such a question, double-check mentally that each distractor, if inserted, would actually sound wrong/ungrammatical to a native speaker given the added context - not just "less natural" or "a different nuance".

CRITICAL - MULTIPLE CHOICE (multiple):
- Use correctIndices (array), never correctIndex. At least 2 correct options.
- The 2+ correct options must BOTH be valid answers to the question.
- Wrong options must be clearly incorrect - not alternatives that could also work.

CRITICAL - translateText: text ALWAYS in Spanish. correctAnswer ALWAYS in ${language}. User translates Spanish → ${language}.`,
    user: `Generate ${questionCount} questions in ${language} for level ${difficulty}. Types: ${typesList}. Grammar: ${grammarTopics.join(", ")}.`,
  };
};
