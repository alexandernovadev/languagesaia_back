import { Document, Types } from "mongoose";
import { ChatMessage } from "./ChatMessage";
import { Difficulty, Language } from "../business";

export interface IWordReview {
  dueAt?: Date;
  intervalDays?: number;
  ease?: number;
  reps?: number;
  lapses?: number;
  firstReviewedAt?: Date;
  lastReviewedAt?: Date;
}

export interface IUserWord extends Document {
  userId: Types.ObjectId;
  wordId: Types.ObjectId;
  language: Language;
  difficulty: Difficulty;
  seen: number;
  chat: ChatMessage[];
  review?: IWordReview;
  createdAt?: Date;
  updatedAt?: Date;
}
