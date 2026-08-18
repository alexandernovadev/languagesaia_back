import mongoose, { Schema } from "mongoose";
import { IExamAttempt } from "../../../../types/models";

const attemptQuestionSchema = new Schema(
  {
    questionIndex: { type: Number, required: true },
    questionText: { type: String, required: true },
    questionType: { type: String, required: true, enum: ["multiple", "unique", "fillInBlank", "translateText"] },
    options: [{ type: String }],
    correctIndex: { type: Number },
    correctIndices: [{ type: Number }],
    correctAnswer: { type: String },
    grammarTopic: { type: String },
    userAnswer: { type: Schema.Types.Mixed, required: true },
    isCorrect: { type: Boolean, required: true },
    partialScore: { type: Number },
    isPartial: { type: Boolean },
    aiFeedback: { type: String },
    chat: [
      {
        role: { type: String, required: true },
        content: { type: String, required: true },
      },
    ],
  },
  { _id: false }
);

const examAttemptSchema = new Schema<IExamAttempt>(
  {
    examId: { type: Schema.Types.ObjectId, ref: "Exam", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    score: { type: Number, required: true },
    startedAt: { type: Date, required: true },
    completedAt: { type: Date, required: true },
    attemptQuestions: [attemptQuestionSchema],
  },
  { timestamps: true }
);

examAttemptSchema.index({ userId: 1 });
examAttemptSchema.index({ examId: 1 });

export default mongoose.model<IExamAttempt>("ExamAttempt", examAttemptSchema);
