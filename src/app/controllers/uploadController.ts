import { Request, Response } from "express";
import { successResponse, errorResponse } from "../utils/responseHelpers";
import logger from "../utils/logger";
import { uploadImageToCloudinary, deleteImageFromCloudinary } from "../services/cloudinary/cloudinaryService";
import Word from "../db/models/Word";
import Lecture from "../db/models/Lecture";
import Expression from "../db/models/Expression";
import Story from "../db/models/Story";

interface UploadRequest extends Request {
  file?: Express.Multer.File;
}

export const uploadImageHandler = async (
  req: UploadRequest,
  res: Response
): Promise<void> => {
  try {
    const { entityType, entityId } = req.params;
    const imageFile = req.file;

    if (!imageFile) {
      errorResponse(res, "No image file provided", 400);
      return;
    }

    if (!entityId) {
      errorResponse(res, "Entity ID required", 400);
      return;
    }

    // Validate entity type
    if (!["word", "lecture", "expression", "story"].includes(entityType)) {
      errorResponse(res, "Invalid entity type", 400);
      return;
    }

    let result;

    // Upload image according to entity type
    let entity;
    let folder;
    
    switch (entityType) {
      case "word":
        entity = await Word.findById(entityId);
        folder = "words";
        break;
      case "lecture":
        entity = await Lecture.findById(entityId);
        folder = "lectures";
        break;
      case "expression":
        entity = await Expression.findById(entityId);
        folder = "expressions";
        break;
      case "story":
        entity = await Story.findById(entityId);
        folder = "stories";
        break;
      default:
        errorResponse(res, "Unsupported entity type", 400);
        return;
    }

    if (!entity) {
      errorResponse(res, `${entityType} not found`, 404);
      return;
    }

    // Delete old image if exists
    if (entity.img && entity.img.includes("res.cloudinary.com")) {
      const parts = entity.img.split("/");
      let publicId = parts.pop()?.split(".")[0];
      if (publicId) {
        await deleteImageFromCloudinary(`languagesai/${folder}/${publicId}`);
      }
    }

    // Upload new image
    const imageUrl = await uploadImageToCloudinary(imageFile.buffer, folder);
    
    // Update entity with new image URL
    await entity.constructor.findByIdAndUpdate(entityId, { img: imageUrl });

    result = {
      img: imageUrl,
      entityId,
      entityType,
    };

    successResponse(res, "Image uploaded successfully", {
      img: result.img,
      entityId: result.entityId,
      entityType: result.entityType,
    });
  } catch (error: any) {
    logger.error("Error in uploadImageHandler:", error);

    if (error.message.includes("not found")) {
      errorResponse(res, error.message, 404);
      return;
    }

    errorResponse(res, "Internal server error", 500, error);
  }
};
