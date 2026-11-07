import { Router } from "express";
import { requireAdmin } from "../middlewares/requireAdmin";
import { validateObjectId } from "../middlewares/validateObjectId";
import { aiLimiter } from "../middlewares/rateLimiters";
import {
  createExpression, getExpressionById, getExpressions, updateExpression, deleteExpression,
  getExpressionByExpression, getExpressionsByType, getExpressionsOnly,
  addChatMessage, getChatHistory, clearChatHistory, streamChatResponse, generateExpression,
  updateImageExpression,
} from "../controllers/expressionController";

const router = Router();
router.param("id", validateObjectId);

// AI Generation routes
router.post("/generate", aiLimiter, generateExpression);
router.post("/:id/generate-image", aiLimiter, updateImageExpression);

// Filter and search routes
router.get("/by-type/:type", getExpressionsByType);
router.get("/expressions-only", getExpressionsOnly);
router.get("/:expression/expression", getExpressionByExpression);

// Chat routes
router.post("/:id/chat", addChatMessage);
router.post("/:id/chat/stream", aiLimiter, streamChatResponse);
router.get("/:id/chat", getChatHistory);
router.delete("/:id/chat", clearChatHistory);

// CRUD routes (MUST BE LAST)
router.get("/:id", getExpressionById);
router.get("/", getExpressions);
router.post("/", createExpression);
router.put("/:id", updateExpression);
router.delete("/:id", deleteExpression);

export default router; 