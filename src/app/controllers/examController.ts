/**
 * Exam feature controller. Flow:
 * 1. generate -> AI returns exam JSON (no persist)
 * 2. validate -> AI reviews exam, returns thumbsUp/issues
 * 3. create -> persist exam
 * 4. startAttempt -> user begins exam
 * 5. submitAttempt -> evaluate answers, store results
 * 6. chatOnQuestion -> AI explains failed questions
 */
import { Request, Response } from "express";
import { successResponse, errorResponse } from "../utils/responseHelpers";
import { parseLimit } from "../utils/pagination";
import { generateExam, validateExam, correctExam, generateExamQuestionChat } from "../services/ai/examAIService";
import { ExamService } from "../services/exams/ExamService";
import { ExamAttemptService } from "../services/exams/ExamAttemptService";
import { ExamExportService } from "../services/exams/ExamExportService";
import { ExamImportService } from "../services/import/ExamImportService";
import { validateJsonBuffer, MAX_IMPORT_ITEMS } from "../middlewares/uploadMiddleware";
import logger from "../utils/logger";
import { ExamCreateSchema, ExamGenerateSchema, parseBody } from "../validators/schemas";
import { toExamDTO, toAttemptDTO, mapPaginated } from "../dto/mappers";
import { routeParams } from "../utils/http/routeParams";

const examService = new ExamService();
const examExportService = new ExamExportService();
const examImportService = new ExamImportService();
const attemptService = new ExamAttemptService();

/**
 * POST /api/exams/generate
 * Generates an exam via AI. Does not persist. Body: language, grammarTopics, difficulty, questionCount, questionTypes?, topic?
 */
export const generate = async (req: Request, res: Response) => {
  try {
    const parsed = parseBody(ExamGenerateSchema, req.body, res);
    if (!parsed) return errorResponse(res, "Invalid request body", 400);
    const { grammarTopics, difficulty, questionCount, questionTypes, topic } = parsed;
    const language = parsed.language || req.user?.language || "en";

    const result = await generateExam(
      { language, grammarTopics, difficulty, questionCount, questionTypes, topic },
      { userId: req.user?._id }
    );
    return successResponse(res, "Exam generated", result);
  } catch (error: any) {
    logger.error("Exam generate error:", error);
    return errorResponse(res, error.message || "Error generating exam", 500, error);
  }
};

/**
 * POST /api/exams/validate
 * Validates an exam via AI (teacher review). Body: exam (object or stringified JSON).
 * Returns: valid, score, thumbsUp, issues, suggestions.
 */
export const validate = async (req: Request, res: Response) => {
  try {
    const examData = req.body.exam ?? req.body;
    const examJson = typeof examData === "string" ? examData : JSON.stringify(examData);
    if (!examJson || examJson === "{}") return errorResponse(res, "Exam data required", 400);

    const userId =
      req.user?._id?.toString?.() ?? (req.user as { id?: string })?.id ?? null;
    const result = await validateExam(examJson, { userId });
    return successResponse(res, "Exam validated", result);
  } catch (error: any) {
    logger.error("Exam validate error:", error);
    return errorResponse(res, error.message || "Error validating exam", 500, error);
  }
};

/**
 * POST /api/exams/correct
 * Corrects an exam based on validation feedback. Body: { exam, validation }.
 * Returns corrected exam { title, questions }.
 */
export const correct = async (req: Request, res: Response) => {
  try {
    const { exam, validation } = req.body;
    if (!exam || !validation) {
      return errorResponse(res, "exam and validation required", 400);
    }

    const userId =
      req.user?._id?.toString?.() ?? (req.user as { id?: string })?.id ?? null;
    const result = await correctExam(exam, validation, { userId });
    return successResponse(res, "Exam corrected", result);
  } catch (error: any) {
    logger.error("Exam correct error:", error);
    return errorResponse(res, error.message || "Error correcting exam", 500, error);
  }
};

/**
 * POST /api/exams
 * Persists an exam (e.g. after generate + validate). Body: title, language, difficulty, grammarTopics, questions, topic?
 */
export const create = async (req: Request, res: Response) => {
  try {
    const examData = parseBody(ExamCreateSchema, req.body, res);
    if (!examData) return errorResponse(res, "Invalid request body", 400);
    const exam = await examService.create({
      ...(examData as any),
      language: examData.language || req.user?.language || "en",
      createdBy: req.user?._id,
    });
    return successResponse(res, "Exam created", toExamDTO(exam), 201);
  } catch (error: any) {
    return errorResponse(res, error.message || "Error creating exam", 500, error);
  }
};

/** GET /api/exams/:id - Fetches an exam by ID */
export const getById = async (req: Request, res: Response) => {
  try {
    const exam = await examService.getById(routeParams(req).id);
    if (!exam) return errorResponse(res, "Exam not found", 404);
    return successResponse(res, "Exam found", toExamDTO(exam));
  } catch (error: any) {
    return errorResponse(res, error.message || "Error getting exam", 500, error);
  }
};

/** GET /api/exams - Paginated list. Query: page?, limit? Includes attemptCount when user is authenticated. Filters by req.user.language. */
export const list = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseLimit(req.query.limit, 20);
    const userId = req.user?._id?.toString() || req.user?.id;
    const language = req.user?.language;
    const result = await examService.list(page, limit, userId, language);
    return successResponse(res, "Exams listed", mapPaginated(result, toExamDTO));
  } catch (error: any) {
    return errorResponse(res, error.message || "Error listing exams", 500, error);
  }
};

/** DELETE /api/exams/:id - Deletes an exam */
export const remove = async (req: Request, res: Response) => {
  try {
    const exam = await examService.delete(routeParams(req).id);
    if (!exam) return errorResponse(res, "Exam not found", 404);
    return successResponse(res, "Exam deleted", {});
  } catch (error: any) {
    return errorResponse(res, error.message || "Error deleting exam", 500, error);
  }
};

/**
 * POST /api/exams/:id/attempts
 * Starts an attempt. Creates empty attempt; answers filled on submit.
 */
export const startAttempt = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return errorResponse(res, "Unauthorized", 401);

    const attempt = await attemptService.create(routeParams(req).id, userId.toString());
    return successResponse(res, "Attempt started", toAttemptDTO(attempt), 201);
  } catch (error: any) {
    return errorResponse(res, error.message || "Error starting attempt", 500, error);
  }
};

/**
 * POST /api/exams/:id/attempts/:attemptId/submit
 * Submits answers. Body: { answers: (number|string)[] } - number for multiple/unique/fillInBlank (with options), string for translateText
 */
export const submitAttempt = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return errorResponse(res, "Unauthorized", 401);

    const { answers } = req.body;
    if (!Array.isArray(answers)) return errorResponse(res, "answers array required", 400);

    const explainsLanguage = req.user?.explainsLanguage || "es";
    const attempt = await attemptService.submit(
      routeParams(req).attemptId,
      answers,
      userId.toString(),
      explainsLanguage
    );
    if (!attempt) return errorResponse(res, "Attempt not found", 404);
    return successResponse(res, "Attempt submitted", toAttemptDTO(attempt));
  } catch (error: any) {
    return errorResponse(res, error.message || "Error submitting attempt", 500, error);
  }
};

/** DELETE /api/exams/:id/attempts/:attemptId - Deletes an attempt (owner only) */
export const deleteAttempt = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return errorResponse(res, "Unauthorized", 401);

    const deleted = await attemptService.delete(routeParams(req).attemptId, userId.toString());
    if (!deleted) return errorResponse(res, "Attempt not found", 404);
    return successResponse(res, "Attempt deleted", {});
  } catch (error: any) {
    return errorResponse(res, error.message || "Error deleting attempt", 500, error);
  }
};

/** GET /api/exams/:id/attempts/:attemptId - Fetches an attempt with exam populated */
export const getAttempt = async (req: Request, res: Response) => {
  try {
    const attempt = await attemptService.getById(routeParams(req).attemptId);
    if (!attempt) return errorResponse(res, "Attempt not found", 404);
    return successResponse(res, "Attempt found", toAttemptDTO(attempt));
  } catch (error: any) {
    return errorResponse(res, error.message || "Error getting attempt", 500, error);
  }
};

/** GET /api/exams/:id/attempts - Lists attempts for a specific exam. Query: limit? */
export const listAttemptsByExam = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return errorResponse(res, "Unauthorized", 401);

    const limit = parseLimit(req.query.limit, 20);
    const attempts = await attemptService.getByExam(
      routeParams(req).id,
      userId.toString(),
      limit
    );
    return successResponse(res, "Attempts listed", attempts.map(toAttemptDTO));
  } catch (error: any) {
    return errorResponse(res, error.message || "Error listing attempts", 500, error);
  }
};

/** GET /api/exams/attempts/my - Lists current user's attempts. Query: limit? */
export const listAttempts = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return errorResponse(res, "Unauthorized", 401);

    const limit = parseLimit(req.query.limit, 20);
    const attempts = await attemptService.getByUser(userId.toString(), limit);
    return successResponse(res, "Attempts listed", attempts.map(toAttemptDTO));
  } catch (error: any) {
    return errorResponse(res, error.message || "Error listing attempts", 500, error);
  }
};

/**
 * POST /api/exams/:id/attempts/:attemptId/questions/:questionIndex/chat
 * Chat with AI on a failed question. Body: { message }. Only allowed for isCorrect=false questions.
 */
export const chatOnQuestion = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return errorResponse(res, "Unauthorized", 401);

    const { message } = req.body;
    if (!message?.trim()) return errorResponse(res, "message required", 400);

    const attempt = await attemptService.getById(routeParams(req).attemptId);
    if (!attempt || attempt.userId.toString() !== userId.toString()) {
      return errorResponse(res, "Attempt not found", 404);
    }

    const exam = attempt.examId as any;
    if (!exam?.questions) return errorResponse(res, "Exam not found", 404);

    const questionIndex = parseInt(routeParams(req).questionIndex);
    const q = exam.questions[questionIndex];
    const aq = attempt.attemptQuestions?.[questionIndex];
    if (!q || !aq) return errorResponse(res, "Question not found", 404);
    if (aq.isCorrect) return errorResponse(res, "Chat only for failed questions", 400);

    const explainsLanguage = req.user?.explainsLanguage || "es";
    const aiResponse = await generateExamQuestionChat({
      questionText: q.text,
      questionType: q.type || "multiple",
      grammarTopic: q.grammarTopic,
      difficulty: exam.difficulty,
      options: q.options,
      correctIndex: q.correctIndex,
      correctIndices: q.correctIndices,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      userAnswer: aq.userAnswer,
      userMessage: message.trim(),
      chatHistory: aq.chat || [],
      language: exam.language || "en",
      explainsLanguage,
      userId: userId.toString(),
    });

    await attemptService.addChatMessage(
      routeParams(req).attemptId,
      questionIndex,
      "user",
      message.trim(),
      userId.toString()
    );
    await attemptService.addChatMessage(
      routeParams(req).attemptId,
      questionIndex,
      "assistant",
      aiResponse,
      userId.toString()
    );

    return successResponse(res, "Chat message added", { response: aiResponse });
  } catch (error: any) {
    logger.error("Exam chat error:", error);
    return errorResponse(res, error.message || "Error in chat", 500, error);
  }
};

/** GET /api/exams/export-file - Exports all exams as a JSON file */
export const exportExamsToJSON = async (req: Request, res: Response): Promise<Response> => {
  try {
    const exams = await examExportService.getAllExamsForExport();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="exams-export-${timestamp}.json"`);
    return successResponse(res, `Exported ${exams.length} exams successfully`, {
      totalExams: exams.length,
      exportDate: new Date().toISOString(),
      exams,
    });
  } catch (error) {
    return errorResponse(res, "An error occurred while exporting exams to JSON", 500, error);
  }
};

/** POST /api/exams/import-file - Imports exams from a JSON file */
export const importExamsFromFile = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!req.file) return errorResponse(res, "No file uploaded", 400);

    if (!validateJsonBuffer(req.file.buffer)) {
      return errorResponse(res, "File content is not valid JSON", 400);
    }

    let fileData: any;
    try {
      fileData = JSON.parse(req.file.buffer.toString("utf-8"));
    } catch {
      return errorResponse(res, "Invalid JSON file format", 400);
    }

    let exams: any[] = [];
    if (fileData.data?.exams && Array.isArray(fileData.data.exams)) {
      exams = fileData.data.exams;
    } else if (fileData.data?.data?.exams && Array.isArray(fileData.data.data.exams)) {
      exams = fileData.data.data.exams;
    } else if (fileData.exams && Array.isArray(fileData.exams)) {
      exams = fileData.exams;
    } else if (Array.isArray(fileData)) {
      exams = fileData;
    } else {
      return errorResponse(res, "Invalid file structure. Expected 'exams' array", 400);
    }

    if (exams.length > MAX_IMPORT_ITEMS) {
      return errorResponse(res, `Import exceeds maximum of ${MAX_IMPORT_ITEMS} items per request`, 400);
    }

    const { duplicateStrategy = "skip", validateOnly = "false", batchSize = "10" } = req.query;

    const validStrategies = ["skip", "overwrite", "error", "merge"];
    if (!validStrategies.includes(duplicateStrategy as string)) {
      return errorResponse(res, `Invalid duplicateStrategy. Must be one of: ${validStrategies.join(", ")}`, 400);
    }

    const batchSizeNum = parseInt(batchSize as string);
    if (isNaN(batchSizeNum) || batchSizeNum < 1 || batchSizeNum > 100) {
      return errorResponse(res, "Invalid batchSize. Must be a number between 1 and 100", 400);
    }

    if (validateOnly === "true") {
      const results = await examImportService.validateExams(exams);
      return successResponse(res, "Validation completed", {
        totalExams: exams.length,
        valid: results.filter((r) => r.status === "valid").length,
        invalid: results.filter((r) => r.status === "invalid").length,
        validationResults: results,
      });
    }

    const importResult = await examImportService.importExams(exams, {
      duplicateStrategy: duplicateStrategy as any,
      validateOnly: false,
      batchSize: batchSizeNum,
    });

    return successResponse(res, "Import completed successfully", importResult);
  } catch (error) {
    logger.error("Exam import error:", error);
    return errorResponse(res, "Error importing exams", 500, error);
  }
};
