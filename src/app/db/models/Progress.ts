import mongoose, { Schema } from "mongoose";
import { IProgress } from "../../../../types/models";

/** A learner's XP and streak, the same across languages. */
const ProgressSchema = new Schema<IProgress>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    xp: { type: Number, default: 0 },
    streak: { type: Number, default: 0 },
    bestStreak: { type: Number, default: 0 },
    freezes: { type: Number, default: 0 },
    lastGoalDay: { type: String },
  },
  { timestamps: true },
);

export default mongoose.model<IProgress>("Progress", ProgressSchema);
