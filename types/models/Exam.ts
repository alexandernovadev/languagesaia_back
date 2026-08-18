import { Document, Types } from "mongoose";
import { CertificationLevel, Language } from "../business";

export type ExamQuestionType = "multiple" | "unique" | "fillInBlank" | "translateText";

export interface IExamQuestion {
  id?: string;
  type: ExamQuestionType;
  text: string;
  options?: string[];
  correctIndex?: number;
  correctIndices?: number[];
  correctAnswer?: string;
  grammarTopic: string;
  explanation: string;
}

export interface IExam extends Document {
  title: string;
  language: Language;
  difficulty: CertificationLevel;
  grammarTopics: string[];
  topic?: string;
  questions: IExamQuestion[];
  createdBy?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IAttemptQuestion {
  questionIndex: number;
  questionText: string;
  questionType: ExamQuestionType;
  options?: string[];
  correctIndex?: number;
  correctIndices?: number[];
  correctAnswer?: string;
  grammarTopic?: string;
  userAnswer: number | number[] | string;
  isCorrect: boolean;
  partialScore?: number;
  isPartial?: boolean;
  aiFeedback?: string;
  chat: Array<{ role: string; content: string }>;
}

export interface IExamAttempt extends Document {
  examId: Types.ObjectId;
  userId: Types.ObjectId;
  score: number;
  startedAt: Date;
  completedAt: Date;
  attemptQuestions: IAttemptQuestion[];
  createdAt?: Date;
  updatedAt?: Date;
}
