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
import { generateChapterText, generateStoryIdea } from "../services/ai/storyAIService";
import { setSSEHeaders, streamTextResponse } from "../utils/http/sse";
import { getUserId } from "../utils/http/requestUser";
import logger from "../utils/logger";

const storyService = new StoryService();

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
