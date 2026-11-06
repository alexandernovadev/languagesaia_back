import { Document } from "mongoose";

export interface IWordForm extends Document {
  language: string;
  form: string;
  lemma: string;
  translation: string;
  ipa: string;
}
