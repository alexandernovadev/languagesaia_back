/**
 * Image generation — OpenAI DALL·E (DeepSeek has no image models).
 */

import OpenAI from "openai";
import { OPENAI } from "../../../config/aiConfig";
import logger from "../../utils/logger";

const client = new OpenAI({ apiKey: OPENAI.apiKey, baseURL: OPENAI.baseURL });

/** Returns the first generated image (`b64_json`). */
export const generateImage = async (prompt: string) => {
  try {
    const response = await client.images.generate({
      model: OPENAI.imageModel,
      prompt,
      n: 1,
      size: "1024x1024",
      quality: "hd",
      response_format: "b64_json",
    });
    return response.data[0];
  } catch (error) {
    logger.error("Error generating image with DALL-E:", error);
    throw new Error(`Error generating image: ${error}`);
  }
};
