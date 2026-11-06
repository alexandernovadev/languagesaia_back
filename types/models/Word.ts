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
  synonyms?: string[];
  codeSwitching?: string[];
  rank?: number;
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
