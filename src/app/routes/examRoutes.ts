import { Router } from "express";
import { aiLimiter } from "../middlewares/rateLimiters";
import { answer, catalog, chatHistory, chatStream, createPractice, finish, stats } from "../controllers/examController";

/**
 * Exams (Bruno) — Duolingo-style practices.
 *   GET  /catalog                                   grammar topics for the user's language
 *   GET  /stats                                     weak points + recent practices
 *   POST /practice                                  { mode, level?, grammarTopics?, count? } → exam + attemptId
 *   POST /attempts/:attemptId/answer                { index, answer } → { correct, score, feedback? }
 *   POST /attempts/:attemptId/finish                → { score, xp, correct, total }
 *   GET  /attempts/:attemptId/questions/:index/chat
 *   POST /attempts/:attemptId/questions/:index/chat/stream   { message } → text stream
 */
const router = Router();

router.get("/catalog", catalog);
router.get("/stats", stats);
router.post("/practice", aiLimiter, createPractice);
router.post("/attempts/:attemptId/answer", answer);
router.post("/attempts/:attemptId/finish", finish);
router.get("/attempts/:attemptId/questions/:index/chat", chatHistory);
router.post("/attempts/:attemptId/questions/:index/chat/stream", aiLimiter, chatStream);

export default router;
