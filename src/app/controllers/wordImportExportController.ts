/** Words: JSON export and import. */
import { Request, Response } from "express";
import { WordExportService } from "../services/words/WordExportService";
import { WordImportService } from "../services/import/WordImportService";
import { errorResponse, successResponse } from "../utils/responseHelpers";
import { validateJsonBuffer, MAX_IMPORT_ITEMS } from "../middlewares/uploadMiddleware";
import logger from "../utils/logger";

const wordExportService = new WordExportService();
const wordImportService = new WordImportService();

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

    // validateOnly: report what would happen, without importing
    if (validateOnlyBool) {
      return successResponse(res, "Validation completed", await wordImportService.previewWords(words));
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
