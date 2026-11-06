import { Request, Response } from "express";
import { StoryService } from "../services/stories/StoryService";
import { successResponse, errorResponse } from "../utils/responseHelpers";
import { parseLimit, parseArrayParam } from "../utils/pagination";
import { toStoryDTO, mapPaginated } from "../dto/mappers";
import { StoryCreateSchema, parseBody } from "../validators/schemas";
import { lookupWord } from "../services/words/WordLookupService";
import { getUserId, timeZoneOf } from "../utils/http/requestUser";
import progressService from "../services/progress/ProgressService";
import { CHAPTER_XP, STORY_ANSWER_XP } from "../../config/constants";
import logger from "../utils/logger";
import { AudioWordTiming, narrateChapter, narrationVoice } from "../services/audio/textToSpeechService";
import { uploadAudioToPocketBase } from "../services/audio/pocketBaseService";
import { routeParams } from "../utils/http/routeParams";
import { setSSEHeaders, streamTextResponse } from "../utils/http/sse";

const storyService = new StoryService();

/** Two taps on Narrate must not pay for two recordings. */
const narrations = new Map<string, Promise<{ urlAudio: string; audioAlignment: AudioWordTiming[] }>>();

async function narrate(storyId: string, chapterIndex: number, content: string, language: string) {
  const { buffer, alignment } = await narrateChapter(content, language);
  const voice = narrationVoice(language);
  const uploaded = await uploadAudioToPocketBase(buffer, `story-${storyId}-chapter-${chapterIndex}.mp3`, { contentId: storyId, voice });
  await storyService.updateChapter(storyId, chapterIndex, { urlAudio: uploaded.url, audioRecordId: uploaded.recordId, voice, audioAlignment: alignment });
  return { urlAudio: uploaded.url, audioAlignment: alignment };
}

export const createStory = async (req: Request, res: Response): Promise<Response> => {
  try {
    const parsed = parseBody(StoryCreateSchema, req.body, res);
    if (!parsed) return res;

    const userId = getUserId(req);
    const language = req.user?.language || "en";
    const story = await storyService.createStory({ ...parsed, language }, userId, { userId });
    return successResponse(res, "Story created successfully", toStoryDTO(story), 201);
  } catch (error) {
    logger.error("Error creating story:", error);
    return errorResponse(res, "Error creating story", 500, error);
  }
};

/** Tells the reader the text is complete; the response stays open while the chapter is saved. */
const END_OF_TEXT = "\u0003";
const MAX_IDEA_LENGTH = 300;

export const nextChapter = async (req: Request, res: Response): Promise<Response | void> => {
  let chapter: Awaited<ReturnType<typeof storyService.writeChapter>> = null;
  try {
    const userId = getUserId(req);
    const idea = typeof req.body?.idea === "string" ? req.body.idea.trim().slice(0, MAX_IDEA_LENGTH) || undefined : undefined;
    chapter = await storyService.writeChapter(routeParams(req).id, userId, idea, { userId });
    if (!chapter) return errorResponse(res, "Story not found", 404);
    const { stream, save } = chapter;

    setSSEHeaders(res);
    await streamTextResponse(res, stream as any, {
      filterMarkdownTables: false,
      onComplete: async (text) => {
        res.write(END_OF_TEXT);
        await save(text);
      },
    });
  } catch (error: any) {
    logger.error("Error writing chapter:", error);
    if (res.headersSent) return void res.destroy(); // cut the stream so the reader knows it failed
    return errorResponse(res, error.message || "Error writing chapter", error.status ?? 500, error);
  } finally {
    chapter?.release();
  }
};

export const getStoryById = async (req: Request, res: Response): Promise<Response> => {
  try {
    const story = await storyService.getStoryById(routeParams(req).id);
    if (!story) return errorResponse(res, "Story not found", 404);
    return successResponse(res, "Story retrieved successfully", toStoryDTO(story));
  } catch (error) {
    return errorResponse(res, "Error retrieving story", 500, error);
  }
};

export const deleteStory = async (req: Request, res: Response): Promise<Response> => {
  try {
    const story = await storyService.deleteStory(routeParams(req).id);
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
      userId: getUserId(req),
      page,
      limit,
      search,
      genre: parseArrayParam(genre),
      level: parseArrayParam(level),
      language: languageToUse,
      sortBy,
      sortOrder,
    });

    const finished = await storyService.finishedChapters(getUserId(req), stories.data.map((story) => String(story._id)));
    const withProgress = (story: any) => ({ ...toStoryDTO(story), finishedChapters: finished.get(String(story._id)) ?? 0 });
    return successResponse(res, "Stories retrieved successfully", mapPaginated(stories, withProgress));
  } catch (error) {
    return errorResponse(res, "Error fetching stories", 500, error);
  }
};

/** Narrates a chapter once; after that, everyone gets the same recording. */
export const generateChapterAudioHandler = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = routeParams(req);
    const chapterIndex = parseInt(routeParams(req).chapterIndex);
    if (isNaN(chapterIndex) || chapterIndex < 0) return errorResponse(res, "Invalid chapter index", 400);

    const story = await storyService.getStoryById(id);
    const chapter = story?.chapters[chapterIndex];
    if (!story || !chapter) return errorResponse(res, "Story or chapter not found", 404);
    if (chapter.urlAudio) return successResponse(res, "Chapter audio", { urlAudio: chapter.urlAudio, audioAlignment: chapter.audioAlignment });

    const narrating = `${id}:${chapterIndex}`;
    const running = narrations.get(narrating);
    const job = running ?? narrate(id, chapterIndex, chapter.content, story.language).finally(() => narrations.delete(narrating));
    narrations.set(narrating, job);
    return successResponse(res, "Chapter audio generated successfully", await job);
  } catch (error) {
    logger.error("Error generating chapter audio:", error);
    return errorResponse(res, "Error generating chapter audio", 500, error);
  }
};

export const lookupTappedWord = async (req: Request, res: Response): Promise<Response> => {
  const { word, sentence, language } = req.body ?? {};
  if (typeof word !== "string" || !word.trim() || typeof language !== "string") return errorResponse(res, "word and language are required", 400);
  try {
    const userId = getUserId(req);
    return successResponse(res, "Word found", await lookupWord(word, String(sentence ?? ""), language, userId, { userId }));
  } catch (error) {
    logger.error("Error looking up word:", error);
    return errorResponse(res, "Error looking up the word", 500, error);
  }
};

export const updateProgress = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { chapterIndex, correct } = req.body ?? {};
    if (!Number.isInteger(chapterIndex) || chapterIndex < 0) return errorResponse(res, "Valid chapterIndex is required", 400);

    const userId = getUserId(req);
    const { id } = routeParams(req);
    const before = await storyService.getProgress(userId, id);
    const progress = await storyService.updateProgress(userId, id, chapterIndex);

    const firstTime = !before?.completedChapters.includes(chapterIndex);
    const rightAnswers = Math.min(3, Math.max(0, Number(correct) || 0));
    const reward = firstTime ? await progressService.award(userId, CHAPTER_XP + rightAnswers * STORY_ANSWER_XP, timeZoneOf(req)) : null;
    return successResponse(res, "Progress updated", { progress, reward });
  } catch (error) {
    return errorResponse(res, "Error updating progress", 500, error);
  }
};

export const getProgress = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = getUserId(req);
    if (!userId) return errorResponse(res, "Authentication required", 401);

    const progress = await storyService.getProgress(userId, routeParams(req).id);
    return successResponse(res, "Progress retrieved", progress);
  } catch (error) {
    return errorResponse(res, "Error retrieving progress", 500, error);
  }
};

