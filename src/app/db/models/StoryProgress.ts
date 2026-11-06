import mongoose, { Schema } from "mongoose";
import { IStoryProgress } from "../../../../types/models";

const storyProgressSchema = new Schema<IStoryProgress>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    storyId: { type: Schema.Types.ObjectId, ref: "Story", required: true },
    currentChapter: { type: Number, default: 0 },
    completedChapters: { type: [Number], default: [] },
    lastReadAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

storyProgressSchema.index({ userId: 1, storyId: 1 }, { unique: true });

const StoryProgress = mongoose.model<IStoryProgress>("StoryProgress", storyProgressSchema);

export default StoryProgress;
