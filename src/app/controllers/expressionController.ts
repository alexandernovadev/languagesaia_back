import { Request, Response } from "express";
import { ExpressionService } from "../services/expressions/expressionService";
import { ExpressionChatService } from "../services/expressions/ExpressionChatService";
import { ExpressionImportExportService } from "../services/expressions/ExpressionImportExportService";
import {
  generateExpressionData,
  generateExpressionChat,
} from "../services/ai/expressionAIService";
import {
  deleteImageFromCloudinary,
  uploadImageToCloudinary,
} from "../services/cloudinary/cloudinaryService";
import { expressionImagePrompt } from "../services/ai/prompts";
import { successResponse, errorResponse } from "../utils/responseHelpers";
import { validateJsonBuffer, MAX_IMPORT_ITEMS } from "../middlewares/uploadMiddleware";
import logger from "../utils/logger";
import { setSSEHeaders, streamTextResponse } from "../utils/http/sse";
import { ExpressionCreateSchema, ExpressionUpdateSchema, parseBody } from "../validators/schemas";
import { toExpressionDTO, mapPaginated } from "../dto/mappers";
import { generateImage } from "../services/ai/imageAIService";
import { routeParams } from "../utils/http/routeParams";

const expressionService = new ExpressionService();
const expressionChatService = new ExpressionChatService();
const expressionImportExportService = new ExpressionImportExportService();

// Create a new expression
export const createExpression = async (req: Request, res: Response) => {
  try {
    const expressionData = parseBody(ExpressionCreateSchema, req.body, res);
    if (!expressionData) return errorResponse(res, "Invalid request body", 400);
    const expression = await expressionService.createExpression(expressionData as any);
    return successResponse(
      res,
      "Expression created successfully",
      toExpressionDTO(expression),
      201
    );
  } catch (error: any) {
    logger.error("Error creating expression:", error);
    return errorResponse(res, error.message, 400, error);
  }
};

// Get an expression by ID
export const getExpressionById = async (req: Request, res: Response) => {
  try {
    const expression = await expressionService.getExpressionById(routeParams(req).id);
    if (!expression) {
      return errorResponse(res, "Expression not found", 404);
    }
    return successResponse(
      res,
      "Expression retrieved successfully",
      toExpressionDTO(expression)
    );
  } catch (error: any) {
    logger.error("Error getting expression by ID:", error);
    return errorResponse(res, error.message, 500, error);
  }
};

// Get all expressions with filters
export const getExpressions = async (req: Request, res: Response) => {
  try {
    const filters = { ...req.query, language: (req.query.language as string) || req.user?.language };
    const result = await expressionService.getExpressions(filters);
    return successResponse(res, "Expressions retrieved successfully", mapPaginated(result, toExpressionDTO));
  } catch (error: any) {
    logger.error("Error getting expressions:", error);
    return errorResponse(res, error.message, 500, error);
  }
};

// Update an expression
export const updateExpression = async (req: Request, res: Response) => {
  try {
    const updateData = parseBody(ExpressionUpdateSchema, req.body, res);
    if (!updateData) return errorResponse(res, "Invalid request body", 400);
    const expression = await expressionService.updateExpression(
      routeParams(req).id,
      updateData as any
    );
    if (!expression) {
      return errorResponse(res, "Expression not found", 404);
    }
    return successResponse(res, "Expression updated successfully", toExpressionDTO(expression));
  } catch (error: any) {
    logger.error("Error updating expression:", error);
    return errorResponse(res, error.message, 400, error);
  }
};

// Delete an expression
export const deleteExpression = async (req: Request, res: Response) => {
  try {
    const expression = await expressionService.deleteExpression(routeParams(req).id);
    if (!expression) {
      return errorResponse(res, "Expression not found", 404);
    }
    return successResponse(res, "Expression deleted successfully", {});
  } catch (error: any) {
    logger.error("Error deleting expression:", error);
    return errorResponse(res, error.message, 500, error);
  }
};

// Find expression by expression text
export const getExpressionByExpression = async (
  req: Request,
  res: Response
) => {
  try {
    const expression = await expressionService.findExpressionByExpression(
      routeParams(req).expression
    );
    if (!expression) {
      return errorResponse(res, "Expression not found", 404);
    }
    return successResponse(
      res,
      "Expression retrieved successfully",
      toExpressionDTO(expression)
    );
  } catch (error: any) {
    logger.error("Error finding expression by expression text:", error);
    return errorResponse(res, error.message, 500, error);
  }
};

// Get expressions by type
export const getExpressionsByType = async (req: Request, res: Response) => {
  try {
    const { type } = routeParams(req);
    const { limit = 10, search } = req.query;
    const expressions = await expressionService.getExpressionsByType(
      type,
      Number(limit),
      search as string
    );
    return successResponse(
      res,
      `Expressions of type ${type} retrieved successfully`,
      expressions.map(toExpressionDTO)
    );
  } catch (error: any) {
    logger.error("Error getting expressions by type:", error);
    return errorResponse(res, error.message, 500, error);
  }
};

// Get expressions only (for performance)
export const getExpressionsOnly = async (req: Request, res: Response) => {
  try {
    const filters = { ...req.query, language: (req.query.language as string) || req.user?.language };
    const result = await expressionService.getExpressionsOnly(filters);
    return successResponse(res, "Expressions retrieved successfully", result);
  } catch (error: any) {
    logger.error("Error getting expressions only:", error);
    return errorResponse(res, error.message, 500, error);
  }
};

// Export expressions to JSON
export const exportExpressionsToJSON = async (req: Request, res: Response) => {
  try {
    const expressions = await expressionImportExportService.getAllExpressionsForExport();

    // Set headers for file download
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `expressions-export-${timestamp}.json`;

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    // Send the JSON data
    return successResponse(res, `Exported ${expressions.length} expressions successfully`, {
      totalExpressions: expressions.length,
      exportDate: new Date().toISOString(),
      expressions,
    });
  } catch (error: any) {
    logger.error("Error exporting expressions:", error);
    return errorResponse(res, error.message, 500, error);
  }
};

// Import expressions from JSON file
export const importExpressionsFromFile = async (
  req: Request,
  res: Response
) => {
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
    let expressions: any[] = [];

    // Try to find expressions in different possible structures
    if (
      fileData.data?.expressions &&
      Array.isArray(fileData.data.expressions)
    ) {
      // Direct structure: data.expressions
      expressions = fileData.data.expressions;
    } else if (
      fileData.data?.data?.expressions &&
      Array.isArray(fileData.data.data.expressions)
    ) {
      // Nested structure: data.data.expressions (from export)
      expressions = fileData.data.data.expressions;
    } else if (fileData.expressions && Array.isArray(fileData.expressions)) {
      // Root level: expressions
      expressions = fileData.expressions;
    } else {
      return errorResponse(
        res,
        "Invalid file structure. Expected 'data.expressions' or 'data.data.expressions' array",
        400
      );
    }

    if (expressions.length > MAX_IMPORT_ITEMS) {
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
      const validationResults = expressions.map(
        (expression: any, index: number) => ({
          index,
          data: expression,
          status:
            expression.expression && expression.definition
              ? "valid"
              : "invalid",
          errors: !expression.expression
            ? ["Expression is required"]
            : !expression.definition
            ? ["Definition is required"]
            : [],
        })
      );

      const validCount = validationResults.filter(
        (r: any) => r.status === "valid"
      ).length;
      const invalidCount = validationResults.filter(
        (r: any) => r.status === "invalid"
      ).length;

      return successResponse(res, "Validation completed", {
        totalExpressions: expressions.length,
        valid: validCount,
        invalid: invalidCount,
        validationResults,
        message: `Validation completed. ${validCount} valid, ${invalidCount} invalid`,
      });
    }

    // Import expressions
    const importResult = await expressionImportExportService.importExpressions(
      expressions,
      {
        duplicateStrategy: duplicateStrategy as
          | "skip"
          | "overwrite"
          | "error"
          | "merge",
        batchSize: batchSizeNum,
      }
    );

    return successResponse(res, "Import completed successfully", importResult);
  } catch (error: any) {
    logger.error("Error importing expressions:", error);
    return errorResponse(res, error.message, 500, error);
  }
};

// Chat methods
export const addChatMessage = async (req: Request, res: Response) => {
  try {
    const { id } = routeParams(req);
    const { message } = req.body;

    if (!message) {
      return errorResponse(res, "Message is required", 400);
    }

    const expression = await expressionChatService.addChatMessage(
      id,
      message
    );
    if (!expression) {
      return errorResponse(res, "Expression not found", 404);
    }

    return successResponse(res, "Chat message added successfully", {
      expression: toExpressionDTO(expression),
    });
  } catch (error: any) {
    logger.error("Error adding chat message:", error);
    return errorResponse(res, error.message, 500, error);
  }
};

export const getChatHistory = async (req: Request, res: Response) => {
  try {
    const { id } = routeParams(req);
    const chatHistory = await expressionChatService.getChatHistory(id);
    return successResponse(
      res,
      "Chat history retrieved successfully",
      chatHistory
    );
  } catch (error: any) {
    logger.error("Error getting chat history:", error);
    return errorResponse(res, error.message, 500, error);
  }
};

export const clearChatHistory = async (req: Request, res: Response) => {
  try {
    const { id } = routeParams(req);
    const expression = await expressionChatService.clearChatHistory(id);
    if (!expression) {
      return errorResponse(res, "Expression not found", 404);
    }
    return successResponse(res, "Chat history cleared successfully", {});
  } catch (error: any) {
    logger.error("Error clearing chat history:", error);
    return errorResponse(res, error.message, 500, error);
  }
};

// Streaming chat response (AI)
export const streamChatResponse = async (req: Request, res: Response) => {
  try {
    const { id } = routeParams(req);
    const { message } = req.body;
    if (!message) {
      return errorResponse(res, "Message is required", 400);
    }
    const expression = await expressionService.getExpressionById(id);
    if (!expression) {
      return errorResponse(res, "Expression not found", 404);
    }
    await expressionChatService.addUserMessage(id, message);
    setSSEHeaders(res);
    const chatHistory = expression.chat || [];
    const explainsLanguage = req.user?.explainsLanguage || "es";
    const params = {
      expressionText: expression.expression,
      expressionDefinition: expression.definition,
      userMessage: message,
      chatHistory,
      language: expression.language || "en",
      explainsLanguage,
    };
    const userId = req.user?._id || req.user?.id || null;
    const stream = await generateExpressionChat(params, { stream: true, userId });
    await streamTextResponse(res, stream as any, {
      filterMarkdownTables: false,
      onComplete: (text) => expressionChatService.addAssistantMessage(id, text),
    });
  } catch (error: any) {
    logger.error("Error streaming chat response:", error);
    return errorResponse(res, error.message, 500, error);
  }
};

// Generate expressions with AI
export const generateExpression = async (req: Request, res: Response) => {
  try {
    const { prompt, options = {} } = req.body;
    const language = req.body.language || req.user?.language || "en";
    const userId = req.user?._id || req.user?.id || null;
    if (!prompt) {
      return errorResponse(res, "Prompt is required", 400);
    }
    const data = await generateExpressionData({ prompt, language }, { ...options, userId });
    return successResponse(res, "Expression generated successfully", data);
  } catch (error: any) {
    logger.error("Error generating expression:", error);
    return errorResponse(res, error.message, 500, error);
  }
};

// ===== AI IMAGE GENERATION FOR EXPRESSIONS =====

export const updateImageExpression = async (req: Request, res: Response) => {
  const { expressionString, imgOld } = req.body;
  const IDExpression = routeParams(req).id;

  if (!expressionString) {
    return errorResponse(res, "Expression prompt is required.", 400);
  }

  try {
    const expressionDoc = await expressionService.getExpressionById(IDExpression);
    const imageResponse = await generateImage(await expressionImagePrompt(expressionDoc ?? { expression: expressionString }));
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
      let publicId = parts.pop() as string;

      if (publicId && publicId.includes(".")) {
        publicId = publicId.split(".")[0];
      }

      deleteOldImagePromise = deleteImageFromCloudinary(
        "languagesai/expressions/" + publicId
      );
    }

    const [_, urlImage] = await Promise.all([
      deleteOldImagePromise,
      uploadImageToCloudinary(imageBase64, "expressions"),
    ]);

    if (!urlImage) {
      return errorResponse(res, "Failed to upload image to Cloudinary.", 500);
    }

    const updatedExpression = await expressionService.updateExpressionImg(
      IDExpression,
      urlImage as string
    );

    if (!updatedExpression) {
      return errorResponse(res, "Expression not found or failed to update.", 404);
    }

    // Ensure the response includes the img field
    const responseData = {
      img: updatedExpression.img || urlImage,
    };

    return successResponse(
      res,
      "Expression image updated successfully",
      responseData
    );
  } catch (error) {
    return errorResponse(res, "Error generating expression image", 500, error);
  }
};
