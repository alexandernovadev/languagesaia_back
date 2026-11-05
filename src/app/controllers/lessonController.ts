import { Request, Response } from "express";
import lessonService from "../services/lessons/LessonService";
import { errorResponse, successResponse } from "../utils/responseHelpers";
import { routeParams } from "../utils/http/routeParams";
import { parseBody, LessonCreateSchema } from "../validators/schemas";
import logger from "../utils/logger";
import { setSSEHeaders, streamTextResponse } from "../utils/http/sse";

const userOf = (req: Request) => req.user as any;
const fail = (res: Response, error: any, fallback: string) => errorResponse(res, error?.message || fallback, error?.status || 500, error);

export const catalog = (req: Request, res: Response) => successResponse(res, "Grammar catalog", lessonService.catalog(userOf(req)?.language ?? "en"));

export const stats = async (req: Request, res: Response) => {
  try {
    return successResponse(res, "Lesson stats", await lessonService.stats(userOf(req)));
  } catch (error) {
    return fail(res, error, "Error loading stats");
  }
};

export const createLesson = async (req: Request, res: Response) => {
  const input = parseBody(LessonCreateSchema, req.body, res);
  if (!input) return;
  try {
    return successResponse(res, "Lesson ready", await lessonService.createLesson(userOf(req), input as any), 201);
  } catch (error) {
    return fail(res, error, "Error creating lesson");
  }
};

export const current = async (req: Request, res: Response) => {
  try {
    return successResponse(res, "Current lesson", await lessonService.current(userOf(req)));
  } catch (error) {
    return fail(res, error, "Error loading the current lesson");
  }
};

export const openLanguages = async (req: Request, res: Response) => {
  try {
    return successResponse(res, "Languages with an open lesson", await lessonService.openLanguages(userOf(req)));
  } catch (error) {
    return fail(res, error, "Error loading open lessons");
  }
};

export const report = async (req: Request, res: Response) => {
  const { attemptId, index } = routeParams(req);
  try {
    await lessonService.report(userOf(req), attemptId, Number(index));
    return successResponse(res, "Exercise reported");
  } catch (error) {
    return fail(res, error, "Error reporting the exercise");
  }
};

export const answer = async (req: Request, res: Response) => {
  const { attemptId } = routeParams(req);
  const { index, answer: value } = req.body ?? {};
  if (typeof index !== "number") return errorResponse(res, "index is required", 400);
  try {
    return successResponse(res, "Answer checked", await lessonService.answer(userOf(req), attemptId, index, value));
  } catch (error) {
    return fail(res, error, "Error checking answer");
  }
};

export const finish = async (req: Request, res: Response) => {
  try {
    return successResponse(res, "Lesson finished", await lessonService.finish(userOf(req), routeParams(req).attemptId));
  } catch (error) {
    return fail(res, error, "Error finishing lesson");
  }
};

export const chatHistory = async (req: Request, res: Response) => {
  const { attemptId, index } = routeParams(req);
  try {
    return successResponse(res, "Chat history", await lessonService.chatHistory(userOf(req), attemptId, Number(index)));
  } catch (error) {
    return fail(res, error, "Error loading chat");
  }
};

export const chatStream = async (req: Request, res: Response) => {
  const { attemptId, index } = routeParams(req);
  const message = String(req.body?.message ?? "").trim();
  if (!message) return errorResponse(res, "Message is required", 400);
  try {
    const { stream, save } = await lessonService.chat(userOf(req), attemptId, Number(index), message);
    setSSEHeaders(res);
    await streamTextResponse(res, stream as any, { filterMarkdownTables: false, onComplete: save });
  } catch (error: any) {
    logger.error("Lesson chat error:", error);
    return fail(res, error, "Error in chat");
  }
};
