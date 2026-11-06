import mongoose, { Schema } from "mongoose";
import { ChatMessage, IUserWord } from "../../../../types/models";
import { chatRolesList, difficultyList, languagesList } from "../../data/business/shared";

const ChatMessageSchema = new Schema<ChatMessage>({
  id: { type: String, required: true },
  role: { type: String, enum: chatRolesList, required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

/** Spaced repetition. A word without `dueAt` hasn't entered the schedule yet. */
const ReviewSchema = new Schema(
  {
    dueAt: { type: Date },
    intervalDays: { type: Number },
    ease: { type: Number },
    reps: { type: Number },
    lapses: { type: Number },
    firstReviewedAt: { type: Date },
    lastReviewedAt: { type: Date },
  },
  { _id: false },
);

/**
 * A word in someone's list: everything that belongs to the learner. The word
 * itself (definition, examples, picture) is shared and lives in Word.
 */
const UserWordSchema = new Schema<IUserWord>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    wordId: { type: Schema.Types.ObjectId, ref: "Word", required: true },
    language: { type: String, required: true, enum: languagesList },
    difficulty: { type: String, enum: difficultyList, default: "hard" },
    seen: { type: Number, default: 0 },
    chat: { type: [ChatMessageSchema], default: [] },
    review: { type: ReviewSchema },
  },
  { timestamps: true },
);

UserWordSchema.index({ userId: 1, wordId: 1 }, { unique: true });
UserWordSchema.index({ userId: 1, language: 1, difficulty: 1 });
UserWordSchema.index({ userId: 1, language: 1, "review.dueAt": 1 });

export default mongoose.model<IUserWord>("UserWord", UserWordSchema);
