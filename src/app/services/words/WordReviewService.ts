/**
 * Spaced repetition: each answer decides when a word comes back. Each day
 * brings the overdue words, then a limited number of new ones.
 */
import UserWord from "../../db/models/UserWord";
import Word from "../../db/models/Word";
import { IWordReview } from "../../../../types/models";
import { MAX_INTERVAL_DAYS, MAX_NEW_CARDS_PER_DAY } from "../../../config/constants";
import { joinWord, toObjectId } from "./UserWordService";

export type ReviewAnswer = "again" | "hard" | "easy";
type User = { _id?: string; language?: string };

const START_EASE = 2.5;
const MIN_EASE = 1.3;
const DAY_MS = 24 * 60 * 60 * 1000;

const DIFFICULTY: Record<ReviewAnswer, string> = { again: "hard", hard: "medium", easy: "easy" };

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

/** Dates fall on midnight: an answer at night is due the next day, whatever the hour. */
export function nextSchedule(review: IWordReview | undefined, answer: ReviewAnswer, now: Date): IWordReview {
  const interval = review?.intervalDays ?? 0;
  const ease = review?.ease ?? START_EASE;

  const next = {
    again: { intervalDays: 1, ease: ease - 0.2 },
    hard: { intervalDays: Math.max(1, Math.round(interval * 1.2)), ease: ease - 0.15 },
    easy: { intervalDays: interval === 0 ? 3 : Math.max(interval + 1, Math.round(interval * ease)), ease },
  }[answer];
  const intervalDays = Math.min(next.intervalDays, MAX_INTERVAL_DAYS);

  return {
    dueAt: new Date(startOfDay(now).getTime() + intervalDays * DAY_MS),
    intervalDays,
    ease: Math.max(MIN_EASE, Number(next.ease.toFixed(2))),
    reps: (review?.reps ?? 0) + 1,
    lapses: (review?.lapses ?? 0) + (answer === "again" ? 1 : 0),
    firstReviewedAt: review?.firstReviewedAt ?? now,
    lastReviewedAt: now,
  };
}

export class WordReviewService {
  private scope(user: User): any {
    return { userId: toObjectId(user._id as string), language: user.language ?? "en" };
  }

  /** New words still allowed today. */
  private async newLeftToday(user: User, now: Date) {
    const started = await UserWord.countDocuments({ ...this.scope(user), "review.firstReviewedAt": { $gte: startOfDay(now) } });
    return Math.max(0, MAX_NEW_CARDS_PER_DAY - started);
  }

  /** Dictionary words this learner doesn't have yet. */
  private async dictionaryWords(user: User) {
    const scope = this.scope(user);
    const mine = await UserWord.distinct("wordId", scope);
    return { language: scope.language, rank: { $exists: true }, _id: { $nin: mine } };
  }

  /** When the list runs out of new words, the next most common ones join it. */
  private async fillFromDictionary(user: User, count: number) {
    const scope = this.scope(user);
    const words = await Word.find(await this.dictionaryWords(user), { _id: 1 }).sort({ rank: 1 }).limit(count).lean();
    if (words.length === 0) return;
    await UserWord.bulkWrite(
      words.map(({ _id }) => ({
        updateOne: { filter: { userId: scope.userId, wordId: _id }, update: { $setOnInsert: { language: scope.language } }, upsert: true },
      })),
      { ordered: false },
    );
  }

  async summary(user: User) {
    const now = new Date();
    const scope = this.scope(user);
    const [due, unscheduled, waiting, left, next] = await Promise.all([
      UserWord.countDocuments({ ...scope, "review.dueAt": { $lte: now } }),
      UserWord.countDocuments({ ...scope, "review.dueAt": { $exists: false } }),
      this.dictionaryWords(user).then((filter) => Word.countDocuments(filter)),
      this.newLeftToday(user, now),
      UserWord.findOne({ ...scope, "review.dueAt": { $gt: now } }, { "review.dueAt": 1 }).sort({ "review.dueAt": 1 }).lean<any>(),
    ]);
    return { due, newToday: Math.min(unscheduled + waiting, left), nextDueAt: next?.review?.dueAt ?? null };
  }

  /** Overdue first (the oldest on top), then new words: the hardest and least seen. */
  async queue(user: User, limit: number) {
    const now = new Date();
    const scope = this.scope(user);
    const due = await UserWord.aggregate([
      { $match: { ...scope, "review.dueAt": { $lte: now } } },
      { $sort: { "review.dueAt": 1 } },
      { $limit: limit },
      ...joinWord,
    ]);
    const room = Math.min(limit - due.length, await this.newLeftToday(user, now));
    if (room <= 0) return due;

    const unscheduled = await UserWord.countDocuments({ ...scope, "review.dueAt": { $exists: false } });
    if (unscheduled < room) await this.fillFromDictionary(user, room - unscheduled);

    const fresh = await UserWord.aggregate([
      { $match: { ...scope, "review.dueAt": { $exists: false } } },
      { $addFields: { difficultyRank: { $indexOfArray: [["hard", "medium", "easy"], "$difficulty"] } } },
      { $sort: { difficultyRank: 1, seen: 1, createdAt: -1 } },
      { $limit: room },
      ...joinWord,
    ]);
    return [...due, ...fresh];
  }

  async answer(user: User, wordId: string, answer: ReviewAnswer) {
    const mine = await UserWord.findOne({ userId: user._id, wordId });
    if (!mine) return null;
    const isNew = !mine.review?.dueAt;
    mine.review = nextSchedule(mine.review, answer, new Date());
    mine.difficulty = DIFFICULTY[answer] as typeof mine.difficulty;
    mine.seen += 1;
    await mine.save();
    return { mine, isNew };
  }
}

export default new WordReviewService();
