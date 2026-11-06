/** Pronunciation of an example or an expression. */
import { Request, Response } from "express";
import { textAudio } from "../services/audio/wordAudioService";
import { languagesList } from "../data/business/shared";
import { MAX_SPEECH_TEXT_LENGTH } from "../../config/constants";
import { errorResponse, successResponse } from "../utils/responseHelpers";

export const getTextAudio = async (req: Request, res: Response) => {
  const { text, language } = req.body ?? {};
  if (typeof text !== "string" || !text.trim() || text.length > MAX_SPEECH_TEXT_LENGTH) return errorResponse(res, "text is required and must be short", 400);
  if (!languagesList.includes(language)) return errorResponse(res, "Unknown language", 400);
  try {
    return successResponse(res, "Text audio", { url: await textAudio(text, language) });
  } catch (error) {
    return errorResponse(res, "Error creating the audio", 500, error);
  }
};
