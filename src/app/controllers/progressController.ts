/** The learner's XP, level, daily goal and streak. */
import { Request, Response } from "express";
import progressService from "../services/progress/ProgressService";
import { errorResponse, successResponse } from "../utils/responseHelpers";
import { getUserId, timeZoneOf } from "../utils/http/requestUser";

export const getOverview = async (req: Request, res: Response) => {
  try {
    return successResponse(res, "Progress overview", await progressService.overview(getUserId(req), timeZoneOf(req)));
  } catch (error) {
    return errorResponse(res, "Error reading the progress", 500, error);
  }
};

export const getProgress = async (req: Request, res: Response) => {
  try {
    return successResponse(res, "Progress", await progressService.get(getUserId(req), timeZoneOf(req)));
  } catch (error) {
    return errorResponse(res, "Error reading the progress", 500, error);
  }
};
