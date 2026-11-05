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
export type ExamQuestionType = "choice" | "fillBlank" | "order" | "translate" | "match" | "findError";
export type ExamMode = "quick" | "topic" | "mistakes";

export interface IExamQuestion {
  type: ExamQuestionType;
  /** What the learner reads (instruction / sentence / Spanish text to translate). */
  prompt: string;
  grammarTopic?: string;
  explanation?: string;
  options?: string[];
  answerIndex?: number;
  tokens?: string[];
  answerTokens?: string[];
  reference?: string;
  pairs?: Array<{ left: string; right: string }>;
  errorIndex?: number;
  correction?: string;
}

export interface IExam extends Document {
  title: string;
  mode: ExamMode;
  language: string;
  level: string;
  grammarTopics: string[];
  questions: IExamQuestion[];
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
  chat?: Array<{ role: "user" | "assistant"; content: string }>;
}

export interface IExamAttempt extends Document {
  examId: Types.ObjectId;
  userId: Types.ObjectId;
  language: string;
  answers: IAttemptAnswer[];
  score?: number;
  xp?: number;
  completedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
