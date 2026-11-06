/** Words: CRUD, listings and review cards. */
import { Request, Response } from "express";
import { WordService } from "../services/words/wordService";
import { WordQueryService } from "../services/words/WordQueryService";
import userWordService, { withProgress } from "../services/words/UserWordService";
import { errorResponse, successResponse } from "../utils/responseHelpers";
import { parseLimit } from "../utils/pagination";
import { WordTypeValidationError } from "../data/business/shared";
import { WordCreateSchema, WordUpdateSchema, parseBody } from "../validators/schemas";
import { toWordDTO, mapPaginated } from "../dto/mappers";
import { routeParams } from "../utils/http/routeParams";
import { getUserId } from "../utils/http/requestUser";

const wordService = new WordService();
const wordQueryService = new WordQueryService();

export const getWordByName = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    // Forzamos el tipo a `string`, y si es un array, tomamos el primer elemento.
    const word = (routeParams(req).word || req.query.word) as string | undefined;

    // Ensure `word` is a non-empty string.
    if (!word || Array.isArray(word)) {
      return errorResponse(res, "A single word parameter is required");
    }

    const language = (req.query.language as string) || req.user?.language || "en";

    const foundWord = await wordService.findWordByWord(word, language);
    if (!foundWord) {
      return errorResponse(res, "Word not found", 404);
    }

    const mine = await userWordService.find(getUserId(req), String(foundWord._id));
    return successResponse(res, "Get Word successFully", toWordDTO(withProgress(foundWord, mine)));
  } catch (error) {
    return errorResponse(
      res,
      "An error occurred while getting the word",
      500,
      error
    );
  }
};

export const createWord = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const wordData = parseBody(WordCreateSchema, req.body, res);
    if (!wordData) return res;
    const newWord = await wordService.createWord(wordData as any);
    const mine = await userWordService.add(getUserId(req), newWord);

    return successResponse(res, "Word created successfully", toWordDTO(withProgress(newWord, mine)), 201);
  } catch (error) {
    if (error instanceof WordTypeValidationError) {
      return errorResponse(res, error.message, 400, error);
    }
    if ((error as Error).name === "ValidationError") {
      return errorResponse(res, "Validation error" + error);
    }
    return errorResponse(
      res,
      "An error occurred while creating the word ",
      500,
      error
    );
  }
};

export const getWordById = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { id } = routeParams(req);
    const word = await wordService.getWordById(id);
    if (!word) {
      return errorResponse(res, "Word not found", 404);
    }

    const mine = await userWordService.find(getUserId(req), id);
    return successResponse(res, "Word listed by Id successfully", toWordDTO(withProgress(word, mine)));
  } catch (error) {
    return errorResponse(
      res,
      "An error occurred while retrieving the word",
      500,
      error
    );
  }
};

export const getWords = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limit = parseLimit(req.query.limit, 10);

    // Filtros existentes
    const wordUser = req.query.wordUser as string;

    // Basic filters
    const difficulty = req.query.difficulty as string;
    const language = req.query.language as string;
    const type = req.query.type as string;
    const seenMin = req.query.seenMin
      ? parseInt(req.query.seenMin as string)
      : undefined;
    const seenMax = req.query.seenMax
      ? parseInt(req.query.seenMax as string)
      : undefined;
    const sortBy = (req.query.sortBy as string) || "createdAt";
    const sortOrder = (req.query.sortOrder as string) || "desc";

    // Nuevos filtros de contenido
    const definition = req.query.definition as string;
    const IPA = req.query.IPA as string;
    const hasImage = req.query.hasImage as string;
    const hasExamples = req.query.hasExamples as string;
    const hasSynonyms = req.query.hasSynonyms as string;
    const hasCodeSwitching = req.query.hasCodeSwitching as string;
    const spanishWord = req.query.spanishWord as string;
    const spanishDefinition = req.query.spanishDefinition as string;

    // Filtros de fecha
    const createdAfter = req.query.createdAfter as string;
    const createdBefore = req.query.createdBefore as string;
    const updatedAfter = req.query.updatedAfter as string;
    const updatedBefore = req.query.updatedBefore as string;

    // Process filters that may have multiple comma-separated values
    const difficulties = difficulty
      ? difficulty.split(",").map((d) => d.trim())
      : undefined;
    const languages = language
      ? language.split(",").map((l) => l.trim())
      : (req.user?.language ? [req.user.language] : undefined);
    const types = type ? type.split(",").map((t) => t.trim()) : undefined;

    const wordList = await wordService.getWords(getUserId(req), {
      page,
      limit,
      wordUser,
      difficulty: difficulties,
      language: languages,
      type: types,
      seenMin,
      seenMax,
      sortBy,
      sortOrder,
      definition,
      IPA,
      hasImage,
      hasExamples,
      hasSynonyms,
      hasCodeSwitching,
      spanishWord,
      spanishDefinition,
      createdAfter,
      createdBefore,
      updatedAfter,
      updatedBefore,
    });

    return successResponse(res, "Words sucessfully listed", mapPaginated(wordList, toWordDTO));
  } catch (error) {
    return errorResponse(
      res,
      "An error occurred while retrieving the word",
      500,
      error
    );
  }
};

export const updateWord = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { id } = routeParams(req);
    const updateData = parseBody(WordUpdateSchema, req.body, res);
    if (!updateData) return res;
    const updatedWord = await wordService.updateWord(id, updateData as any);
    if (!updatedWord) {
      return errorResponse(res, "Word not found", 404);
    }
    const mine = await userWordService.find(getUserId(req), id);
    return successResponse(res, "Word updated successfully", toWordDTO(withProgress(updatedWord, mine)));
  } catch (error) {
    if (error instanceof WordTypeValidationError) {
      return errorResponse(res, error.message, 400, error);
    }
    return errorResponse(
      res,
      "An error occurred while updating the word ",
      500,
      error
    );
  }
};

export const updateWordDifficulty = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { id } = routeParams(req);
    const difficulty = req.body.difficulty;

    const mine = await userWordService.setDifficulty(getUserId(req), id, difficulty);
    if (!mine) {
      return errorResponse(res, "Word not found", 404);
    }

    return successResponse(res, "Word difficulty updated successfully", { difficulty: mine.difficulty });
  } catch (error) {
    return errorResponse(
      res,
      "An error occurred while updating the word difficulty ",
      500,
      error
    );
  }
};

// Controlador unificado para tarjetas Anki
export const getAnkiCards = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const mode = (req.query.mode as string) || "random";
    const limit = parseLimit(req.query.limit, 30);
    const difficulty = req.query.difficulty
      ? (req.query.difficulty as string).split(",")
      : ["hard", "medium"];
    const language = req.user?.language || "en";
    const typeParam = req.query.type as string | undefined;
    const type =
      typeParam
        ? typeParam.split(",").map((t) => t.trim()).filter(Boolean)
        : undefined;

    const words = await wordQueryService.getAnkiCards(getUserId(req), {
      mode: mode as "random" | "review",
      limit,
      difficulty,
      language,
      type,
    });

    const message =
      mode === "random"
        ? "Anki cards retrieved successfully (random mode)"
        : "Anki cards retrieved successfully (review mode)";

    return successResponse(res, message, words.map(toWordDTO));
  } catch (error) {
    return errorResponse(
      res,
      "An error occurred while retrieving Anki cards",
      500,
      error
    );
  }
};

export const getWordCountsByLanguage = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    return successResponse(res, "Word counts by language", await userWordService.countByLanguage(getUserId(req)));
  } catch (error) {
    return errorResponse(res, "An error occurred while counting words", 500, error);
  }
};

export const getWordsByTypeOptimized = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const type = req.query.type as string;
    const limit = parseLimit(req.query.limit, 10);
    const search = req.query.wordUser as string;
    const fields = req.query.fields as string;

    if (!type) {
      return errorResponse(res, "Type parameter is required", 400);
    }

    const words = await wordQueryService.getWordsByTypeOptimized(
      type,
      limit,
      search,
      fields
    );
    return successResponse(
      res,
      `Words of type ${type} retrieved successfully`,
      words
    );
  } catch (error) {
    return errorResponse(
      res,
      "An error occurred while retrieving words by type",
      500,
      error
    );
  }
};

export const updateIncrementWordSeens = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { id } = routeParams(req);
    const mine = await userWordService.incrementSeen(getUserId(req), id);

    if (!mine) {
      return errorResponse(res, "Word Not Found ", 404);
    }

    return successResponse(res, "Word seen count incremented successfully", { seen: mine.seen });
  } catch (error) {
    return errorResponse(
      res,
      "An error occurred while incrementing the word seen count",
      500,
      error
    );
  }
};
