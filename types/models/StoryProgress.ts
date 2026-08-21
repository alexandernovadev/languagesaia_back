import { Document } from "mongoose";

export interface IStoryProgress extends Document {
  userId: string;
  storyId: string;
  currentChapter: number;
  completedChapters: number[];
  lastReadAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
