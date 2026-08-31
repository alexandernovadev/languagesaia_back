import { Request, Response } from "express";
import { AIConfigService } from "../services/ai/aiConfigService";
import { errorResponse, successResponse } from "../utils/responseHelpers";
import { AIFeature, AIOperation } from "../../../types/models";
import { TextProvider } from "../../config/aiConfig";
import logger from "../utils/logger";

/**
 * Get all configurations for the current user
 */
export const getAIConfigs = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id || req.user?.id || null;
    const configs = await AIConfigService.getAllConfigs(userId);
    const defaults = AIConfigService.getDefaults();

    return successResponse(res, "AI configurations retrieved successfully", {
      configs,
      defaults,
    });
  } catch (error: any) {
    logger.error("Error getting AI configs:", error);
    return errorResponse(res, "Error retrieving AI configurations", 500, error);
  }
};

/**
 * Get a specific configuration
 */
export const getAIConfig = async (req: Request, res: Response) => {
  try {
    const { feature, operation } = req.params as { feature: AIFeature; operation: AIOperation };
    const userId = req.user?._id || req.user?.id || null;

    if (!feature || !operation) {
      return errorResponse(res, "Feature and operation are required", 400);
    }

    const provider = await AIConfigService.getProvider(userId, feature, operation);
    const defaults = AIConfigService.getDefaults();

    return successResponse(res, "AI configuration retrieved successfully", {
      feature,
      operation,
      provider,
      default: defaults[feature]?.[operation] || "openai",
    });
  } catch (error: any) {
    logger.error("Error getting AI config:", error);
    return errorResponse(res, "Error retrieving AI configuration", 500, error);
  }
};

/**
 * Create or update a configuration
 */
export const saveAIConfig = async (req: Request, res: Response) => {
  try {
    const { feature, operation, provider } = req.body as {
      feature: AIFeature;
      operation: AIOperation;
      provider: TextProvider;
    };
    const userId = req.user?._id || req.user?.id || null;

    if (!feature || !operation || !provider) {
      return errorResponse(res, "Feature, operation, and provider are required", 400);
    }

    if (!["word", "expression", "exam"].includes(feature)) {
      return errorResponse(
        res,
        "Invalid feature. Must be 'word', 'expression', or 'exam'",
        400
      );
    }

    if (!['openai', 'deepseek'].includes(provider)) {
      return errorResponse(res, "Invalid provider. Must be 'openai' or 'deepseek'", 400);
    }

    // Images cannot use DeepSeek (only OpenAI supports image generation)
    if (operation === "image" && provider === "deepseek") {
      return errorResponse(res, "Las imágenes solo pueden usar OpenAI. DeepSeek no soporta generación de imágenes.", 400);
    }

    const config = await AIConfigService.saveConfig(userId, feature, operation, provider);

    return successResponse(res, "AI configuration saved successfully", config);
  } catch (error: any) {
    logger.error("Error saving AI config:", error);
    return errorResponse(res, "Error saving AI configuration", 500, error);
  }
};

/**
 * Delete a configuration (restores to default)
 */
export const deleteAIConfig = async (req: Request, res: Response) => {
  try {
    const { feature, operation } = req.params as { feature: AIFeature; operation: AIOperation };
    const userId = req.user?._id || req.user?.id || null;

    if (!feature || !operation) {
      return errorResponse(res, "Feature and operation are required", 400);
    }

    const result = await AIConfigService.deleteConfig(userId, feature, operation);

    if (!result) {
      return errorResponse(res, "Configuration not found", 404);
    }

    return successResponse(res, "AI configuration deleted successfully", result);
  } catch (error: any) {
    logger.error("Error deleting AI config:", error);
    return errorResponse(res, "Error deleting AI configuration", 500, error);
  }
};

/**
 * Get system defaults
 */
export const getDefaults = async (req: Request, res: Response) => {
  try {
    const defaults = AIConfigService.getDefaults();
    return successResponse(res, "Default configurations retrieved successfully", defaults);
  } catch (error: any) {
    logger.error("Error getting defaults:", error);
    return errorResponse(res, "Error retrieving default configurations", 500, error);
  }
};
