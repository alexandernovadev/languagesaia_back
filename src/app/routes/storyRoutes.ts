import { Router } from "express";
import { validateObjectId } from "../middlewares/validateObjectId";
import { aiLimiter } from "../middlewares/rateLimiters";
import {
  createStory,
  getAllStories,
  getStoryById,
  updateStory,
  deleteStory,
  addChapter,
  updateChapter,
  deleteChapter,
  getVocabReport,
  updateProgress,
  getProgress,
  generateChapterStream,
  generateIdea,
} from "../controllers/StoryController";

const router = Router();
router.param("id", validateObjectId);

// AI idea generation (no story id required yet)
router.post("/generate-idea", aiLimiter, generateIdea);

// CRUD routes
router.post("/", createStory);
router.get("/", getAllStories);
router.get("/:id", getStoryById);
router.put("/:id", updateStory);
router.delete("/:id", deleteStory);

// Chapter routes
router.post("/:id/chapters", aiLimiter, generateChapterStream);
router.post("/:id/chapters/save", addChapter);
router.put("/:id/chapters/:chapterIndex", updateChapter);
router.delete("/:id/chapters/:chapterIndex", deleteChapter);

// Vocab report
router.get("/:id/vocab-report", getVocabReport);

// Progress routes
router.post("/:id/progress", updateProgress);
router.get("/:id/progress", getProgress);

export default router;
