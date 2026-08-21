import { Request, Response } from "express";
import { StoryService } from "../services/stories/StoryService";
import { successResponse, errorResponse } from "../utils/responseHelpers";
import { parseLimit } from "../utils/pagination";
import { toStoryDTO, mapPaginated } from "../dto/mappers";
import { StoryCreateSchema, StoryUpdateSchema, StoryIdeaSchema, parseBody } from "../validators/schemas";
import { generateChapterText, generateStoryIdea } from "../services/ai/storyAIService";
import { createMarkdownTableFilter } from "../utils/text/sanitizeLectureContent";
import logger from "../utils/logger";

const storyService = new StoryService();

export const createStory = async (req: Request, res: Response): Promise<Response> => {
  try {
    const storyData = parseBody(StoryCreateSchema, req.body, res);
    if (!storyData) return errorResponse(res, "Invalid request body", 400);

    const userId = req.user?._id?.toString?.() ?? (req.user as { id?: string })?.id ?? null;
    if (!userId) return errorResponse(res, "Authentication required", 401);

    const story = await storyService.createStory({ ...storyData, userId } as any);
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
      sortBy,
      sortOrder,
    } = req.query as any;

    const page = parseInt(qPage) || 1;
    const limit = parseLimit(qLimit, 12);

    const parseArrayParam = (param: string | string[] | undefined): string | string[] | undefined => {
      if (!param) return undefined;
      if (Array.isArray(param)) return param;
      if (typeof param === "string" && param.includes(",")) {
        return param.split(",").map((v) => v.trim()).filter(Boolean);
      }
      return param;
    };

    const stories = await storyService.getStoriesAdvanced({
      page,
      limit,
      search,
      genre: parseArrayParam(genre),
      level: parseArrayParam(level),
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
    const { title, content } = req.body;
    if (!title || !content) return errorResponse(res, "Title and content are required", 400);

    const story = await storyService.getStoryById(req.params.id);
    if (!story) return errorResponse(res, "Story not found", 404);

    const chapter = {
      order: story.chapters.length,
      title,
      content,
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

    const userId = req.user?._id?.toString?.() ?? (req.user as { id?: string })?.id ?? null;
    if (!userId) return errorResponse(res, "Authentication required", 401);

    const progress = await storyService.updateProgress(userId, req.params.id, chapterIndex);
    return successResponse(res, "Progress updated", progress);
  } catch (error) {
    return errorResponse(res, "Error updating progress", 500, error);
  }
};

export const getProgress = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = req.user?._id?.toString?.() ?? (req.user as { id?: string })?.id ?? null;
    if (!userId) return errorResponse(res, "Authentication required", 401);

    const progress = await storyService.getProgress(userId, req.params.id);
    return successResponse(res, "Progress retrieved", progress);
  } catch (error) {
    return errorResponse(res, "Error retrieving progress", 500, error);
  }
};

export const generateChapterStream = async (req: Request, res: Response): Promise<Response> => {
  const { instructions, requestEnding } = req.body;

  try {
    const story = await storyService.getStoryById(req.params.id);
    if (!story) return errorResponse(res, "Story not found", 404);

    const previousChapters = story.chapters.map((ch) => ({
      title: ch.title,
      content: ch.content,
    }));

    // Set up streaming headers
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    const userId = req.user?._id || req.user?.id || null;
    const stream = await generateChapterText({
      storyTitle: story.title,
      storyDescription: story.description,
      storyGenre: story.genre,
      languageLevel: story.languageLevel,
      targetVocabulary: story.targetVocabulary,
      targetGrammar: story.targetGrammar,
      previousChapters,
      chapterNumber: story.chapters.length + 1,
      instructions: typeof instructions === "string" ? instructions : "",
      requestEnding: requestEnding === true,
    }, {
      stream: true,
      userId,
    });

    // Read the stream, strip markdown tables live, and send to the client
    const tableFilter = createMarkdownTableFilter();
    for await (const chunk of stream as any) {
      const content = chunk.choices?.[0]?.delta?.content || "";
      if (content) {
        res.write(tableFilter.push(content));
      }
    }
    res.write(tableFilter.flush());

    res.end();
  } catch (error: any) {
    logger.error("Error generating chapter stream:", error);
    return errorResponse(res, "Error trying to generate chapter", 500, error);
  }
};

export const generateIdea = async (req: Request, res: Response): Promise<Response> => {
  try {
    const parsed = parseBody(StoryIdeaSchema, req.body, res);
    if (!parsed) return errorResponse(res, "Invalid request body", 400);

    const userId = req.user?._id?.toString?.() ?? (req.user as { id?: string })?.id ?? null;
    const idea = await generateStoryIdea(
      { seed: parsed.seed, genre: parsed.genre, level: parsed.languageLevel },
      { userId }
    );
    return successResponse(res, "Story idea generated", idea);
  } catch (error: any) {
    logger.error("Error generating story idea:", error);
    return errorResponse(res, error.message || "Error generating story idea", 500, error);
  }
};
