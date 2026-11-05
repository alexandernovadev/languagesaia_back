import mongoose, { Schema } from "mongoose";
import { ILesson } from "../../../../types/models";
import { certificationLevelsList } from "../../data/business/shared";
import { exerciseFields } from "./Exercise";

const questionSchema = new Schema(
  {
    ...exerciseFields,
    /** Its entry in the bank. "match" exercises aren't in the bank. */
    exerciseId: { type: Schema.Types.ObjectId, ref: "Exercise" },
  },
  { _id: false },
);

const lessonSchema = new Schema<ILesson>(
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

export default mongoose.model<ILesson>("Lesson", lessonSchema);
