import { Request, Response } from "express";
import { WordService } from "../services/words/wordService";
import { WordQueryService } from "../services/words/WordQueryService";
import { WordChatService } from "../services/words/WordChatService";
import { WordExportService } from "../services/words/WordExportService";
import { WordImportService } from "../services/import/WordImportService";
import { errorResponse, successResponse } from "../utils/responseHelpers";
import { parseLimit } from "../utils/pagination";
import { validateJsonBuffer, MAX_IMPORT_ITEMS } from "../middlewares/uploadMiddleware";
import {
  generateWordData,
  generateWordExamples,
  generateWordCodeSwitching,
  generateWordTypes,
  generateWordSynonyms,
  generateWordChat,
  generateImage,
} from "../services/ai";
import { getAIProvider } from "../services/ai/aiConfigHelper";
import type { ImageProvider } from "../../config/aiConfig";
import { imageWordPrompt } from "../services/ai/prompts";
import {
  deleteImageFromCloudinary,
  uploadImageToCloudinary,
} from "../services/cloudinary/cloudinaryService";
import logger from "../utils/logger";
import { WordTypeValidationError } from "../data/business/shared";
import { WordCreateSchema, WordUpdateSchema, parseBody } from "../validators/schemas";
import { toWordDTO, mapPaginated } from "../dto/mappers";

const wordService = new WordService();
const wordQueryService = new WordQueryService();
const wordChatService = new WordChatService();
const wordExportService = new WordExportService();
const wordImportService = new WordImportService();

export const getWordByName = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    // Forzamos el tipo a `string`, y si es un array, tomamos el primer elemento.
    const word = (req.params.word || req.query.word) as string | undefined;

    // Ensure `word` is a non-empty string.
    if (!word || Array.isArray(word)) {
      return errorResponse(res, "A single word parameter is required");
    }

    const language = (req.query.language as string) || req.user?.language || "en";

    const foundWord = await wordService.findWordByWord(word, language);
    if (!foundWord) {
      return errorResponse(res, "Word not found", 404);
    }

    return successResponse(res, "Get Word successFully", toWordDTO(foundWord));
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
    if (!wordData) return errorResponse(res, "Invalid request body", 400);
    const newWord = await wordService.createWord(wordData as any);

    return successResponse(res, "Word created successfully", toWordDTO(newWord), 201);
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
    const { id } = req.params;
    const word = await wordService.getWordById(id);
    if (!word) {
      return errorResponse(res, "Word not found", 404);
    }

    return successResponse(res, "Word listed by Id successfully", toWordDTO(word));
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

    const wordList = await wordService.getWords({
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
    const { id } = req.params;
    const updateData = parseBody(WordUpdateSchema, req.body, res);
    if (!updateData) return errorResponse(res, "Invalid request body", 400);
    const updatedWord = await wordService.updateWord(id, updateData as any);
    if (!updatedWord) {
      return errorResponse(res, "Word not found", 404);
    }
    return successResponse(res, "Word updated successfully", toWordDTO(updatedWord));
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
    const { id } = req.params;
    const difficulty = req.body.difficulty;

    const updatedWord = await wordService.updateWordDifficulty(id, difficulty);
    if (!updatedWord) {
      return errorResponse(res, "Word not found", 404);
    }

    return successResponse(res, "Word difficulty updated successfully", toWordDTO(updatedWord));
  } catch (error) {
    return errorResponse(
      res,
      "An error occurred while updating the word difficulty ",
      500,
      error
    );
  }
};

export const deleteWord = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { id } = req.params;
    const deletedWord = await wordService.deleteWord(id);
    if (!deletedWord) {
      return errorResponse(res, "Word no found by ID: " + id, 403);
    }

    return successResponse(res, "Word deleted successfully", {});
  } catch (error) {
    return errorResponse(
      res,
      "An error occurred while deleting the word",
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

    const words = await wordQueryService.getAnkiCards({
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
    const { id } = req.params;
    const updatedWord = await wordService.incrementWordSeen(id);

    if (!updatedWord) {
      return errorResponse(res, "Word Not Found ", 404);
    }

    return successResponse(
      res,
      "Word seen count incremented successfully",
      toWordDTO(updatedWord)
    );
  } catch (error) {
    return errorResponse(
      res,
      "An error occurred while incrementing the word seen count",
      500,
      error
    );
  }
};

export const exportWordsToJSON = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const words = await wordExportService.getAllWordsForExport();

    // Set headers for file download
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `words-export-${timestamp}.json`;

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    // Send the JSON data
    return successResponse(res, `Exported ${words.length} words successfully`, {
      totalWords: words.length,
      exportDate: new Date().toISOString(),
      words,
    });
  } catch (error) {
    return errorResponse(
      res,
      "An error occurred while exporting words to JSON",
      500,
      error
    );
  }
};

export const importWordsFromFile = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    if (!req.file) {
      return errorResponse(res, "No file uploaded", 400);
    }

    // Validate file content before parsing (MIME type is spoofable)
    if (!validateJsonBuffer(req.file.buffer)) {
      return errorResponse(res, "File content is not valid JSON", 400);
    }

    // Parse the JSON file content
    let fileData: any;
    try {
      const fileContent = req.file.buffer.toString("utf-8");
      fileData = JSON.parse(fileContent);
    } catch (parseError) {
      return errorResponse(res, "Invalid JSON file format", 400);
    }

    // Validate file structure - handle both direct and nested structures
    let words: any[] = [];

    // Try to find words in different possible structures
    if (fileData.data?.words && Array.isArray(fileData.data.words)) {
      // Direct structure: data.words
      words = fileData.data.words;
    } else if (
      fileData.data?.data?.words &&
      Array.isArray(fileData.data.data.words)
    ) {
      // Nested structure: data.data.words (from export)
      words = fileData.data.data.words;
    } else if (fileData.words && Array.isArray(fileData.words)) {
      // Root level: words
      words = fileData.words;
    } else {
      return errorResponse(
        res,
        "Invalid file structure. Expected 'data.words' or 'data.data.words' array",
        400
      );
    }

    if (words.length > MAX_IMPORT_ITEMS) {
      return errorResponse(res, `Import exceeds maximum of ${MAX_IMPORT_ITEMS} items per request`, 400);
    }
    const {
      duplicateStrategy = "skip",
      validateOnly = false,
      batchSize = 10,
    } = req.query;

    // Validate duplicateStrategy
    const validStrategies = ["skip", "overwrite", "error", "merge"];
    if (!validStrategies.includes(duplicateStrategy as string)) {
      return errorResponse(
        res,
        `Invalid duplicateStrategy. Must be one of: ${validStrategies.join(
          ", "
        )}`,
        400
      );
    }

    // Validate batchSize
    const batchSizeNum = parseInt(batchSize as string);
    if (isNaN(batchSizeNum) || batchSizeNum < 1 || batchSizeNum > 100) {
      return errorResponse(
        res,
        "Invalid batchSize. Must be a number between 1 and 100",
        400
      );
    }

    // Convert validateOnly to boolean
    const validateOnlyBool = validateOnly === "true";

    // If validateOnly is true, just validate without importing
    if (validateOnlyBool) {
      const validationResults = await wordImportService.validateWords(words);
      const validCount = validationResults.filter(
        (r) => r.status === "valid"
      ).length;
      const invalidCount = validationResults.filter(
        (r) => r.status === "invalid"
      ).length;

      return successResponse(res, "Validation completed", {
        totalWords: words.length,
        valid: validCount,
        invalid: invalidCount,
        validationResults,
      });
    }

    // Import words
    const importResult = await wordImportService.importWords(words, {
      duplicateStrategy: duplicateStrategy as any,
      validateOnly: false,
      batchSize: batchSizeNum,
    });

    return successResponse(res, "Import completed successfully", importResult);
  } catch (error) {
    logger.error("Import error:", error);
    return errorResponse(res, "Error importing words", 500, error);
  }
};

// Chat methods
export const addChatMessage = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    if (!message) {
      return errorResponse(res, "Message is required", 400);
    }

    const word = await wordChatService.addChatMessage(id, message);
    if (!word) {
      return errorResponse(res, "Word not found", 404);
    }

    return successResponse(res, "Chat message added successfully", { word: toWordDTO(word) });
  } catch (error: any) {
    logger.error("Error adding chat message:", error);
    return errorResponse(res, error.message, 500, error);
  }
};

export const getChatHistory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const chatHistory = await wordChatService.getChatHistory(id);
    return successResponse(res, "Chat history retrieved", chatHistory);
  } catch (error: any) {
    logger.error("Error getting chat history:", error);
    return errorResponse(res, error.message, 500, error);
  }
};

export const clearChatHistory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const word = await wordChatService.clearChatHistory(id);
    if (!word) {
      return errorResponse(res, "Word not found", 404);
    }

    return successResponse(res, "Chat history cleared successfully", { word: toWordDTO(word) });
  } catch (error: any) {
    logger.error("Error clearing chat history:", error);
    return errorResponse(res, error.message, 500, error);
  }
};

// Streaming chat response
export const streamChatResponse = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    if (!message) {
      return errorResponse(res, "Message is required", 400);
    }

    const word = await wordService.getWordById(id);
    if (!word) {
      return errorResponse(res, "Word not found", 404);
    }

    // Add user message first
    await wordChatService.addUserMessage(id, message);

    // Set up streaming
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    const userId = req.user?._id || req.user?.id || null;
    const explainsLanguage = req.user?.explainsLanguage || "es";
    const stream = await generateWordChat(
      word.word,
      word.definition,
      message,
      word.chat || [],
      { stream: true, userId },
      word.language,
      explainsLanguage
    );

    let fullResponse = "";

    // Handle streaming response (stream is an AsyncIterable when stream: true)
    for await (const chunk of stream as any) {
      const content = chunk.choices?.[0]?.delta?.content || "";
      if (content) {
        fullResponse += content;
        res.write(content);
      }
    }

    // Save the complete AI response
    await wordChatService.addAssistantMessage(id, fullResponse);

    res.end();
  } catch (error: any) {
    logger.error("Error streaming chat response:", error);
    return errorResponse(res, error.message, 500, error);
  }
};

// ===== AI GENERATION FUNCTIONS FOR WORDS =====

export const generateWordJson = async (req: Request, res: Response) => {
  const { word, provider } = req.body;
  const language = req.body.language || req.user?.language || "en";
  const userId = req.user?._id || req.user?.id || null;

  if (!word) {
    return errorResponse(res, "Word is required.", 400);
  }

  try {
    // Generate the word data using unified AI service
    const wordData = await generateWordData(word, language, [], { provider, userId });

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

export const generateWordExamplesJson = async (req: Request, res: Response) => {
  const { word, oldExamples, provider } = req.body;
  const language = req.body.language || req.user?.language || "en";
  const { id } = req.params as { id: string };
  const userId = req.user?._id || req.user?.id || null;

  if (!word) {
    return errorResponse(res, "Word is required.", 400);
  }

  try {
    const generated = await generateWordExamples(word, language, oldExamples, {
      provider,
      userId,
    });
    const updated = await wordService.updateWordExamples(
      id,
      generated.examples || []
    );
    if (!updated) {
      return errorResponse(res, "Word not found", 404);
    }
    return successResponse(res, "Word examples updated successfully", toWordDTO(updated));
  } catch (error) {
    return errorResponse(res, "Error generating word examples", 500, error);
  }
};

export const generateWordExamplesCodeSwitchingJson = async (
  req: Request,
  res: Response
) => {
  const { word, oldExamples, provider } = req.body;
  const language = req.body.language || req.user?.language || "en";
  const { id } = req.params as { id: string };
  const userId = req.user?._id || req.user?.id || null;

  if (!word) {
    return errorResponse(res, "Word is required.", 400);
  }

  try {
    const generated = await generateWordCodeSwitching(
      word,
      language,
      oldExamples,
      { provider, userId }
    );
    const updated = await wordService.updateWordCodeSwitching(
      id,
      generated.codeSwitching || []
    );
    if (!updated) {
      return errorResponse(res, "Word not found", 404);
    }
    return successResponse(
      res,
      "Word code-switching updated successfully",
      toWordDTO(updated)
    );
  } catch (error) {
    return errorResponse(
      res,
      "Error generating word code-switching examples",
      500,
      error
    );
  }
};

export const generateWordTypesJson = async (req: Request, res: Response) => {
  const { word, oldExamples, provider } = req.body;
  const language = req.body.language || req.user?.language || "en";
  const { id } = req.params as { id: string };
  const userId = req.user?._id || req.user?.id || null;

  if (!word) {
    return errorResponse(res, "Word is required.", 400);
  }

  try {
    const generated = await generateWordTypes(word, language, oldExamples, {
      provider,
      userId,
    });
    const updated = await wordService.updateWordType(
      id,
      generated.type || []
    );
    if (!updated) {
      return errorResponse(res, "Word not found", 404);
    }
    return successResponse(res, "Word types updated successfully", toWordDTO(updated));
  } catch (error) {
    if (error instanceof WordTypeValidationError) {
      return errorResponse(res, error.message, 400, error);
    }
    return errorResponse(res, "Error generating word types", 500, error);
  }
};

export const generateWordSynomymsJson = async (req: Request, res: Response) => {
  const { word, oldExamples, provider } = req.body;
  const language = req.body.language || req.user?.language || "en";
  const { id } = req.params as { id: string };
  const userId = req.user?._id || req.user?.id || null;

  if (!word) {
    return errorResponse(res, "Word is required.", 400);
  }

  try {
    const generated = await generateWordSynonyms(word, language, oldExamples, {
      provider,
      userId,
    });
    const updated = await wordService.updateWordSynonyms(
      id,
      generated.synonyms || []
    );
    if (!updated) {
      return errorResponse(res, "Word not found", 404);
    }
    return successResponse(res, "Word synonyms updated successfully", toWordDTO(updated));
  } catch (error) {
    return errorResponse(res, "Error generating word synonyms", 500, error);
  }
};

export const updateImageWord = async (req: Request, res: Response) => {
  const { word, imgOld } = req.body;
  const IDWord = req.params.id;

  if (!word) {
    return errorResponse(res, "Word is required.", 400);
  }

  try {
    const userId =
      req.user?._id?.toString?.() ?? (req.user as { id?: string })?.id ?? null;
    const imageProvider = (await getAIProvider(
      userId,
      "word",
      "image"
    )) as ImageProvider;
    const imageResponse = await generateImage(imageProvider, imageWordPrompt(word));
    if (!imageResponse) {
      return errorResponse(res, "Failed to generate image.", 400);
    }

    // Extract base64 string from the response object
    const imageBase64 = (imageResponse as any).b64_json;
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
