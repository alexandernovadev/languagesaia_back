/** Words: the daily spaced repetition session. */
import { Request, Response } from "express";
import wordReviewService, { ReviewAnswer } from "../services/words/WordReviewService";
import progressService from "../services/progress/ProgressService";
import { wordAudio } from "../services/audio/wordAudioService";
import Word from "../db/models/Word";
import userWordService from "../services/words/UserWordService";
import { NEW_CARD_BONUS_XP, REVIEW_XP } from "../../config/constants";
import { errorResponse, successResponse } from "../utils/responseHelpers";
import { parseLimit } from "../utils/pagination";
import { routeParams } from "../utils/http/routeParams";
import { getUserId, timeZoneOf } from "../utils/http/requestUser";
import { toWordDTO } from "../dto/mappers";

const ANSWERS: ReviewAnswer[] = ["again", "hard", "easy"];

export const getReviewSummary = async (req: Request, res: Response) => {
  try {
    return successResponse(res, "Review summary", await wordReviewService.summary(req.user as any));
  } catch (error) {
    return errorResponse(res, "Error reading the review summary", 500, error);
  }
};

export const getReviewQueue = async (req: Request, res: Response) => {
  try {
    const words = await wordReviewService.queue(req.user as any, parseLimit(req.query.limit, 20));
    return successResponse(res, "Review queue", words.map(toWordDTO));
  } catch (error) {
    return errorResponse(res, "Error reading the review queue", 500, error);
  }
};

export const answerReview = async (req: Request, res: Response) => {
  const { answer } = req.body ?? {};
  if (!ANSWERS.includes(answer)) return errorResponse(res, "answer must be again, hard or easy", 400);
  try {
    const result = await wordReviewService.answer(req.user as any, routeParams(req).id, answer);
    if (!result) return errorResponse(res, "Word not found", 404);
    const { mine, isNew } = result;
    const xp = REVIEW_XP + (isNew ? NEW_CARD_BONUS_XP : 0);
    const reward = await progressService.award(getUserId(req), xp, timeZoneOf(req));
    return successResponse(res, "Answer saved", { dueAt: mine.review?.dueAt, intervalDays: mine.review?.intervalDays, reward });
  } catch (error) {
    return errorResponse(res, "Error saving the answer", 500, error);
  }
};

/** The word's pronunciation; the first request creates it. */
export const getWordAudio = async (req: Request, res: Response) => {
  try {
    const word = await Word.findById(routeParams(req).id);
    if (!word) return errorResponse(res, "Word not found", 404);
    return successResponse(res, "Word audio", { url: await wordAudio(word) });
  } catch (error) {
    return errorResponse(res, "Error creating the audio", 500, error);
  }
};

/** A card of free practice: it counts as seen and earns XP, without touching the schedule. */
export const practiceWord = async (req: Request, res: Response) => {
  try {
    const mine = await userWordService.incrementSeen(getUserId(req), routeParams(req).id);
    if (!mine) return errorResponse(res, "Word not found", 404);
    return successResponse(res, "Practice saved", { reward: await progressService.award(getUserId(req), REVIEW_XP, timeZoneOf(req)) });
  } catch (error) {
    return errorResponse(res, "Error saving the practice", 500, error);
  }
};
