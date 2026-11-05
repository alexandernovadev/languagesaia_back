import { Router } from "express";
import { aiLimiter } from "../middlewares/rateLimiters";
import { answer, catalog, chatHistory, chatStream, createLesson, current, finish, openLanguages, report, stats } from "../controllers/lessonController";

/**
 * Lessons (Bruno) — Duolingo-style practice.
 *   GET  /catalog                                   grammar topics for the user's language
 *   GET  /stats                                     weak points + recent lessons
 *   GET  /current                                   the lesson left unfinished, or null
 *   GET  /open-languages                            languages with a lesson left unfinished
 *   POST /                                          { mode, level?, grammarTopics?, count? } → lesson + attemptId
 *   POST /attempts/:attemptId/answer                { index, answer } → { correct, score, feedback? }
 *   POST /attempts/:attemptId/questions/:index/report   this exercise is wrong: it stops counting
 *   POST /attempts/:attemptId/finish                → { score, xp, correct, total }
 *   GET  /attempts/:attemptId/questions/:index/chat
 *   POST /attempts/:attemptId/questions/:index/chat/stream   { message } → text stream
 */
const router = Router();

router.get("/catalog", catalog);
router.get("/stats", stats);
router.get("/current", current);
router.get("/open-languages", openLanguages);
router.post("/", aiLimiter, createLesson);
router.post("/attempts/:attemptId/answer", answer);
router.post("/attempts/:attemptId/finish", finish);
router.post("/attempts/:attemptId/questions/:index/report", report);
router.get("/attempts/:attemptId/questions/:index/chat", chatHistory);
router.post("/attempts/:attemptId/questions/:index/chat/stream", aiLimiter, chatStream);

export default router;
