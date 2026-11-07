import { getUserId, timeZoneOf } from "../utils/http/requestUser";
import { Request, Response } from "express";
import { ExpressionService } from "../services/expressions/expressionService";
import progressService from "../services/progress/ProgressService";
import { ADD_WORD_XP } from "../../config/constants";
import { ExpressionChatService } from "../services/expressions/ExpressionChatService";
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
import logger from "../utils/logger";
import { setSSEHeaders, streamTextResponse } from "../utils/http/sse";
import { ExpressionCreateSchema, ExpressionUpdateSchema, parseBody } from "../validators/schemas";
import { toExpressionDTO, mapPaginated } from "../dto/mappers";
import { generateImage } from "../services/ai/imageAIService";
import { routeParams } from "../utils/http/routeParams";

const expressionService = new ExpressionService();
const expressionChatService = new ExpressionChatService();

// Create a new expression
export const createExpression = async (req: Request, res: Response) => {
  try {
    const expressionData = parseBody(ExpressionCreateSchema, req.body, res);
    if (!expressionData) return res;
    const expression = await expressionService.createExpression(expressionData as any);
    const reward = await progressService.award(getUserId(req), ADD_WORD_XP, timeZoneOf(req));
    return successResponse(
      res,
      "Expression created successfully",
      { ...toExpressionDTO(expression), reward },
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
    if (!updateData) return res;
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
      // Saved together, only once the answer is complete
      onComplete: async (text) => {
        await expressionChatService.addUserMessage(id, message);
        await expressionChatService.addAssistantMessage(id, text);
      },
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
