import mongoose, { Schema } from "mongoose";
import { IWordForm } from "../../../../types/models";

/** What a written form means, like "boxes". The AI explains each form once, for everyone. */
const WordFormSchema = new Schema<IWordForm>(
  {
    language: { type: String, required: true },
    form: { type: String, required: true },
    lemma: { type: String, required: true },
    translation: { type: String, default: "" },
    ipa: { type: String, default: "" },
  },
  { timestamps: true },
);

WordFormSchema.index({ language: 1, form: 1 }, { unique: true });

export default mongoose.model<IWordForm>("WordForm", WordFormSchema);
