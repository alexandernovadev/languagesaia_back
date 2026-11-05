import { Request, Response } from "express";
import examService from "../services/exams/ExamService";
import { errorResponse, successResponse } from "../utils/responseHelpers";
import { routeParams } from "../utils/http/routeParams";
import { parseBody, PracticeCreateSchema } from "../validators/schemas";
import logger from "../utils/logger";
import { setSSEHeaders, streamTextResponse } from "../utils/http/sse";

const userOf = (req: Request) => req.user as any;
const fail = (res: Response, error: any, fallback: string) => errorResponse(res, error?.message || fallback, error?.status || 500, error);

export const catalog = (req: Request, res: Response) => successResponse(res, "Grammar catalog", examService.catalog(userOf(req)?.language ?? "en"));

export const stats = async (req: Request, res: Response) => {
  try {
    return successResponse(res, "Exam stats", await examService.stats(userOf(req)));
  } catch (error) {
    return fail(res, error, "Error loading stats");
  }
};

export const createPractice = async (req: Request, res: Response) => {
  const input = parseBody(PracticeCreateSchema, req.body, res);
  if (!input) return;
  try {
    return successResponse(res, "Practice ready", await examService.createPractice(userOf(req), input as any), 201);
  } catch (error) {
    return fail(res, error, "Error creating practice");
  }
};

export const answer = async (req: Request, res: Response) => {
  const { attemptId } = routeParams(req);
  const { index, answer: value } = req.body ?? {};
  if (typeof index !== "number") return errorResponse(res, "index is required", 400);
  try {
    return successResponse(res, "Answer checked", await examService.answer(userOf(req), attemptId, index, value));
  } catch (error) {
    return fail(res, error, "Error checking answer");
  }
};

export const finish = async (req: Request, res: Response) => {
  try {
    return successResponse(res, "Practice finished", await examService.finish(userOf(req), routeParams(req).attemptId));
  } catch (error) {
    return fail(res, error, "Error finishing practice");
  }
};

export const chatHistory = async (req: Request, res: Response) => {
  const { attemptId, index } = routeParams(req);
  try {
    return successResponse(res, "Chat history", await examService.chatHistory(userOf(req), attemptId, Number(index)));
  } catch (error) {
    return fail(res, error, "Error loading chat");
  }
};

export const chatStream = async (req: Request, res: Response) => {
  const { attemptId, index } = routeParams(req);
  const message = String(req.body?.message ?? "").trim();
  if (!message) return errorResponse(res, "Message is required", 400);
  try {
    const { stream, save } = await examService.chat(userOf(req), attemptId, Number(index), message);
    setSSEHeaders(res);
    await streamTextResponse(res, stream as any, { filterMarkdownTables: false, onComplete: save });
  } catch (error: any) {
    logger.error("Exam chat error:", error);
    return fail(res, error, "Error in chat");
  }
};
