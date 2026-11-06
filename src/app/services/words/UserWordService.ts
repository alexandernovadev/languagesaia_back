/**
 * A user's list of words. Word is the shared dictionary; everything personal
 * (difficulty, seen, chat, review schedule) is a UserWord.
 */
import { Types } from "mongoose";
import UserWord from "../../db/models/UserWord";
import { IWord } from "../../../../types/models";

export const toObjectId = (id: string | Types.ObjectId) => new Types.ObjectId(String(id));

/** Aggregation stages: from UserWords to words carrying the learner's own data. */
export const joinWord = [
  { $lookup: { from: "words", localField: "wordId", foreignField: "_id", as: "word" } },
  { $unwind: "$word" },
  {
    $replaceRoot: {
      newRoot: { $mergeObjects: ["$word", { difficulty: "$difficulty", seen: "$seen", chat: "$chat", addedAt: "$createdAt" }] },
    },
  },
];

/** A dictionary word with this learner's data on top. */
export const withProgress = (word: any, mine?: any) => ({
  ...(word?.toObject?.() ?? word),
  difficulty: mine?.difficulty ?? "hard",
  seen: mine?.seen ?? 0,
  chat: mine?.chat ?? [],
  review: mine?.review,
});

export class UserWordService {
  find(userId: string, wordId: string) {
    return UserWord.findOne({ userId, wordId });
  }

  /** Adds a word to the list. Does nothing if it's already there. */
  add(userId: string, word: Pick<IWord, "_id" | "language">) {
    return UserWord.findOneAndUpdate(
      { userId, wordId: word._id },
      { $setOnInsert: { language: word.language } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }

  setDifficulty(userId: string, wordId: string, difficulty: string) {
    return UserWord.findOneAndUpdate({ userId, wordId }, { difficulty }, { new: true, runValidators: true });
  }

  incrementSeen(userId: string, wordId: string) {
    return UserWord.findOneAndUpdate({ userId, wordId }, { $inc: { seen: 1 } }, { new: true });
  }

  countByLanguage(userId: string): Promise<Array<{ language: string; count: number }>> {
    return UserWord.aggregate([
      { $match: { userId: toObjectId(userId) } },
      { $group: { _id: "$language", count: { $sum: 1 } } },
      { $project: { _id: 0, language: "$_id", count: 1 } },
    ]);
  }
}

export default new UserWordService();
