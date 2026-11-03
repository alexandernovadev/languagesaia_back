/**
 * Image generation. Provider and model come from config/aiConfig.ts (IMAGE_AI).
 */

import OpenAI from "openai";
import { IMAGE_AI } from "../../../config/aiConfig";
import logger from "../../utils/logger";

const client = new OpenAI({ apiKey: IMAGE_AI.apiKey, baseURL: IMAGE_AI.baseURL });

/** Returns the first generated image (`b64_json`). */
export const generateImage = async (prompt: string) => {
  try {
    const response = await client.images.generate({
      model: IMAGE_AI.model,
      prompt,
      n: 1,
      size: "1024x1024",
      quality: "hd",
      response_format: "b64_json",
    });
    return response.data[0];
  } catch (error) {
    logger.error(`Error generating image with ${IMAGE_AI.name}:`, error);
    throw new Error(`Error generating image: ${error}`);
  }
};
