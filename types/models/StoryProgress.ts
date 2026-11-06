import { Document, Types } from "mongoose";

export interface IStoryProgress extends Document {
  userId: Types.ObjectId;
  storyId: Types.ObjectId;
  currentChapter: number;
  completedChapters: number[];
  lastReadAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
