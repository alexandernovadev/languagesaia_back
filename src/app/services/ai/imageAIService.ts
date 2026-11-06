/**
 * Image generation. Provider and model come from config/aiConfig.ts (IMAGE_AI).
 * Uses fal.ai's synchronous REST endpoint with `sync_mode`, so the image comes
 * back inline as a base64 data URI (nothing is stored on fal's side).
 */

import { IMAGE_AI } from "../../../config/aiConfig";
import logger from "../../utils/logger";

interface FalImageResponse {
  images: Array<{ url: string; width: number; height: number; content_type?: string }>;
  has_nsfw_concepts?: boolean[];
}

/** Returns the generated image as base64 (`b64_json`), ready to upload to Cloudinary. */
export const generateImage = async (prompt: string, size: string = IMAGE_AI.size): Promise<{ b64_json: string }> => {
  try {
    const response = await fetch(`${IMAGE_AI.baseURL}/${IMAGE_AI.model}`, {
      method: "POST",
      headers: {
        Authorization: `Key ${IMAGE_AI.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        image_size: size,
        num_images: 1,
        output_format: IMAGE_AI.outputFormat,
        sync_mode: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`${response.status} ${await response.text()}`);
    }

    const data = (await response.json()) as FalImageResponse;
    const dataUri = data.images?.[0]?.url;
    if (!dataUri?.startsWith("data:")) {
      throw new Error("No inline image returned");
    }

    return { b64_json: dataUri.slice(dataUri.indexOf(",") + 1) };
  } catch (error) {
    logger.error(`Error generating image with ${IMAGE_AI.name}:`, error);
    throw new Error(`Error generating image: ${error}`);
  }
};
