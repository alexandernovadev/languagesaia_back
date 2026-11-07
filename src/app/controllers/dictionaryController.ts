import { Request, Response } from "express";
import dictionaryService, { DictionaryQuery } from "../services/words/DictionaryService";
import { generateWordData } from "../services/ai/wordAIService";
import { errorResponse, successResponse } from "../utils/responseHelpers";
import { getUserId } from "../utils/http/requestUser";
import { parseLimit } from "../utils/pagination";
import { routeParams } from "../utils/http/routeParams";
import logger from "../utils/logger";
import type { Language } from "../../../types/business";

const failed = (res: Response, error: any, message: string) => {
  logger.error(`${message}:`, error);
  const taken = error?.code === 11000;
  return errorResponse(res, taken ? "That word is already in the dictionary" : error?.status ? error.message : message, taken ? 409 : (error?.status ?? 500), error);
};

export const listDictionary = async (req: Request, res: Response) => {
  try {
    const q = req.query as Record<string, string | undefined>;
    const result = await dictionaryService.list({
      language: q.language,
      search: q.search?.trim() || undefined,
      type: q.type,
      source: q.source,
      missing: q.missing as DictionaryQuery["missing"],
      hidden: q.hidden === "true",
      sort: q.sort as DictionaryQuery["sort"],
      page: Math.max(1, Number(q.page) || 1),
      limit: parseLimit(q.limit, 40),
      userId: getUserId(req),
    });
    return successResponse(res, "Dictionary", result);
  } catch (error) {
    return failed(res, error, "Error listing the dictionary");
  }
};

export const getDictionaryWord = async (req: Request, res: Response) => {
  try {
    const word = await dictionaryService.get(routeParams(req).id);
    return word ? successResponse(res, "Word", word) : errorResponse(res, "Word not found", 404);
  } catch (error) {
    return failed(res, error, "Error reading the word");
  }
};

/** A draft to review: nothing is saved until the admin says so. */
export const draftDictionaryWord = async (req: Request, res: Response) => {
  try {
    const { word, language } = req.body ?? {};
    if (!word || !language) return errorResponse(res, "word and language are required", 400);
    return successResponse(res, "Draft", await generateWordData(word, language as Language, [], { userId: getUserId(req) }));
  } catch (error) {
    return failed(res, error, "Error writing the draft");
  }
};

export const createDictionaryWord = async (req: Request, res: Response) => {
  try {
    if (!req.body?.language) return errorResponse(res, "language is required", 400);
    return successResponse(res, "Word created", await dictionaryService.create(req.body, req.body.language), 201);
  } catch (error) {
    return failed(res, error, "Error creating the word");
  }
};

export const updateDictionaryWord = async (req: Request, res: Response) => {
  try {
    const word = await dictionaryService.update(routeParams(req).id, req.body ?? {});
    return word ? successResponse(res, "Word saved", word) : errorResponse(res, "Word not found", 404);
  } catch (error) {
    return failed(res, error, "Error saving the word");
  }
};

export const hideDictionaryWord = async (req: Request, res: Response) => {
  try {
    const word = await dictionaryService.setHidden(routeParams(req).id, !!req.body?.hidden);
    return word ? successResponse(res, "Word updated", word) : errorResponse(res, "Word not found", 404);
  } catch (error) {
    return failed(res, error, "Error hiding the word");
  }
};

export const deleteDictionaryWord = async (req: Request, res: Response) => {
  try {
    const word = await dictionaryService.remove(routeParams(req).id);
    return word ? successResponse(res, "Word deleted", {}) : errorResponse(res, "Word not found", 404);
  } catch (error) {
    return failed(res, error, "Error deleting the word");
  }
};
