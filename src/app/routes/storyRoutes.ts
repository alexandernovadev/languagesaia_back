import { Router } from "express";
import { validateObjectId } from "../middlewares/validateObjectId";
import { aiLimiter } from "../middlewares/rateLimiters";
import {
  createStory,
  nextChapter,
  getAllStories,
  getStoryById,
  deleteStory,
  updateProgress,
  getProgress,
  generateChapterAudioHandler,
  lookupTappedWord,
  readingChat,
  getReadingChat,
} from "../controllers/StoryController";

const router = Router();
router.param("id", validateObjectId);

// AI idea generation (no story id required yet)

// Selection helpers (text selection in the reader)
router.post("/word-lookup", lookupTappedWord);

// CRUD routes
router.post("/", aiLimiter, createStory);
router.get("/", getAllStories);
router.get("/:id", getStoryById);
router.delete("/:id", deleteStory);

// Chapter routes
router.post("/:id/chapters/next", aiLimiter, nextChapter);
router.get("/:id/chapters/:chapterIndex/chat", getReadingChat);
router.post("/:id/chapters/:chapterIndex/chat/stream", aiLimiter, readingChat);
router.post("/:id/chapters/:chapterIndex/generate-audio", aiLimiter, generateChapterAudioHandler);

// Progress routes
router.post("/:id/progress", updateProgress);
router.get("/:id/progress", getProgress);

export default router;
