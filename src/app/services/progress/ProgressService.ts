/**
 * XP, level, daily goal and streak. The server gives the XP, for real work
 * only. A day counts for the streak when its goal is met, and a freeze covers
 * a missed day.
 */
import LessonAttempt from "../../db/models/LessonAttempt";
import Progress from "../../db/models/Progress";
import UserWord from "../../db/models/UserWord";
import XpDay from "../../db/models/XpDay";
import { IProgress } from "../../../../types/models";
import { DAILY_XP_GOAL, FREEZE_EVERY_DAYS, LEVEL_XP_STEP, MAX_STREAK_FREEZES } from "../../../config/constants";

const DAY_MS = 24 * 60 * 60 * 1000;
const CALENDAR_DAYS = 42;

const format = (timeZone: string, now: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);

/** The learner's calendar day. A bad time zone falls back to UTC. */
export function dayIn(timeZone: string | undefined, now: Date) {
  try {
    return format(timeZone || "UTC", now);
  } catch {
    return format("UTC", now);
  }
}

/** Days with no goal met between the last goal and today. */
const missedDays = (last: string | undefined, day: string) =>
  last ? Math.max(0, Math.round((Date.parse(day) - Date.parse(last)) / DAY_MS) - 1) : 0;

/** Level n starts at STEP·n·(n−1) XP: 50, 150, 300, 500… */
const xpForLevel = (level: number) => LEVEL_XP_STEP * level * (level - 1);
const levelOf = (xp: number) => Math.floor((1 + Math.sqrt(1 + (4 * xp) / LEVEL_XP_STEP)) / 2);

const view = (progress: Partial<IProgress> | null, todayXp: number, day: string) => {
  const xp = progress?.xp ?? 0;
  const freezes = progress?.freezes ?? 0;
  const level = levelOf(xp);
  const alive = missedDays(progress?.lastGoalDay, day) <= freezes;
  return {
    xp,
    level,
    levelXp: xp - xpForLevel(level),
    levelNeed: xpForLevel(level + 1) - xpForLevel(level),
    streak: alive ? (progress?.streak ?? 0) : 0,
    bestStreak: progress?.bestStreak ?? 0,
    freezes,
    todayXp,
    goal: DAILY_XP_GOAL,
  };
};

/** The streak after meeting today's goal, spending freezes on the missed days. */
function nextStreak({ streak, bestStreak, freezes, lastGoalDay }: IProgress, day: string) {
  const missed = missedDays(lastGoalDay, day);
  const saved = missed > 0 && missed <= freezes;
  const next = !lastGoalDay || (missed > 0 && !saved) ? 1 : streak + 1;
  const left = saved ? freezes - missed : freezes;
  return {
    streak: next,
    bestStreak: Math.max(bestStreak, next),
    freezes: next % FREEZE_EVERY_DAYS === 0 ? Math.min(MAX_STREAK_FREEZES, left + 1) : left,
    lastGoalDay: day,
  };
}

export class ProgressService {
  async get(userId: string, timeZone?: string, now = new Date()) {
    const day = dayIn(timeZone, now);
    const [progress, today] = await Promise.all([Progress.findOne({ userId }).lean(), XpDay.findOne({ userId, day }).lean()]);
    return view(progress, today?.xp ?? 0, day);
  }

  /** The study calendar and what the achievements are measured against. */
  async overview(userId: string, timeZone?: string, now = new Date()) {
    const [days, goalDays, reviewed, lessons, progress] = await Promise.all([
      XpDay.find({ userId }, { _id: 0, day: 1, xp: 1 }).sort({ day: -1 }).limit(CALENDAR_DAYS).lean(),
      XpDay.countDocuments({ userId, xp: { $gte: DAILY_XP_GOAL } }),
      UserWord.countDocuments({ userId, "review.firstReviewedAt": { $exists: true } }),
      LessonAttempt.countDocuments({ userId, completedAt: { $exists: true } }),
      Progress.findOne({ userId }).lean(),
    ]);
    return {
      today: dayIn(timeZone, now),
      goal: DAILY_XP_GOAL,
      days,
      totals: { goalDays, reviewed, lessons, bestStreak: progress?.bestStreak ?? 0, level: levelOf(progress?.xp ?? 0) },
    };
  }

  async award(userId: string, amount: number, timeZone?: string, now = new Date()) {
    const day = dayIn(timeZone, now);
    const options = { upsert: true, returnDocument: "after", setDefaultsOnInsert: true } as const;
    const today = await XpDay.findOneAndUpdate({ userId, day }, { $inc: { xp: amount } }, options);
    let progress = await Progress.findOneAndUpdate({ userId }, { $inc: { xp: amount } }, options);

    let goalReached = false;
    if (today.xp >= DAILY_XP_GOAL && progress.lastGoalDay !== day) {
      // the filter makes sure two answers at once count the day only once
      const updated = await Progress.findOneAndUpdate(
        { _id: progress._id, lastGoalDay: progress.lastGoalDay ?? null },
        nextStreak(progress, day),
        { returnDocument: "after" },
      );
      if (updated) {
        progress = updated;
        goalReached = true;
      }
    }

    return {
      gained: amount,
      goalReached,
      leveledUp: levelOf(progress.xp) > levelOf(progress.xp - amount),
      progress: view(progress, today.xp, day),
    };
  }
}

export default new ProgressService();
