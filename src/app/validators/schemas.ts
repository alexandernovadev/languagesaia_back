import { z } from "zod";
import { Response } from "express";
import {
  languagesList,
  difficultyList,
  wordTypesList,
  certificationLevelsList,
  expressionTypesList,
  storyGenresList,
} from "../data/business/shared";
import { errorResponse } from "../utils/responseHelpers";

// Cast helpers for z.enum (requires non-empty tuple)
const langEnum = languagesList as [string, ...string[]];
const difficultyEnum = difficultyList as [string, ...string[]];
const wordTypesEnum = wordTypesList as [string, ...string[]];
const certLevelsEnum = certificationLevelsList as [string, ...string[]];
const expressionTypesEnum = expressionTypesList as [string, ...string[]];
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

// ─── Lesson ──────────────────────────────────────────────────────────

export const LessonCreateSchema = z.object({
  mode: z.enum(["quick", "topic", "mistakes"]),
  level: z.enum(certLevelsEnum).optional(),
  grammarTopics: z.array(z.string()).optional(),
  count: z.coerce.number().int().min(3).max(20).optional(),
});

// ─── Story ─────────────────────────────────────────────────────────────────────

export const StoryCreateSchema = z.object({
  languageLevel: z.enum(certLevelsEnum),
  genre: z.enum(storyGenresEnum),
  totalChapters: z.union([z.literal(3), z.literal(6)]).default(6),
  theme: z.string().max(500).optional(),
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
