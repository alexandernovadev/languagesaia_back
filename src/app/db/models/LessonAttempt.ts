import mongoose, { Schema } from "mongoose";
import { ILessonAttempt } from "../../../../types/models";

const answerSchema = new Schema(
  {
    index: { type: Number, required: true },
    answer: { type: Schema.Types.Mixed },
    correct: { type: Boolean, required: true },
    score: { type: Number, required: true, min: 0, max: 1 },
    feedback: { type: String },
    reported: { type: Boolean },
    chat: [{ role: { type: String, enum: ["user", "assistant"] }, content: { type: String }, _id: false }],
  },
  { _id: false },
);

const attemptSchema = new Schema<ILessonAttempt>(
  {
    lessonId: { type: Schema.Types.ObjectId, ref: "Lesson", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    language: { type: String, required: true },
    answers: [answerSchema],
    score: { type: Number },
    xp: { type: Number },
    completedAt: { type: Date },
    abandonedAt: { type: Date },
  },
  { timestamps: true },
);

attemptSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model<ILessonAttempt>("LessonAttempt", attemptSchema);
