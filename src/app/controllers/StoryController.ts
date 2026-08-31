import { Request, Response } from "express";
import { StoryService } from "../services/stories/StoryService";
import { successResponse, errorResponse } from "../utils/responseHelpers";
import { parseLimit, parseArrayParam } from "../utils/pagination";
import { toStoryDTO, mapPaginated } from "../dto/mappers";
import {
  StoryCreateSchema,
  StoryUpdateSchema,
  StoryIdeaSchema,
  ChapterGenerateSchema,
  ChapterSaveSchema,
  parseBody,
} from "../validators/schemas";
import { generateChapterText, generateStoryIdea, generateChapterTitle } from "../services/ai/storyAIService";
import { generateImage } from "../services/ai/imageAIService";
import { createStoryImagePrompt } from "../services/ai/prompts";
import { getAIProvider } from "../services/ai/aiConfigHelper";
import type { ImageProvider } from "../../config/aiConfig";
import {
  deleteImageFromCloudinary,
  uploadImageToCloudinary,
} from "../services/cloudinary/cloudinaryService";
import { setSSEHeaders, streamTextResponse } from "../utils/http/sse";
import { getUserId } from "../utils/http/requestUser";
import logger from "../utils/logger";
import storyImportExportService from "../services/import/StoryImportExportService";
import { MAX_IMPORT_ITEMS } from "../../config/constants";
import { validateJsonBuffer } from "../middlewares/uploadMiddleware";
import {
  DEFAULT_TTS_VOICE,
  generateChapterAudio,
  transcribeAudioWithWordTimestamps,
} from "../services/audio/textToSpeechService";
import { deleteAudioFromPocketBase, uploadAudioToPocketBase } from "../services/audio/pocketBaseService";

const storyService = new StoryService();

export const exportStoriesToJSON = async (req: Request, res: Response): Promise<Response> => {
  try {
    const backup = await storyImportExportService.getBackupForExport();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="stories-export-${timestamp}.json"`);
    return successResponse(res, `Exported ${backup.stories.length} stories successfully`, {
      type: "stories",
      version: 1,
      exportDate: new Date().toISOString(),
      totalStories: backup.stories.length,
      totalProgress: backup.storyProgress.length,
      stories: backup.stories,
      storyProgress: backup.storyProgress,
    });
  } catch (error) {
    logger.error("Error exporting stories:", error);
    return errorResponse(res, "Error exporting stories", 500, error);
  }
};

export const importStoriesFromFile = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!req.file) return errorResponse(res, "No file uploaded", 400);
    if (!validateJsonBuffer(req.file.buffer)) return errorResponse(res, "File content is not valid JSON", 400);

    let fileData: any;
    try {
      fileData = JSON.parse(req.file.buffer.toString("utf-8"));
    } catch {
      return errorResponse(res, "Invalid JSON file format", 400);
    }

    const payload = fileData.data?.data || fileData.data || fileData;
    const stories = Array.isArray(payload?.stories) ? payload.stories : null;
    const storyProgress = Array.isArray(payload?.storyProgress) ? payload.storyProgress : [];
    if (!stories) return errorResponse(res, "Invalid file structure. Expected 'stories' array", 400);
    if (stories.length > MAX_IMPORT_ITEMS) {
      return errorResponse(res, `Import exceeds maximum of ${MAX_IMPORT_ITEMS} stories per request`, 400);
    }

    const { duplicateStrategy = "skip", validateOnly = "false", batchSize = "10" } = req.query;
    const validStrategies = ["skip", "overwrite", "error", "merge"];
    if (!validStrategies.includes(duplicateStrategy as string)) {
      return errorResponse(res, `Invalid duplicateStrategy. Must be one of: ${validStrategies.join(", ")}`, 400);
    }
    const batchSizeNum = parseInt(batchSize as string);
    if (isNaN(batchSizeNum) || batchSizeNum < 1 || batchSizeNum > 100) {
      return errorResponse(res, "Invalid batchSize. Must be a number between 1 and 100", 400);
    }

    const validationResults = storyImportExportService.validateStories(stories);
    if (validateOnly === "true") {
      return successResponse(res, "Validation completed", {
        totalStories: stories.length,
        totalProgress: storyProgress.length,
        valid: validationResults.filter((result) => result.status === "valid").length,
        invalid: validationResults.filter((result) => result.status === "invalid").length,
        validationResults,
      });
    }

    if (validationResults.some((result) => result.status === "invalid")) {
      return errorResponse(res, "Cannot import stories with invalid records", 400);
    }

    const result = await storyImportExportService.importBackup(
      { stories, storyProgress },
      duplicateStrategy as "skip" | "overwrite" | "error" | "merge",
      batchSizeNum
    );
    return successResponse(res, "Stories import completed successfully", result);
  } catch (error) {
    logger.error("Error importing stories:", error);
    return errorResponse(res, "Error importing stories", 500, error);
  }
};

export const createStory = async (req: Request, res: Response): Promise<Response> => {
  try {
    const storyData = parseBody(StoryCreateSchema, req.body, res);
    if (!storyData) return errorResponse(res, "Invalid request body", 400);

    const userId = getUserId(req);
    if (!userId) return errorResponse(res, "Authentication required", 401);

    const language = req.user?.language || "en";
    const story = await storyService.createStory({ ...storyData, language, userId } as any);
    return successResponse(res, "Story created successfully", toStoryDTO(story), 201);
  } catch (error) {
    logger.error("Error creating story:", error);
    return errorResponse(res, "Error creating story");
  }
};

export const getStoryById = async (req: Request, res: Response): Promise<Response> => {
  try {
    const story = await storyService.getStoryById(req.params.id);
    if (!story) return errorResponse(res, "Story not found", 404);
    return successResponse(res, "Story retrieved successfully", toStoryDTO(story));
  } catch (error) {
    return errorResponse(res, "Error retrieving story", 500, error);
  }
};

export const updateStory = async (req: Request, res: Response): Promise<Response> => {
  try {
    const updateData = parseBody(StoryUpdateSchema, req.body, res);
    if (!updateData) return errorResponse(res, "Invalid request body", 400);

    const story = await storyService.updateStory(req.params.id, updateData as any);
    if (!story) return errorResponse(res, "Story not found", 404);
    return successResponse(res, "Story updated successfully", toStoryDTO(story));
  } catch (error) {
    return errorResponse(res, "Error updating story", 500, error);
  }
};

export const deleteStory = async (req: Request, res: Response): Promise<Response> => {
  try {
    const story = await storyService.deleteStory(req.params.id);
    if (!story) return errorResponse(res, "Story not found", 404);
    return successResponse(res, "Story deleted successfully", {});
  } catch (error) {
    return errorResponse(res, "Error deleting story", 500, error);
  }
};

export const getAllStories = async (req: Request, res: Response): Promise<Response> => {
  try {
    const {
      page: qPage,
      limit: qLimit,
      search = "",
      genre,
      level,
      language,
      sortBy,
      sortOrder,
    } = req.query as any;

    const page = parseInt(qPage) || 1;
    const limit = parseLimit(qLimit, 12);

    const languageToUse = parseArrayParam(language) ?? (req.user?.language ? [req.user.language] : undefined);

    const stories = await storyService.getStoriesAdvanced({
      page,
      limit,
      search,
      genre: parseArrayParam(genre),
      level: parseArrayParam(level),
      language: languageToUse,
      sortBy,
      sortOrder,
    });

    return successResponse(res, "Stories retrieved successfully", mapPaginated(stories, toStoryDTO));
  } catch (error) {
    return errorResponse(res, "Error fetching stories", 500, error);
  }
};

export const addChapter = async (req: Request, res: Response): Promise<Response> => {
  try {
    const chapterData = parseBody(ChapterSaveSchema, req.body, res);
    if (!chapterData) return res;

    const story = await storyService.getStoryById(req.params.id);
    if (!story) return errorResponse(res, "Story not found", 404);

    const chapter = {
      order: story.chapters.length,
      title: chapterData.title,
      content: chapterData.content,
      targetVocabulary: chapterData.targetVocabulary || [],
      targetGrammar: chapterData.targetGrammar || [],
    };

    const updated = await storyService.addChapter(req.params.id, chapter);
    if (!updated) return errorResponse(res, "Failed to add chapter", 500);
    return successResponse(res, "Chapter added successfully", toStoryDTO(updated), 201);
  } catch (error) {
    return errorResponse(res, "Error adding chapter", 500, error);
  }
};

export const updateChapter = async (req: Request, res: Response): Promise<Response> => {
  try {
    const chapterIndex = parseInt(req.params.chapterIndex);
    if (isNaN(chapterIndex)) return errorResponse(res, "Invalid chapter index", 400);

    const story = await storyService.updateChapter(req.params.id, chapterIndex, req.body);
    if (!story) return errorResponse(res, "Story or chapter not found", 404);
    return successResponse(res, "Chapter updated successfully", toStoryDTO(story));
  } catch (error) {
    return errorResponse(res, "Error updating chapter", 500, error);
  }
};

export const deleteChapter = async (req: Request, res: Response): Promise<Response> => {
  try {
    const chapterIndex = parseInt(req.params.chapterIndex);
    if (isNaN(chapterIndex)) return errorResponse(res, "Invalid chapter index", 400);

    const story = await storyService.deleteChapter(req.params.id, chapterIndex);
    if (!story) return errorResponse(res, "Story or chapter not found", 404);
    return successResponse(res, "Chapter deleted successfully", toStoryDTO(story));
  } catch (error) {
    return errorResponse(res, "Error deleting chapter", 500, error);
  }
};

export const generateChapterAudioHandler = async (req: Request, res: Response): Promise<Response> => {
  try {
    const chapterIndex = parseInt(req.params.chapterIndex);
    if (isNaN(chapterIndex) || chapterIndex < 0) {
      return errorResponse(res, "Invalid chapter index", 400);
    }

    const story = await storyService.getStoryById(req.params.id);
    const chapter = story?.chapters[chapterIndex];
    if (!story || !chapter) return errorResponse(res, "Story or chapter not found", 404);

    const voice = typeof req.body?.voice === "string" && req.body.voice.trim()
      ? req.body.voice.trim()
      : DEFAULT_TTS_VOICE;
    const audioBuffer = await generateChapterAudio(chapter.content, voice);
    const filename = `story-${req.params.id}-chapter-${chapterIndex}.mp3`;
    const audioAlignment = await transcribeAudioWithWordTimestamps(audioBuffer, filename);
    const uploaded = await uploadAudioToPocketBase(audioBuffer, filename, {
      contentId: req.params.id,
      voice,
    });

    try {
      const updated = await storyService.updateChapter(req.params.id, chapterIndex, {
        urlAudio: uploaded.url,
        audioRecordId: uploaded.recordId,
        voice,
        audioAlignment,
      });
      if (!updated) throw new Error("Failed to update chapter audio reference");
    } catch (error) {
      await deleteAudioFromPocketBase(uploaded.recordId);
      throw error;
    }

    if (chapter.audioRecordId) {
      await deleteAudioFromPocketBase(chapter.audioRecordId);
    }

    return successResponse(res, "Chapter audio generated successfully", {
      urlAudio: uploaded.url,
      recordId: uploaded.recordId,
      voice,
      audioAlignment,
    });
  } catch (error) {
    logger.error("Error generating chapter audio:", error);
    return errorResponse(res, "Error generating chapter audio", 500, error);
  }
};

export const getVocabReport = async (req: Request, res: Response): Promise<Response> => {
  try {
    const report = await storyService.getVocabReport(req.params.id);
    return successResponse(res, "Vocabulary report generated", report);
  } catch (error) {
    return errorResponse(res, "Error generating vocabulary report", 500, error);
  }
};

export const updateProgress = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { chapterIndex } = req.body;
    if (chapterIndex === undefined || chapterIndex < 0) {
      return errorResponse(res, "Valid chapterIndex is required", 400);
    }

    const userId = getUserId(req);
    if (!userId) return errorResponse(res, "Authentication required", 401);

    const progress = await storyService.updateProgress(userId, req.params.id, chapterIndex);
    return successResponse(res, "Progress updated", progress);
  } catch (error) {
    return errorResponse(res, "Error updating progress", 500, error);
  }
};

export const getProgress = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = getUserId(req);
    if (!userId) return errorResponse(res, "Authentication required", 401);

    const progress = await storyService.getProgress(userId, req.params.id);
    return successResponse(res, "Progress retrieved", progress);
  } catch (error) {
    return errorResponse(res, "Error retrieving progress", 500, error);
  }
};

export const updateImageStory = async (req: Request, res: Response): Promise<Response> => {
  const { content, imgOld } = req.body as { content?: string; imgOld?: string };
  const storyId = req.params.id;

  if (!content) {
    return errorResponse(res, "content is required.", 400);
  }

  try {
    const userId = getUserId(req);
    const imageProvider = (await getAIProvider(userId, "story", "image")) as ImageProvider;
    const imageResponse = await generateImage(imageProvider, createStoryImagePrompt(content));
    if (!imageResponse) {
      return errorResponse(res, "Failed to generate image.", 400);
    }

    const imageBase64 = (imageResponse as any).b64_json;
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
      deleteOldImagePromise = deleteImageFromCloudinary("languagesai/stories/" + publicId);
    }

    const [, urlImage] = await Promise.all([
      deleteOldImagePromise,
      uploadImageToCloudinary(imageBase64, "stories"),
    ]);

    if (!urlImage) {
      return errorResponse(res, "Failed to upload image to Cloudinary.", 500);
    }

    const updatedStory = await storyService.updateStory(storyId, { img: urlImage as string });
    if (!updatedStory) {
      return errorResponse(res, "Story not found or failed to update.", 404);
    }

    return successResponse(res, "Story image updated successfully", { img: updatedStory.img || urlImage });
  } catch (error) {
    logger.error("Error generating story image:", error);
    return errorResponse(res, "Error generating story image", 500, error);
  }
};

export const generateChapterTitleHandler = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { content } = req.body as { content?: string };
    if (!content || !content.trim()) {
      return errorResponse(res, "content is required", 400);
    }

    const story = await storyService.getStoryById(req.params.id);
    if (!story) return errorResponse(res, "Story not found", 404);

    const userId = getUserId(req);
    const language = req.user?.language || "en";

    const title = await generateChapterTitle(
      {
        storyTitle: story.title,
        storyGenre: story.genre,
        language,
        chapterContent: content,
      },
      { userId }
    );

    return successResponse(res, "Title generated", { title });
  } catch (error) {
    logger.error("Error generating chapter title:", error);
    return errorResponse(res, "Error generating chapter title", 500, error);
  }
};

export const generateChapterStream = async (req: Request, res: Response): Promise<Response> => {
  const parsed = parseBody(ChapterGenerateSchema, req.body, res);
  if (!parsed) return res;
  const { instructions, requestEnding, targetVocabulary, targetGrammar } = parsed;

  try {
    const story = await storyService.getStoryById(req.params.id);
    if (!story) return errorResponse(res, "Story not found", 404);

    const previousChapters = story.chapters.map((ch) => ({
      title: ch.title,
      content: ch.content,
    }));

    setSSEHeaders(res);

    const userId = getUserId(req);
    const language = req.user?.language || "en";
    const stream = await generateChapterText({
      storyTitle: story.title,
      storyDescription: story.description,
      storyGenre: story.genre,
      languageLevel: story.languageLevel,
      language,
      targetVocabulary: targetVocabulary || [],
      targetGrammar: targetGrammar || [],
      previousChapters,
      chapterNumber: story.chapters.length + 1,
      instructions: typeof instructions === "string" ? instructions : "",
      requestEnding: requestEnding === true,
    }, {
      stream: true,
      userId,
    });

    await streamTextResponse(res, stream as AsyncIterable<any>);
  } catch (error: any) {
    logger.error("Error generating chapter stream:", error);
    return errorResponse(res, "Error trying to generate chapter", 500, error);
  }
};

export const generateIdea = async (req: Request, res: Response): Promise<Response> => {
  try {
    const parsed = parseBody(StoryIdeaSchema, req.body, res);
    if (!parsed) return errorResponse(res, "Invalid request body", 400);

    const userId = getUserId(req);
    const language = req.user?.language || "en";
    const idea = await generateStoryIdea(
      { seed: parsed.seed, genre: parsed.genre, level: parsed.languageLevel, language },
      { userId }
    );
    return successResponse(res, "Story idea generated", idea);
  } catch (error: any) {
    logger.error("Error generating story idea:", error);
    return errorResponse(res, error.message || "Error generating story idea", 500, error);
  }
};
