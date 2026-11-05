import { Document, Types } from "mongoose";

/**
 * Exercise types (phase 1). Duolingo-style, answered one by one.
 * - choice     pick the right option (answerIndex)
 * - fillBlank  sentence with "___", tap the right chip (answerIndex)
 * - order      build the sentence from shuffled tokens (answerTokens, tokens include distractors)
 * - translate  free translation, graded by AI with partial score (reference)
 * - match      pair words with their translation (pairs) — built from the user's own words
 * - findError  tap the wrong word in a sentence (tokens, errorIndex, correction)
 */
export type LessonQuestionType = "choice" | "fillBlank" | "order" | "translate" | "match" | "findError";
export type LessonMode = "quick" | "topic" | "mistakes";

export interface ILessonQuestion {
  type: LessonQuestionType;
  /** What the learner reads (instruction / sentence / Spanish text to translate). */
  prompt: string;
  grammarTopic?: string;
  explanation?: string;
  options?: string[];
  answerIndex?: number;
  tokens?: string[];
  answerTokens?: string[];
  /** Other correct sentences for "order", normalized. */
  altAnswers?: string[];
  reference?: string;
  pairs?: Array<{ left: string; right: string }>;
  errorIndex?: number;
  correction?: string;
  /** Its entry in the exercise bank. */
  exerciseId?: Types.ObjectId;
}

/** An exercise in the bank, ready to reuse in any lesson of its language and level. */
export interface IExercise extends Omit<ILessonQuestion, "exerciseId">, Document {
  language: string;
  explainsLanguage: string;
  level: string;
  reported: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ILesson extends Document {
  title: string;
  mode: LessonMode;
  language: string;
  level: string;
  grammarTopics: string[];
  questions: ILessonQuestion[];
  createdBy?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IAttemptAnswer {
  index: number;
  answer: unknown;
  correct: boolean;
  /** 0–1 (translate can be partial). */
  score: number;
  feedback?: string;
  /** The learner flagged the exercise as wrong: it no longer counts. */
  reported?: boolean;
  chat?: Array<{ role: "user" | "assistant"; content: string }>;
}

export interface ILessonAttempt extends Document {
  lessonId: Types.ObjectId;
  userId: Types.ObjectId;
  language: string;
  answers: IAttemptAnswer[];
  score?: number;
  xp?: number;
  completedAt?: Date;
  /** Left unfinished and replaced by a new lesson. Its answers still count. */
  abandonedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
