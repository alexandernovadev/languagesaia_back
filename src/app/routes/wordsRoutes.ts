import { Router } from "express";
import { validateObjectId } from "../middlewares/validateObjectId";
import { aiLimiter } from "../middlewares/rateLimiters";
import { requireAdmin } from "../middlewares/requireAdmin";
import {
  createWord,
  getWordById,
  getWords,
  updateWord,
  getWordByName,
  getAnkiCards,
  updateIncrementWordSeens,
  getWordsByTypeOptimized,
  getWordCountsByLanguage,
  updateWordDifficulty,
} from "../controllers/wordController";
import {
  getChatHistory,
  clearChatHistory,
  streamChatResponse,
} from "../controllers/wordChatController";
import {
  generateWordJson,
  generateWordExamplesJson,
  generateWordExamplesCodeSwitchingJson,
  completeWordJson,
  generateWordTypesJson,
  generateWordSynonymsJson,
  updateImageWord,
} from "../controllers/wordAIController";
import { answerReview, getWordAudio, practiceWord, getReviewQueue, getReviewSummary } from "../controllers/wordReviewController";

const router = Router();
router.param("id", validateObjectId);

// Static routes
// Ruta unificada para tarjetas Anki
router.get("/anki-cards", getAnkiCards);
router.get("/by-type-optimized", getWordsByTypeOptimized);
router.get("/languages", getWordCountsByLanguage);
router.get("/review/summary", getReviewSummary);
router.get("/review/queue", getReviewQueue);

// Dynamic routes with parameters
router.get("/:word/word", getWordByName);

// Chat routes
router.post("/:id/chat/stream", aiLimiter, streamChatResponse);
router.get("/:id/chat", getChatHistory);
router.delete("/:id/chat", clearChatHistory);

// Words are shared: only an admin changes their content
router.post("/generate", aiLimiter, generateWordJson);
router.post("/:id/complete", completeWordJson);
router.post("/:id/generate-examples", requireAdmin, aiLimiter, generateWordExamplesJson);
router.post("/:id/generate-code-switching", requireAdmin, aiLimiter, generateWordExamplesCodeSwitchingJson);
router.post("/:id/generate-types", requireAdmin, aiLimiter, generateWordTypesJson);
router.post("/:id/generate-synonyms", requireAdmin, aiLimiter, generateWordSynonymsJson);
router.post("/:id/generate-image", requireAdmin, aiLimiter, updateImageWord);

// CRUD routes (MUST BE LAST)
router.get("/:id", getWordById);
router.get("/", getWords);
router.post("/", requireAdmin, createWord);
router.put("/:id", requireAdmin, updateWord);
router.put('/:id/difficulty', updateWordDifficulty);
router.put("/:id/increment-seen", updateIncrementWordSeens);
router.post("/:id/review", answerReview);
router.post("/:id/practice", practiceWord);
router.post("/:id/audio", getWordAudio);

export default router;
