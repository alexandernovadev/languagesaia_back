import mongoose, { Schema } from "mongoose";
import { IExercise } from "../../../../types/models";
import { certificationLevelsList } from "../../data/business/shared";

/** What an exercise is made of. Lessons embed the same fields. */
export const exerciseFields = {
  type: { type: String, required: true, enum: ["choice", "fillBlank", "order", "translate", "match", "findError"] },
  prompt: { type: String, required: true },
  grammarTopic: { type: String },
  explanation: { type: String },
  options: [{ type: String }],
  answerIndex: { type: Number },
  tokens: [{ type: String }],
  answerTokens: [{ type: String }],
  altAnswers: [{ type: String }],
  reference: { type: String },
  pairs: [{ left: { type: String }, right: { type: String }, _id: false }],
  errorIndex: { type: Number },
  correction: { type: String },
};

/**
 * The exercise bank: every exercise that passed the AI review, ready to reuse
 * so the AI doesn't have to write it again. Shared by all users; who has seen
 * what comes from their lessons.
 */
const exerciseSchema = new Schema<IExercise>(
  {
    ...exerciseFields,
    language: { type: String, required: true },
    explainsLanguage: { type: String, required: true },
    level: { type: String, required: true, enum: certificationLevelsList },
    /** A learner flagged it as wrong: it's never served again. */
    reported: { type: Boolean, default: false },
  },
  { timestamps: true },
);

exerciseSchema.index({ language: 1, explainsLanguage: 1, prompt: 1 }, { unique: true });
exerciseSchema.index({ language: 1, explainsLanguage: 1, level: 1, grammarTopic: 1 });

export default mongoose.model<IExercise>("Exercise", exerciseSchema);
