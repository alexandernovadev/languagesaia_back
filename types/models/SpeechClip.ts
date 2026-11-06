import { Document } from "mongoose";

export interface ISpeechClip extends Document {
  language: string;
  key: string;
  text: string;
  url: string;
}
