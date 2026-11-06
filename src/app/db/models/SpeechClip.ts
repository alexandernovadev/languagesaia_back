import mongoose, { Schema } from "mongoose";
import { ISpeechClip } from "../../../../types/models";

/** A sentence or expression already recorded. The same text is never paid for twice. */
const SpeechClipSchema = new Schema<ISpeechClip>(
  {
    language: { type: String, required: true },
    /** Hash of the text: two words sharing an example share its recording. */
    key: { type: String, required: true },
    text: { type: String, required: true },
    url: { type: String, required: true },
  },
  { timestamps: true },
);

SpeechClipSchema.index({ language: 1, key: 1 }, { unique: true });

export default mongoose.model<ISpeechClip>("SpeechClip", SpeechClipSchema);
