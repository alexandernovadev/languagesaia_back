import { Document } from "mongoose";
import { CertificationLevel, StoryGenre } from "../business";

export interface IChapter {
  order: number;
  title: string;
  content: string;
  urlAudio?: string;
  audioRecordId?: string;
  voice?: string;
  targetVocabulary?: string[];
  targetGrammar?: string[];
  createdAt: Date;
}

export interface IStory extends Document {
  title: string;
  description: string;
  img: string;
  languageLevel: CertificationLevel;
  genre: StoryGenre;
  chapters: IChapter[];
  userId: string;
  createdAt?: Date;
  updatedAt?: Date;
}
