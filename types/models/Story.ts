import { Document } from "mongoose";
import { CertificationLevel, StoryGenre, Language } from "../business";

export interface IChapter {
  order: number;
  title: string;
  content: string;
  urlAudio?: string;
  audioRecordId?: string;
  voice?: string;
  audioAlignment?: { word: string; start: number; end: number }[];
  targetVocabulary?: string[];
  targetGrammar?: string[];
  createdAt: Date;
}

export interface IStory extends Document {
  title: string;
  description: string;
  img: string;
  languageLevel: CertificationLevel;
  language: Language;
  genre: StoryGenre;
  chapters: IChapter[];
  userId: string;
  createdAt?: Date;
  updatedAt?: Date;
}
