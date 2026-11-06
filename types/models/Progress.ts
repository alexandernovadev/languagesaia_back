import { Document, Types } from "mongoose";

export interface IProgress extends Document {
  userId: Types.ObjectId;
  xp: number;
  streak: number;
  bestStreak: number;
  freezes: number;
  /** Last day the goal was met, as YYYY-MM-DD in the learner's time zone. */
  lastGoalDay?: string;
}

export interface IXpDay extends Document {
  userId: Types.ObjectId;
  /** YYYY-MM-DD in the learner's time zone. */
  day: string;
  xp: number;
}
