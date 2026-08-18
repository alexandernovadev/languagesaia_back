import { Router } from "express";
import { validateObjectId } from "../middlewares/validateObjectId";
import { aiLimiter } from "../middlewares/rateLimiters";
import {
  createWord,
  getWordById,
  getWords,
  updateWord,
  deleteWord,
  getWordByName,
  getAnkiCards,
  updateIncrementWordSeens,
  exportWordsToJSON,
  importWordsFromFile,
  getWordsByTypeOptimized,
  addChatMessage,
  getChatHistory,
  clearChatHistory,
  streamChatResponse,
  // AI Generation functions
  generateWordJson,
  generateWordExamplesJson,
  generateWordExamplesCodeSwitchingJson,
  generateWordTypesJson,
  generateWordSynomymsJson,
  updateImageWord,
  updateWordDifficulty,
} from "../controllers/wordController";
import { createJsonUploadMiddleware } from "../middlewares/uploadMiddleware";

const router = Router();
router.param("id", validateObjectId);

// Import/Export routes (MUST BE BEFORE DYNAMIC ROUTES)
router.get("/export-file", exportWordsToJSON);
router.post("/import-file", ...createJsonUploadMiddleware(), importWordsFromFile);

// Static routes
// Ruta unificada para tarjetas Anki
router.get("/anki-cards", getAnkiCards);
router.get("/by-type-optimized", getWordsByTypeOptimized);

// Dynamic routes with parameters
router.get("/:word/word", getWordByName);

// Chat routes
router.post("/:id/chat", addChatMessage);
router.post("/:id/chat/stream", aiLimiter, streamChatResponse);
router.get("/:id/chat", getChatHistory);
router.delete("/:id/chat", clearChatHistory);

// AI Generation routes
router.post("/generate", aiLimiter, generateWordJson);
router.post("/:id/generate-examples", aiLimiter, generateWordExamplesJson);
router.post("/:id/generate-code-switching", aiLimiter, generateWordExamplesCodeSwitchingJson);
router.post("/:id/generate-types", aiLimiter, generateWordTypesJson);
router.post("/:id/generate-synonyms", aiLimiter, generateWordSynomymsJson);
router.post("/:id/generate-image", aiLimiter, updateImageWord);

// CRUD routes (MUST BE LAST)
router.get("/:id", getWordById);
router.get("/", getWords);
router.post("/", createWord);
router.put("/:id", updateWord);
router.delete("/:id", deleteWord);
router.put('/:id/difficulty', updateWordDifficulty);
router.put("/:id/increment-seen", updateIncrementWordSeens);

export default router;
