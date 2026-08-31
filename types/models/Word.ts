import { Document } from "mongoose";
import { ChatMessage } from "./ChatMessage";
import { Difficulty, Language } from "../business";

export interface IWord extends Document {
  word: string;
  wordKey?: string;
  definition: string;
  examples?: string[];
  type?: string[];
  IPA?: string;
  seen?: number;
  img?: string;
  difficulty?: Difficulty;
  synonyms?: string[];
  codeSwitching?: string[];
  language: Language;
  spanish?: {
    definition: string;
    word: string;
  };
  chat?: ChatMessage[];
  createdAt?: Date;
  updatedAt?: Date;
}
