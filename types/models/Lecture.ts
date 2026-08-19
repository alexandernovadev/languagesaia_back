import { Document } from "mongoose";
import { CertificationLevel, Language } from "../business";

export interface ILecture extends Document {
  time: number;
  difficulty: CertificationLevel;
  typeWrite: string;
  language: Language;
  img?: string;
  urlAudio?: string;
  audioRecordId?: string;
  voice?: string;
  content: string;
  createdAt?: Date;
  updatedAt?: Date;
}
