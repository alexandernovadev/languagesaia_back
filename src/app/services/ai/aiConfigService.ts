/**
 * AI Configuration Service
 * Manages user-specific AI provider configurations
 * Direct DB calls, no caching
 */

import AIConfig from "../../db/models/AIConfig";
import { TextProvider } from "../../../config/aiConfig";
import { AIFeature, AIOperation } from "../../../../types/models";
import logger from "../../utils/logger";

// System defaults
const DEFAULT_CONFIGS: Record<AIFeature, Record<string, TextProvider>> = {
  word: {
    generate: "openai",
    examples: "openai",
    codeSwitching: "openai",
    types: "openai",
    synonyms: "openai",
    chat: "openai",
    image: "openai", // Images always use OpenAI (DALL-E)
  },
  expression: {
    generate: "openai",
    chat: "openai",
    image: "openai", // Images always use OpenAI (DALL-E)
  },
  lecture: {
    text: "deepseek",
    topic: "deepseek",
    image: "openai", // Images always use OpenAI (DALL-E)
  },
  exam: {
    generate: "openai",
    validate: "deepseek",
    correct: "deepseek",
    questionChat: "openai",
    questionFeedback: "openai",
    evaluateTranslation: "openai",
  },
  story: {
    text: "deepseek",
    topic: "deepseek",
    image: "openai", // Images always use OpenAI (DALL-E)
  },
};

export class AIConfigService {
  /**
   * Get the configured provider for an operation
   * Direct DB call, no caching
   * Falls back to default on failure
   * Images always use OpenAI (DeepSeek does not support image generation)
   */
  static async getProvider(
    userId: string | null | undefined,
    feature: AIFeature,
    operation: AIOperation
  ): Promise<TextProvider> {
    // Images always use OpenAI (DeepSeek does not support image generation)
    if (operation === "image") {
      return "openai";
    }

    const normalizedUserId = userId || null;
    
    try {
      // Query DB directly
      const config = await AIConfig.findOne({
        userId: normalizedUserId,
        feature,
        operation,
      });

      if (config) {
        return config.provider as TextProvider;
      }
    } catch (error) {
      // Query failed, fall back to default
      logger.error("Error getting AI config from DB:", error);
    }

    // Use system default if no config found or query failed
    return DEFAULT_CONFIGS[feature]?.[operation] || "openai";
  }

  /**
   * Save or update a configuration
   * Direct DB call, no caching
   */
  static async saveConfig(
    userId: string | null | undefined,
    feature: AIFeature,
    operation: AIOperation,
    provider: TextProvider
  ) {
    const normalizedUserId = userId || null;
    
    const config = await AIConfig.findOneAndUpdate(
      { userId: normalizedUserId, feature, operation },
      { provider },
      { upsert: true, new: true }
    );

    return config;
  }

  /**
   * Get all configurations for a user (no cache, for UI display)
   */
  static async getAllConfigs(userId: string | null | undefined) {
    const normalizedUserId = userId || null;
    return await AIConfig.find({ userId: normalizedUserId }).sort({ feature: 1, operation: 1 });
  }

  /**
   * Delete a specific configuration
   */
  static async deleteConfig(
    userId: string | null | undefined,
    feature: AIFeature,
    operation: AIOperation
  ) {
    const normalizedUserId = userId || null;
    const result = await AIConfig.findOneAndDelete({
      userId: normalizedUserId,
      feature,
      operation,
    });

    return result;
  }

  /**
   * Get system defaults
   */
  static getDefaults(): typeof DEFAULT_CONFIGS {
    return DEFAULT_CONFIGS;
  }
}
