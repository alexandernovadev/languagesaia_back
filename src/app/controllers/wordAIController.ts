/** Words: everything the AI generates (the word itself, its fields, its picture). */
import { Request, Response } from "express";
import { WordService } from "../services/words/wordService";
import {
  generateWordData,
  generateWordExamples,
  generateWordCodeSwitching,
  generateWordTypes,
  generateWordSynonyms,
} from "../services/ai/wordAIService";
import { generateImage } from "../services/ai/imageAIService";
import { wordImagePrompt } from "../services/ai/prompts";
import {
  deleteImageFromCloudinary,
  uploadImageToCloudinary,
} from "../services/cloudinary/cloudinaryService";
import { WordTypeValidationError } from "../data/business/shared";
import type { Language } from "../../../types/business";
import { errorResponse, successResponse } from "../utils/responseHelpers";
import { toWordDTO } from "../dto/mappers";
import { routeParams } from "../utils/http/routeParams";
import { getUserId } from "../utils/http/requestUser";

const wordService = new WordService();

export const generateWordJson = async (req: Request, res: Response) => {
  const { word } = req.body;
  const language = req.body.language || req.user?.language || "en";
  const userId = getUserId(req);

  if (!word) {
    return errorResponse(res, "Word is required.", 400);
  }

  try {
    // Generate the word data using unified AI service
    const wordData = await generateWordData(word, language, [], { userId });

    // Save the generated word to the database
    const savedWord = await wordService.createWord(wordData);

    return successResponse(
      res,
      "Word generated and saved successfully",
      toWordDTO(savedWord)
    );
  } catch (error) {
    if (error instanceof WordTypeValidationError) {
      return errorResponse(res, error.message, 400, error);
    }
    return errorResponse(res, "Error generating or saving word", 500, error);
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
    const imageResponse = await generateImage(await wordImagePrompt(wordDoc ?? { word }));
    if (!imageResponse) {
      return errorResponse(res, "Failed to generate image.", 400);
    }

    // Extract base64 string from the response object
    const imageBase64 = imageResponse.b64_json;
    if (!imageBase64) {
      return errorResponse(res, "Failed to get image data from response.", 400);
    }

    let deleteOldImagePromise: Promise<unknown> = Promise.resolve();

    if (imgOld && imgOld.includes("res.cloudinary.com")) {
      const parts = imgOld.split("/");
      let publicId = parts.pop();

      // Remove extension if exists
      if (publicId && publicId.includes(".")) {
        publicId = publicId.split(".")[0];
      }

      // Delete old image
      deleteOldImagePromise = deleteImageFromCloudinary(
        "languagesai/words/" + publicId
      );
    }

    // Upload new image while deleting the old one
    const [_, urlImage] = await Promise.all([
      deleteOldImagePromise,
      uploadImageToCloudinary(imageBase64, "words"),
    ]);

    if (!urlImage) {
      return errorResponse(res, "Failed to upload image to Cloudinary.", 500);
    }

    // Update word image
    const updatedWord = await wordService.updateWordImg(IDWord, urlImage);

    if (!updatedWord) {
      return errorResponse(res, "Word not found or failed to update.", 404);
    }

    // Ensure the response includes the img field
    const responseData = {
      img: updatedWord.img || urlImage,
    };

    return successResponse(res, "Word image updated successfully", responseData);
  } catch (error) {
    return errorResponse(res, "Error generating word image", 500, error);
  }
};
