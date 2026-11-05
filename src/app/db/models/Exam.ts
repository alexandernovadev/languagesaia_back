import mongoose, { Schema } from "mongoose";
import { IExam } from "../../../../types/models";
import { certificationLevelsList } from "../../data/business/shared";

const questionSchema = new Schema(
  {
    type: { type: String, required: true, enum: ["choice", "fillBlank", "order", "translate", "match", "findError"] },
    prompt: { type: String, required: true },
    grammarTopic: { type: String },
    explanation: { type: String },
    options: [{ type: String }],
    answerIndex: { type: Number },
    tokens: [{ type: String }],
    answerTokens: [{ type: String }],
    reference: { type: String },
    pairs: [{ left: { type: String }, right: { type: String }, _id: false }],
    errorIndex: { type: Number },
    correction: { type: String },
  },
  { _id: false },
);

const examSchema = new Schema<IExam>(
  {
    title: { type: String, required: true },
    mode: { type: String, required: true, enum: ["quick", "topic", "mistakes"] },
    language: { type: String, required: true },
    level: { type: String, required: true, enum: certificationLevelsList },
    grammarTopics: [{ type: String }],
    questions: [questionSchema],
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

export default mongoose.model<IExam>("Exam", examSchema);
