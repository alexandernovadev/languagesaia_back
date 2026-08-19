import { Request, Response } from "express";
import { LectureService } from "../services/lectures/LectureService";
import { LectureExportService } from "../services/lectures/LectureExportService";
import { LectureImportService } from "../services/import/LectureImportService";
import { successResponse, errorResponse } from "../utils/responseHelpers";
import { parseLimit } from "../utils/pagination";
import { validateJsonBuffer, MAX_IMPORT_ITEMS } from "../middlewares/uploadMiddleware";
import {
  deleteImageFromCloudinary,
  uploadImageToCloudinary,
} from "../services/cloudinary/cloudinaryService";
import {
  generateLectureText,
  generateLectureTopic,
  createLectureImagePrompt,
} from "../services/ai/lectureAIService";
import { WordQueryService } from "../services/words/WordQueryService";
import { promptAddEasyWords } from "../services/ai/prompts/promptAddEasyWords";
import { generateImage } from "../services/ai/imageAIService";
import { generateLectureAudio } from "../services/audio/lectureAudioService";
import { createMarkdownTableFilter } from "../utils/text/sanitizeLectureContent";
import { getAIProvider } from "../services/ai/aiConfigHelper";
import type { ImageProvider } from "../../config/aiConfig";
import logger from "../utils/logger";
import { LectureCreateSchema, LectureUpdateSchema, parseBody } from "../validators/schemas";
import { toLectureDTO, mapPaginated } from "../dto/mappers";

const lectureService = new LectureService();
const lectureExportService = new LectureExportService();
const lectureImportService = new LectureImportService();
const wordQueryService = new WordQueryService();

export const createLecture = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const lectureData = parseBody(LectureCreateSchema, req.body, res);
    if (!lectureData) return errorResponse(res, "Invalid request body", 400);
    const lecture = await lectureService.createLecture(lectureData as any);

    return successResponse(res, "Lecture created successfully", toLectureDTO(lecture), 201);
  } catch (error) {
    logger.error("Error creating lecture:", error);
    return errorResponse(res, "Error creating lecture");
  }
};

export const getLectureById = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const lecture = await lectureService.getLectureById(req.params.id);
    if (!lecture) {
      return errorResponse(res, "Lecture not found", 404);
    }

    return successResponse(res, "Lecture Listed by ID successfully", toLectureDTO(lecture));
  } catch (error) {
    return errorResponse(res, "Error retrieving lecture", 500, error);
  }
};

export const updateLecture = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const updateData = parseBody(LectureUpdateSchema, req.body, res);
    if (!updateData) return errorResponse(res, "Invalid request body", 400);
    const lecture = await lectureService.updateLecture(req.params.id, updateData as any);
    if (!lecture) {
      return errorResponse(res, "Lecture not found", 404);
    }

    return successResponse(res, "Lecture Updated successfully", toLectureDTO(lecture));
  } catch (error) {
    return errorResponse(res, "Error updating lecture", 500, error);
  }
};

export const deleteLecture = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const lecture = await lectureService.deleteLecture(req.params.id);
    if (!lecture) {
      return errorResponse(res, "Lecture not found", 404);
    }

    return successResponse(res, "Lecture deleted successfully", {});
  } catch (error) {
    return errorResponse(res, "Error deleting lecture", 500, error);
  }
};

export const updateImageLecureById = async (req: Request, res: Response) => {
  const ID = req.params.id;
  const { image } = req.body;

  try {
    const updatedLecture = await lectureService.updateImage(ID, image);
    if (!updatedLecture) {
      return errorResponse(res, "Lecture not found", 404);
    }
    return successResponse(
      res,
      "Lecture Update Image Lecture ById successfully",
      toLectureDTO(updatedLecture)
    );
  } catch (error) {
    logger.error("Error updating Image lecture:", error);
    return errorResponse(res, "Error updating Image lecture", 500, error);
  }
};

export const getAllLectures = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const {
      page: qPage,
      limit: qLimit,
      search = "",
      level,
      language,
      typeWrite,
      timeMin,
      timeMax,
      hasImg,
      hasUrlAudio,
      createdAfter,
      createdBefore,
      updatedAfter,
      updatedBefore,
      sortBy,
      sortOrder,
    } = req.query as any;

    const page = parseInt(qPage) || 1;
    const limit = parseLimit(qLimit, 10);

    // Parse comma-separated strings into arrays for level, language, typeWrite
    const parseArrayParam = (param: string | string[] | undefined): string | string[] | undefined => {
      if (!param) return undefined;
      if (Array.isArray(param)) return param;
      // If it's a string with commas, split it
      if (typeof param === 'string' && param.includes(',')) {
        return param.split(',').map(v => v.trim()).filter(v => v);
      }
      return param;
    };

    const languageToUse = parseArrayParam(language) ?? (req.user?.language ? [req.user.language] : undefined);
    const lectures = await lectureService.getLecturesAdvanced({
      page,
      limit,
      search,
      level: parseArrayParam(level),
      language: languageToUse,
      typeWrite: parseArrayParam(typeWrite),
      timeMin: timeMin ? Number(timeMin) : undefined,
      timeMax: timeMax ? Number(timeMax) : undefined,
      hasImg: hasImg as "true" | "false" | undefined,
      hasUrlAudio: hasUrlAudio as "true" | "false" | undefined,
      createdAfter,
      createdBefore,
      updatedAfter,
      updatedBefore,
      sortBy,
      sortOrder,
    });

    return successResponse(res, "Lectures retrieved successfully", mapPaginated(lectures, toLectureDTO));
  } catch (error) {
    return errorResponse(res, "Error fetching lectures", 500, error);
  }
};

export const exportLecturesToJSON = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const lectures = await lectureExportService.getAllLecturesForExport();

    // Set headers for file download
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `lectures-export-${timestamp}.json`;

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    // Send the JSON data
    return successResponse(res, `Exported ${lectures.length} lectures successfully`, {
      totalLectures: lectures.length,
      exportDate: new Date().toISOString(),
      lectures,
    });
  } catch (error) {
    return errorResponse(
      res,
      "An error occurred while exporting lectures to JSON",
      500,
      error
    );
  }
};

export const importLecturesFromFile = async (
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
    let lectures: any[] = [];

    // Try to find lectures in different possible structures
    if (fileData.data?.lectures && Array.isArray(fileData.data.lectures)) {
      // Direct structure: data.lectures
      lectures = fileData.data.lectures;
    } else if (
      fileData.data?.data?.lectures &&
      Array.isArray(fileData.data.data.lectures)
    ) {
      // Nested structure: data.data.lectures (from export)
      lectures = fileData.data.data.lectures;
    } else if (fileData.lectures && Array.isArray(fileData.lectures)) {
      // Root level: lectures
      lectures = fileData.lectures;
    } else {
      return errorResponse(
        res,
        "Invalid file structure. Expected 'data.lectures' or 'data.data.lectures' array",
        400
      );
    }

    if (lectures.length > MAX_IMPORT_ITEMS) {
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
      const validationResults = await lectureImportService.validateLectures(
        lectures
      );
      const validCount = validationResults.filter(
        (r) => r.status === "valid"
      ).length;
      const invalidCount = validationResults.filter(
        (r) => r.status === "invalid"
      ).length;

      return successResponse(res, "Validation completed", {
        totalLectures: lectures.length,
        valid: validCount,
        invalid: invalidCount,
        validationResults,
      });
    }

    // Import lectures
    const importResult = await lectureImportService.importLectures(lectures, {
      duplicateStrategy: duplicateStrategy as any,
      validateOnly: false,
      batchSize: batchSizeNum,
    });

    return successResponse(res, "Import completed successfully", importResult);
  } catch (error) {
    logger.error("Import error:", error);
    return errorResponse(res, "Error importing lectures", 500, error);
  }
};

// ===== AI GENERATION FUNCTIONS FOR LECTURES =====

export const generateAudioForLecture = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { voice, instructions } = req.body || {};

  try {
    const result = await generateLectureAudio(id, voice || undefined, instructions || undefined);
    return successResponse(
      res,
      "Lecture audio generated successfully",
      { urlAudio: result.urlAudio, recordId: result.recordId }
    );
  } catch (error: any) {
    logger.error("Error generating lecture audio:", error);
    const status = error.message?.includes("not found") ? 404 : 500;
    return errorResponse(res, error.message || "Error generating lecture audio", status, error);
  }
};

export const updateImageLecture = async (req: Request, res: Response) => {
  const { lectureString, imgOld } = req.body;
  const IDLecture = req.params.idlecture;

  if (!lectureString) {
    return errorResponse(res, "Lecture prompt is required.", 400);
  }

  try {
    const userId =
      req.user?._id?.toString?.() ?? (req.user as { id?: string })?.id ?? null;
    const imageProvider = (await getAIProvider(
      userId,
      "lecture",
      "image"
    )) as ImageProvider;
    const imageResponse = await generateImage(
      imageProvider,
      createLectureImagePrompt(lectureString)
    );
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
        "languagesai/lectures/" + publicId
      );
    }

    // Upload new image while deleting the old one
    const [_, urlImage] = await Promise.all([
      deleteOldImagePromise,
      uploadImageToCloudinary(imageBase64, "lectures"),
    ]);

    // Update lecture image
    const updatedLecture = await lectureService.updateImage(
      IDLecture,
      urlImage
    );

    return successResponse(
      res,
      "Lecture image updated successfully",
      toLectureDTO(updatedLecture)
    );
  } catch (error) {
    return errorResponse(res, "Error generating lecture image", 500, error);
  }
};

export const generateTextStream = async (req: Request, res: Response) => {
  const {
    prompt,
    level,
    typeWrite,
    addEasyWords,
    language,
    rangeMin,
    rangeMax,
    grammarTopics,
    selectedWords,
  } = req.body;

  // Allow empty prompt: when empty, backend should generate a random topic.
  // If prompt has content, it must be passed through faithfully to guide generation.
  if (typeof prompt !== "string") {
    return errorResponse(res, "Prompt must be a string.", 400);
  }

  try {
    let promptWords = "";

    if (addEasyWords) {
      const getEasyWords = await wordQueryService.getLastEasyWords();
      const wordsArray = getEasyWords.map((item) => item.word);
      promptWords = promptAddEasyWords(wordsArray);
    }

    // Set up streaming headers
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    const userId = req.user?._id || req.user?.id || null;
    // Pasar stream: true en las opciones
    const stream = await generateLectureText({
      prompt: (prompt || "").toString(),
      level,
      typeWrite,
      promptWords,
      language: language || req.user?.language || "en",
      rangeMin,
      rangeMax,
      grammarTopics: Array.isArray(grammarTopics) ? grammarTopics : [],
      selectedWords: Array.isArray(selectedWords) ? selectedWords : [],
    }, {
      stream: true,
      userId,
    });

    // Read the stream, strip markdown tables live, and send to the client
    const tableFilter = createMarkdownTableFilter();
    for await (const chunk of stream as any) {
      const content = chunk.choices?.[0]?.delta?.content || "";
      if (content) {
        res.write(tableFilter.push(content));
      }
    }
    res.write(tableFilter.flush());

    // Close the stream when done
    res.end();
  } catch (error) {
    return errorResponse(
      res,
      "Error trying to generate text stream",
      500,
      error
    );
  }
};

export const generateTopicStream = async (req: Request, res: Response) => {
  try {
    const { existingText, type } = req.body;

    // Validate required fields
    if (!type || !["lecture", "exam"].includes(type)) {
      return errorResponse(
        res,
        "Type is required and must be 'lecture' or 'exam'",
        400
      );
    }

    // Validate existingText length if provided
    if (existingText && existingText.length > 500) {
      return errorResponse(
        res,
        "Existing text cannot exceed 500 characters",
        400
      );
    }

    // Set headers for streaming
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    const userId = req.user?._id || req.user?.id || null;
    const language = req.user?.language || "en";
    const stream = await generateLectureTopic({
      existingText: existingText || "",
      type,
      language,
    }, {
      stream: true,
      userId,
    });

    // Stream the response
    for await (const chunk of stream as any) {
      const content = chunk.choices?.[0]?.delta?.content || "";
      if (content) {
        res.write(content);
      }
    }

    res.end();
  } catch (error: any) {
    logger.error("Error generating topic stream:", error);
    return errorResponse(res, "Error generating topic", 500, error);
  }
};
