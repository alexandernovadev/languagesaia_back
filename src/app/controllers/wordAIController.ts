/** Words: everything the AI generates (the word itself, its fields, its picture). */
import { Request, Response } from "express";
import { WordService } from "../services/words/wordService";
import userWordService, { withProgress } from "../services/words/UserWordService";
import progressService from "../services/progress/ProgressService";
import { ADD_WORD_XP } from "../../config/constants";
import {
  generateWordData,
  generateWordExamples,
  generateWordCodeSwitching,
  generateWordTypes,
  generateWordSynonyms,
} from "../services/ai/wordAIService";
import { generateImage } from "../services/ai/imageAIService";
import { completeWord } from "../services/words/WordCompletionService";
import { wordImagePrompt } from "../services/ai/prompts";
import sharp from "sharp";
import { deleteImageFromCloudinary } from "../services/cloudinary/cloudinaryService";
import { deleteWordImageFromPocketBase, uploadWordImageToPocketBase } from "../services/audio/pocketBaseService";

const WORD_IMAGE_SIZE = 768;
const WORD_IMAGE_QUALITY = 80;
import { WordTypeValidationError } from "../data/business/shared";
import type { Language } from "../../../types/business";
import { errorResponse, successResponse } from "../utils/responseHelpers";
import { toWordDTO } from "../dto/mappers";
import { routeParams } from "../utils/http/routeParams";
import { getUserId, timeZoneOf } from "../utils/http/requestUser";

const wordService = new WordService();

export const generateWordJson = async (req: Request, res: Response) => {
  const { word } = req.body;
  const language = req.body.language || req.user?.language || "en";
  const userId = getUserId(req);

  if (!word) {
    return errorResponse(res, "Word is required.", 400);
  }

  try {
    // Already in the dictionary: it only has to be linked, no AI needed
    const known = await wordService.findWordByWord(word, language);
    const alreadyInList = known ? !!(await userWordService.find(userId, String(known._id))) : false;

    let saved = known;
    if (!saved) {
      const wordData = await generateWordData(word, language, [], { userId });
      // the AI may normalize it ("running" → "run") into a word that already exists
      saved = (await wordService.findWordByWord(wordData.word, language)) ?? (await wordService.createWord(wordData));
    }

    const mine = await userWordService.add(userId, saved);
    const reward = alreadyInList ? null : await progressService.award(userId, ADD_WORD_XP, timeZoneOf(req));
    return successResponse(res, "Word ready", { ...toWordDTO(withProgress(saved, mine)), alreadyInList, reward });
  } catch (error) {
    if (error instanceof WordTypeValidationError) {
      return errorResponse(res, error.message, 400, error);
    }
    return errorResponse(res, "Error generating or saving word", 500, error);
  }
};

/** Fills in what a lean dictionary word is missing, the first time it's opened. */
export const completeWordJson = async (req: Request, res: Response) => {
  try {
    const word = await completeWord(routeParams(req).id, getUserId(req));
    if (!word) return errorResponse(res, "Word not found", 404);
    return successResponse(res, "Word completed", word);
  } catch (error) {
    return errorResponse(res, "Error completing the word", 500, error);
  }
};

type GenerateArgs = [word: string, language: Language, oldExamples: string, options: { userId: string | null }];

/** Regenerates one list field of an existing word with the AI and saves it. */
const regenerateField = (field: {
  generate: (...args: GenerateArgs) => Promise<string[] | undefined>;
  save: (id: string, values: string[]) => Promise<any>;
  successMessage: string;
  errorMessage: string;
}) => async (req: Request, res: Response) => {
  const { word, oldExamples } = req.body;
  const language = req.body.language || req.user?.language || "en";
  const { id } = routeParams(req) as { id: string };

  if (!word) {
    return errorResponse(res, "Word is required.", 400);
  }

  try {
    const values = await field.generate(word, language, oldExamples, { userId: getUserId(req) });
    const updated = await field.save(id, values || []);
    if (!updated) {
      return errorResponse(res, "Word not found", 404);
    }
    return successResponse(res, field.successMessage, toWordDTO(updated));
  } catch (error) {
    if (error instanceof WordTypeValidationError) {
      return errorResponse(res, error.message, 400, error);
    }
    return errorResponse(res, field.errorMessage, 500, error);
  }
};

export const generateWordExamplesJson = regenerateField({
  generate: async (...args) => (await generateWordExamples(...args)).examples,
  save: (id, values) => wordService.updateWordExamples(id, values),
  successMessage: "Word examples updated successfully",
  errorMessage: "Error generating word examples",
});

export const generateWordExamplesCodeSwitchingJson = regenerateField({
  generate: async (...args) => (await generateWordCodeSwitching(...args)).codeSwitching,
  save: (id, values) => wordService.updateWordCodeSwitching(id, values),
  successMessage: "Word code-switching updated successfully",
  errorMessage: "Error generating word code-switching examples",
});

export const generateWordTypesJson = regenerateField({
  generate: async (...args) => (await generateWordTypes(...args)).type,
  save: (id, values) => wordService.updateWordType(id, values),
  successMessage: "Word types updated successfully",
  errorMessage: "Error generating word types",
});

export const generateWordSynonymsJson = regenerateField({
  generate: async (...args) => (await generateWordSynonyms(...args)).synonyms,
  save: (id, values) => wordService.updateWordSynonyms(id, values),
  successMessage: "Word synonyms updated successfully",
  errorMessage: "Error generating word synonyms",
});

export const updateImageWord = async (req: Request, res: Response) => {
  const { word, imgOld } = req.body;
  const IDWord = routeParams(req).id;

  if (!word) {
    return errorResponse(res, "Word is required.", 400);
  }

  try {
    const wordDoc = await wordService.getWordById(IDWord);
    if (!wordDoc) {
      return errorResponse(res, "Word not found.", 404);
    }

    const { b64_json } = await generateImage(await wordImagePrompt(wordDoc));
    if (!b64_json) {
      return errorResponse(res, "Failed to get image data from response.", 400);
    }

    // Same format as scripts/generate-images.ts, so every word picture looks alike
    const webp = await sharp(Buffer.from(b64_json, "base64"))
      .resize(WORD_IMAGE_SIZE, WORD_IMAGE_SIZE)
      .webp({ quality: WORD_IMAGE_QUALITY, effort: 5 })
      .toBuffer();
    const urlImage = await uploadWordImageToPocketBase(webp, `${wordDoc.wordKey || "word"}.webp`, {
      wordId: String(wordDoc._id),
      word: wordDoc.word,
    });

    const updatedWord = await wordService.updateWordImg(IDWord, urlImage);
    if (!updatedWord) {
      await deleteWordImageFromPocketBase(urlImage);
      return errorResponse(res, "Word not found or failed to update.", 404);
    }

    // The old picture goes only once the new one is saved
    const old = String(imgOld || wordDoc.img || "");
    if (old && old !== urlImage) {
      if (old.includes("res.cloudinary.com")) {
        const publicId = old.split("/").pop()?.split(".")[0];
        if (publicId) await deleteImageFromCloudinary("languagesai/words/" + publicId).catch(() => undefined);
      } else {
        await deleteWordImageFromPocketBase(old);
      }
    }

    return successResponse(res, "Word image updated successfully", { img: urlImage });
  } catch (error) {
    return errorResponse(res, "Error generating word image", 500, error);
  }
};
