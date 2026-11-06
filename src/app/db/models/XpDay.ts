import mongoose, { Schema } from "mongoose";
import { IXpDay } from "../../../../types/models";

/** XP earned on one day: the daily goal now, a study calendar later. */
const XpDaySchema = new Schema<IXpDay>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    day: { type: String, required: true },
    xp: { type: Number, default: 0 },
  },
  { timestamps: true },
);

XpDaySchema.index({ userId: 1, day: 1 }, { unique: true });

export default mongoose.model<IXpDay>("XpDay", XpDaySchema);
