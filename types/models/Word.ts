import { Document } from "mongoose";
import { Language } from "../business";

export interface IWord extends Document {
  word: string;
  wordKey?: string;
  definition: string;
  examples?: string[];
  type?: string[];
  IPA?: string;
  img?: string;
  audio?: string;
  synonyms?: string[];
  codeSwitching?: string[];
  rank?: number;
  /** When the AI filled in what a lean dictionary word was missing. */
  completedAt?: Date;
  hiddenAt?: Date;
  conjugations?: Record<string, Record<string, string>>;
  source?: string;
  reviewNotes?: string[];
  language: Language;
  spanish?: {
    definition: string;
    word: string;
  };
  createdAt?: Date;
  updatedAt?: Date;
}
