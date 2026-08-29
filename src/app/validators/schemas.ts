import { z } from "zod";
import { Response } from "express";
import {
  languagesList,
  difficultyList,
  wordTypesList,
  certificationLevelsList,
  expressionTypesList,
  readingTypesList,
  storyGenresList,
} from "../data/business/shared";
import { errorResponse } from "../utils/responseHelpers";

// Cast helpers for z.enum (requires non-empty tuple)
const langEnum = languagesList as [string, ...string[]];
const difficultyEnum = difficultyList as [string, ...string[]];
const wordTypesEnum = wordTypesList as [string, ...string[]];
const certLevelsEnum = certificationLevelsList as [string, ...string[]];
const expressionTypesEnum = expressionTypesList as [string, ...string[]];
const readingTypesEnum = readingTypesList as [string, ...string[]];
const storyGenresEnum = storyGenresList as [string, ...string[]];

// ─── Word ────────────────────────────────────────────────────────────────────

export const WordCreateSchema = z.object({
  word: z.string().min(1).max(100),
  language: z.enum(langEnum),
  definition: z.string().min(5).max(1000),
  examples: z.array(z.string()).optional(),
  synonyms: z.array(z.string()).optional(),
  type: z.array(z.enum(wordTypesEnum)).optional(),
  IPA: z.string().optional(),
  difficulty: z.enum(difficultyEnum).optional(),
  codeSwitching: z.array(z.string()).optional(),
  spanish: z
    .object({
      definition: z.string().min(5).max(1000).optional(),
      word: z.string().min(1).max(100).optional(),
    })
    .optional(),
});

export const WordUpdateSchema = WordCreateSchema.partial();

// ─── Lecture ─────────────────────────────────────────────────────────────────

export const LectureCreateSchema = z.object({
  time: z.number({ coerce: true }).positive(),
  difficulty: z.enum(certLevelsEnum),
  typeWrite: z.enum(readingTypesEnum),
  language: z.enum(langEnum),
  urlAudio: z.string().optional(),
  img: z.string().optional(),
  content: z.string().min(1),
});

export const LectureUpdateSchema = LectureCreateSchema.partial();

// ─── Expression ──────────────────────────────────────────────────────────────

export const ExpressionCreateSchema = z.object({
  expression: z.string().min(1).max(200),
  language: z.string().min(1),
  definition: z.string().min(5).max(1000),
  examples: z.array(z.string()).optional(),
  type: z.array(z.enum(expressionTypesEnum)).optional(),
  context: z.string().max(500).optional(),
  img: z.string().optional(),
  difficulty: z.enum(difficultyEnum).optional(),
  spanish: z
    .object({
      definition: z.string().min(5).max(1000).optional(),
      expression: z.string().min(1).max(200).optional(),
    })
    .optional(),
});

export const ExpressionUpdateSchema = ExpressionCreateSchema.partial();

// ─── Exam ─────────────────────────────────────────────────────────────────────

const ExamQuestionSchema = z.object({
  id: z.string().optional(),
  type: z.enum(["multiple", "unique", "fillInBlank", "translateText"]),
  text: z.string().min(1),
  options: z.array(z.string()).optional(),
  correctIndex: z.number().optional(),
  correctIndices: z.array(z.number()).optional(),
  correctAnswer: z.string().optional(),
  grammarTopic: z.string().min(1),
  explanation: z.string().min(1),
});

export const ExamCreateSchema = z.object({
  title: z.string().min(1),
  language: z.enum(langEnum),
  difficulty: z.enum(certLevelsEnum),
  grammarTopics: z.array(z.string()).optional(),
  topic: z.string().optional(),
  questions: z.array(ExamQuestionSchema).optional(),
});

export const ExamGenerateSchema = z.object({
  grammarTopics: z.array(z.string()).min(1, "At least one grammar topic required"),
  difficulty: z.enum(certLevelsEnum),
  questionCount: z.number({ coerce: true }).int().positive().max(50),
  questionTypes: z.array(z.string()).optional(),
  topic: z.string().optional(),
  language: z.string().optional(),
});

// ─── Story ─────────────────────────────────────────────────────────────────────

export const StoryCreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  img: z.string().optional(),
  languageLevel: z.enum(certLevelsEnum),
  genre: z.enum(storyGenresEnum),
});

export const StoryUpdateSchema = StoryCreateSchema.partial();

export const StoryIdeaSchema = z.object({
  seed: z.string().max(2000).optional(),
  genre: z.enum(storyGenresEnum).optional(),
  languageLevel: z.enum(certLevelsEnum).optional(),
});

export const ChapterGenerateSchema = z.object({
  instructions: z.string().max(2000).optional(),
  requestEnding: z.boolean().optional(),
  targetVocabulary: z.array(z.string()).max(20).optional(),
  targetGrammar: z.array(z.string()).optional(),
});

export const ChapterSaveSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  targetVocabulary: z.array(z.string()).max(20).optional(),
  targetGrammar: z.array(z.string()).optional(),
});

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Parses and strips unknown fields from req.body.
 * Returns the validated data, or sends a 400 and returns null.
 */
export function parseBody<T>(
  schema: z.ZodSchema<T>,
  body: unknown,
  res: Response
): T | null {
  const result = schema.safeParse(body);
  if (!result.success) {
    const message = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    errorResponse(res, message, 400);
    return null;
  }
  return result.data;
}
