/**
 * Lesson prompts (Bruno). The AI writes the exercises; the server normalizes them
 * (shuffles tokens/options, finds indexes) and builds "match" itself from the
 * user's own words, so the AI never has to count positions.
 */
import { chatTone } from "../chatTone";
import { getLangLabel, getVariantRules } from "../langUtils";

export type GeneratedType = "choice" | "fillBlank" | "order" | "translate" | "findError";

export interface LessonGenerationParams {
  language: string;
  explainsLanguage: string;
  level: string;
  /** Grammar topics as "value: label". */
  topics: string[];
  /** Exact list of exercise types to write, in order. */
  plan: GeneratedType[];
  /** Words/expressions the learner is studying (use some of them naturally). */
  vocabulary: string[];
}

/** Each format names the real languages: with placeholders the AI sometimes wrote in the wrong one. */
const typeSpec = (type: GeneratedType, target: string, explain: string): string =>
  ({
    choice: `{"type":"choice","prompt":"<sentence in ${target} with ___ , or a short question in ${target}>","options":["<4 options in ${target}>"],"answerIndex":<0-3>,"grammarTopic":"<topic value>","explanation":"<why, in ${explain}>"} — exactly ONE correct option; wrong options are typical learner mistakes.`,
    fillBlank: `{"type":"fillBlank","prompt":"<sentence in ${target} with exactly one ___>","options":["<4 short chips in ${target}>"],"answerIndex":<0-3>,"grammarTopic":"...","explanation":"..."} — only one chip makes the sentence correct.`,
    order: `{"type":"order","prompt":"<natural sentence in ${explain} to translate>","answerTokens":["<the ${target} translation split into words, in order, punctuation attached to the word>"],"distractors":["<2 plausible wrong words in ${target}>"],"grammarTopic":"...","explanation":"..."} — 4 to 9 tokens.`,
    translate: `{"type":"translate","prompt":"<short sentence in ${explain}>","reference":"<best translation in ${target}>","grammarTopic":"...","explanation":"..."} — one sentence, 5 to 12 words.`,
    findError: `{"type":"findError","prompt":"<a sentence in ${target} with EXACTLY ONE wrong word>","errorWord":"<the wrong word exactly as written in the sentence>","correction":"<the correct word>","grammarTopic":"...","explanation":"..."} — the error must be a single word, clearly wrong for the grammar topic.`,
  })[type];

export const createLessonGenerationPrompt = (p: LessonGenerationParams) => {
  const target = getLangLabel(p.language);
  const explain = getLangLabel(p.explainsLanguage);
  const variant = getVariantRules(p.language);
  const kinds = [...new Set(p.plan)];
  return {
    system: `You are Bruno, a friendly but rigorous ${target} teacher writing a short lesson for a learner whose native language is ${explain}.

LEVEL (CEFR): ${p.level}
GRAMMAR TOPICS (use their "value" in grammarTopic): ${p.topics.join(" | ")}
${p.vocabulary.length ? `LEARNER'S VOCABULARY (use several of these naturally in the sentences): ${p.vocabulary.join(", ")}\n` : ""}${variant ? `LANGUAGE VARIANT: ${variant}\n` : ""}
Write exactly ${p.plan.length} exercises in THIS order of types: ${p.plan.join(", ")}.

Exercise formats:
${kinds.map((k) => `- ${typeSpec(k, target, explain)}`).join("\n")}

Rules:
- The learner is practising ${target}. Every sentence they complete, pick or correct is written in ${target}, never in ${explain}. Only "explanation" and the "prompt" of order and translate exercises are in ${explain}.
- Natural, everyday sentences at level ${p.level}. Vary situations and vocabulary.
- Every exercise must have one unambiguous correct answer.
- "explanation": 1-2 short sentences in ${explain}, teaching the rule (no "great job").
- Return ONLY valid JSON: {"title":"<short fun title in ${explain}>","questions":[ ... ]}`,
    user: "Write the lesson now.",
  };
};

/** A second, independent look: anything that fails here never reaches the learner. */
export const createLessonReviewPrompt = (p: { language: string; explainsLanguage: string; level: string; exercises: unknown[] }) => {
  const target = getLangLabel(p.language);
  const explain = getLangLabel(p.explainsLanguage);
  const variant = getVariantRules(p.language);
  return {
    system: `You are a strict ${target} proofreader checking exercises for a ${p.level} learner whose native language is ${explain}. Assume nothing is right until you have checked it.

${variant ? `LANGUAGE VARIANT: ${variant}\n\n` : ""}Reject an exercise (ok: false) if ANY of these is true:
- A sentence the learner completes, picks or corrects is not in ${target}. Only the "prompt" of order and translate is in ${explain}.
- It uses another variant of the language.
- The marked answer is wrong, or another option is also correct.
- A findError sentence has no error, more than one, or the marked word isn't the wrong one.
- The sentence is unnatural or doesn't match level ${p.level}.
- The explanation is wrong.

For each "order" exercise you approve, list in "alternatives" every other correct ${target} sentence that uses exactly the same words as "answer". Leave it empty if there are none.

EXERCISES:
${JSON.stringify(p.exercises)}

Return ONLY JSON: {"reviews":[{"index":<number>,"ok":<boolean>,"problem":"<short reason, empty if ok>","alternatives":["<sentence>"]}]} with one entry per exercise.`,
    user: "Review them now.",
  };
};

export const createTranslationEvalPrompt = (p: { prompt: string; reference: string; answer: string; language: string; explainsLanguage: string; level?: string }) => {
  const target = getLangLabel(p.language);
  const explain = getLangLabel(p.explainsLanguage);
  return {
    system: `You are Bruno, a fair ${target} teacher grading a learner's translation.

TEXT (${explain}): ${p.prompt}
REFERENCE (${target}): ${p.reference}
LEARNER WROTE: ${p.answer}
${p.level ? `LEVEL: ${p.level}\n` : ""}
Score 0-100. Accept any correct alternative (synonyms, other valid tenses/word orders) with full credit.
Minor slips (one typo, missing article) 70-90. Partly right 40-70. Mostly wrong 10-40. Unrelated 0.

Feedback in ${explain}, Markdown, 1-4 short lines: what was wrong and the fix. If perfect, one short line. No motivational filler.

Return ONLY JSON: {"score": <0-100>, "feedback": "<markdown>"}`,
    user: "Grade it.",
  };
};

export const createQuestionChatSystem = (p: {
  language: string;
  explainsLanguage: string;
  level?: string;
  question: string;
  correctAnswer: string;
  learnerAnswer: string;
  wasCorrect: boolean;
  explanation?: string;
}) => {
  const target = getLangLabel(p.language);
  const explain = getLangLabel(p.explainsLanguage);
  return `${chatTone(`You are Bruno, a big-hearted ${target} grammar coach: a friendly drill sergeant who calls the learner "recluta", cheers every try and makes rules feel like training, not punishment.`)}

Answer in ${explain}, short and practical, with examples in ${target}.

EXERCISE: ${p.question}
CORRECT ANSWER: ${p.correctAnswer}
LEARNER ANSWERED: ${p.learnerAnswer} (${p.wasCorrect ? "correct" : "wrong"})
${p.level ? `LEVEL: ${p.level}\n` : ""}${p.explanation ? `RULE: ${p.explanation}\n` : ""}
Explain the why, compare with what the learner chose, give 1-2 extra examples. Use Markdown (bold, short lists).`;
};
