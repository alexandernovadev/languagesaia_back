import { Document, Types } from "mongoose";
import { CertificationLevel, StoryGenre, Language } from "../business";

export interface IChapter {
  order: number;
  title: string;
  content: string;
  img?: string;
  urlAudio?: string;
  audioRecordId?: string;
  voice?: string;
  audioAlignment?: { word: string; start: number; end: number }[];
  summary?: string;
  idea?: string;
  phrases?: { text: string; base: string; type: string; meaning: string; sentence: string }[];
  targetVocabulary?: string[];
  questions?: { question: string; options: string[]; answer: number }[];
  createdAt: Date;
}

export interface IStory extends Document {
  title: string;
  description: string;
  img: string;
  languageLevel: CertificationLevel;
  language: Language;
  genre: StoryGenre;
  protagonist: string;
  visualGuide?: string;
  totalChapters: number;
  chapters: IChapter[];
  userId: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}
