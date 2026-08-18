import { Router } from "express";
import { validateObjectId } from "../middlewares/validateObjectId";
import { aiLimiter } from "../middlewares/rateLimiters";
import {
  generate,
  validate,
  correct,
  create,
  getById,
  list,
  remove,
  startAttempt,
  submitAttempt,
  getAttempt,
  deleteAttempt,
  listAttempts,
  listAttemptsByExam,
  chatOnQuestion,
  exportExamsToJSON,
  importExamsFromFile,
} from "../controllers/examController";
import { createJsonUploadMiddleware } from "../middlewares/uploadMiddleware";

const router = Router();
router.param("id", validateObjectId);
router.param("attemptId", validateObjectId);

// Export/Import routes (MUST BE BEFORE DYNAMIC ROUTES) DONE
router.get("/export-file", exportExamsToJSON);
router.post("/import-file", ...createJsonUploadMiddleware(), importExamsFromFile as any);

// Generate, validate, correct (no persistence) — call an AI provider
router.post("/generate", aiLimiter, generate);
router.post("/validate", aiLimiter, validate);
router.post("/correct", aiLimiter, correct);

// Exam CRUD
router.get("/", list);
router.post("/", create);

// Attempts (static routes first to avoid :id conflict)
router.get("/attempts/my", listAttempts);

router.get("/:id", getById);
router.delete("/:id", remove);
router.get("/:id/attempts", listAttemptsByExam);
router.post("/:id/attempts", startAttempt);
router.get("/:id/attempts/:attemptId", getAttempt);
router.delete("/:id/attempts/:attemptId", deleteAttempt);
// Submit triggers AI grading/feedback; question chat is AI too
router.post("/:id/attempts/:attemptId/submit", aiLimiter, submitAttempt);
router.post("/:id/attempts/:attemptId/questions/:questionIndex/chat", aiLimiter, chatOnQuestion);

export default router;
