import ExamAttempt from "../../db/models/ExamAttempt";
import Exam from "../../db/models/Exam";
import { IExamAttempt, IAttemptQuestion } from "../../../../types/models";
import { generateExamQuestionFeedback, evaluateTranslationAnswer } from "../ai/examAIService";
import logger from "../../utils/logger";

/**
 * Manages exam attempts: create, submit answers, and chat on failed questions.
 * Flow: create (empty) -> user answers -> submit (evaluate & persist) -> optional chat per failed question.
 */
export class ExamAttemptService {
  /**
   * Creates a new attempt. attemptQuestions stays empty until submit;
   * we only need examId + userId to "lock in" the attempt and track start time.
   * @param examId - Exam to attempt
   * @param userId - User starting the attempt
   */
  async create(examId: string, userId: string): Promise<IExamAttempt> {
    const exam = await Exam.findById(examId);
    if (!exam) throw new Error("Exam not found");

    const startedAt = new Date();
    const attempt = new ExamAttempt({
      examId,
      userId,
      score: 0,
      startedAt,
      completedAt: startedAt,
      attemptQuestions: [],
    });
    return attempt.save();
  }

  /**
   * Submits answers and evaluates.
   * - multiple/unique/fillInBlank: formula (correctIndex match)
   * - translateText: AI evaluation with partial credit (partial = morado/purple)
   * @param attemptId - Attempt to submit
   * @param answers - Array of answers: number for multiple, string for translateText
   * @param userId - Must match attempt owner
   */
  async submit(
    attemptId: string,
    answers: (number | string | number[])[],
    userId: string,
    explainsLanguage: string = "es"
  ): Promise<IExamAttempt | null> {
    const attempt = await ExamAttempt.findById(attemptId).populate("examId");
    if (!attempt || attempt.userId.toString() !== userId) return null;

    const exam = attempt.examId as any;
    if (!exam?.questions) return null;

    const normalize = (s: string) => String(s || "").toLowerCase().trim();
    const language = exam.language || "en";
    const difficulty = exam.difficulty || "";

    const attemptQuestions: IAttemptQuestion[] = await Promise.all(
      exam.questions.map(async (q: any, i: number) => {
        const rawAnswer = answers[i];
        const type = q.type || "multiple";
        const hasOptions = q.options && q.options.length > 0;

        let userAnswer: number | number[] | string;
        let isCorrect: boolean;
        let partialScore: number | undefined;
        let isPartial = false;
        let aiFeedback = "";

        if (type === "translateText") {
          userAnswer = rawAnswer != null ? String(rawAnswer) : "";
          try {
            const result = await evaluateTranslationAnswer({
              questionText: q.text,
              grammarTopic: q?.grammarTopic,
              difficulty,
              correctAnswer: q.correctAnswer,
              explanation: q?.explanation || "",
              userAnswer: userAnswer as string,
              language,
              explainsLanguage,
              userId,
            });
            partialScore = result.score;
            aiFeedback = result.feedback;
            isCorrect = partialScore >= 70;
            isPartial = partialScore > 0 && partialScore < 100;
          } catch (err) {
            logger.error("AI translation eval error for question", { index: i, err });
            isCorrect = normalize(userAnswer as string) === normalize(q.correctAnswer || "");
            partialScore = isCorrect ? 100 : 0;
            aiFeedback = isCorrect ? "Correct." : "Incorrect.";
          }
        } else {
          if (type === "multiple" && hasOptions) {
            const userArr = Array.isArray(rawAnswer)
              ? [...rawAnswer].sort((a, b) => a - b)
              : typeof rawAnswer === "number"
                ? [rawAnswer]
                : [];
            const correctArr = (q.correctIndices ?? (q.correctIndex != null ? [q.correctIndex] : [])).sort((a, b) => a - b);
            userAnswer = userArr;
            const correctSet = new Set(correctArr);
            const correctSelected = userArr.filter((i) => correctSet.has(i)).length;
            const wrongSelected = userArr.filter((i) => !correctSet.has(i)).length;
            const totalCorrect = correctArr.length || 1;
            partialScore = Math.round(
              Math.max(0, Math.min(100, ((correctSelected - wrongSelected) / totalCorrect) * 100))
            );
            isCorrect = partialScore === 100;
            isPartial = partialScore > 0 && partialScore < 100;
          } else if ((type === "unique" && hasOptions) || (type === "fillInBlank" && hasOptions)) {
            userAnswer = typeof rawAnswer === "number" ? rawAnswer : -1;
            isCorrect = userAnswer === (q.correctIndex ?? -1);
          } else {
            userAnswer = rawAnswer != null ? String(rawAnswer) : "";
            isCorrect = normalize(userAnswer as string) === normalize(q.correctAnswer || "");
          }
          try {
            aiFeedback = await generateExamQuestionFeedback({
              questionText: q.text,
              questionType: type,
              grammarTopic: q?.grammarTopic,
              difficulty,
              options: q.options,
              correctIndex: q.correctIndex,
              correctIndices: q.correctIndices,
              correctAnswer: q.correctAnswer,
              explanation: q?.explanation || "",
              userAnswer,
              isCorrect,
              language,
              explainsLanguage,
              userId,
            });
          } catch (err) {
            logger.error("AI feedback error for question", { index: i, err });
            aiFeedback = isCorrect ? "Correct." : "Incorrect.";
          }
        }

        return {
          questionIndex: i,
          questionText: q.text,
          questionType: type,
          options: q.options,
          correctIndex: q.correctIndex,
          correctIndices: q.correctIndices,
          correctAnswer: q.correctAnswer,
          grammarTopic: q?.grammarTopic,
          userAnswer,
          isCorrect,
          partialScore,
          isPartial,
          aiFeedback,
          chat: attempt.attemptQuestions[i]?.chat || [],
        };
      })
    );

    const score = Math.round(
      attemptQuestions.reduce((sum, a) => {
        if (a.partialScore != null) return sum + a.partialScore;
        return sum + (a.isCorrect ? 100 : 0);
      }, 0) / attemptQuestions.length
    );

    return ExamAttempt.findByIdAndUpdate(
      attemptId,
      {
        attemptQuestions,
        score,
        completedAt: new Date(),
      },
      { new: true }
    ).populate("examId");
  }

  /**
   * Fetches an attempt by ID with exam populated.
   * @param attemptId - Attempt MongoDB ObjectId
   */
  async getById(attemptId: string): Promise<IExamAttempt | null> {
    return ExamAttempt.findById(attemptId).populate("examId");
  }

  /**
   * Lists attempts for a user, most recent first.
   * @param userId - User MongoDB ObjectId
   * @param limit - Max attempts to return
   */
  async getByUser(userId: string, limit = 20): Promise<IExamAttempt[]> {
    return ExamAttempt.find({ userId })
      .populate("examId")
      .sort({ completedAt: -1 })
      .limit(limit);
  }

  async getByExam(examId: string, userId: string, limit = 20): Promise<IExamAttempt[]> {
    return ExamAttempt.find({ examId, userId })
      .populate("examId")
      .sort({ completedAt: -1 })
      .limit(limit);
  }

  /**
   * Deletes an attempt. Only the owner can delete.
   * @param attemptId - Attempt to delete
   * @param userId - Must match attempt owner
   * @returns true if deleted, false if not found or not owner
   */
  async delete(attemptId: string, userId: string): Promise<boolean> {
    const attempt = await ExamAttempt.findById(attemptId);
    if (!attempt || attempt.userId.toString() !== userId) return false;
    await ExamAttempt.findByIdAndDelete(attemptId);
    return true;
  }

  /**
   * Appends a chat message to a failed question. Chat is stored per question
   * so the user can ask the AI to explain their mistake and get pedagogical feedback.
   * @param attemptId - Attempt containing the question
   * @param questionIndex - Index of the failed question
   * @param role - "user" or "assistant"
   * @param content - Message text
   * @param userId - Must match attempt owner
   */
  async addChatMessage(
    attemptId: string,
    questionIndex: number,
    role: string,
    content: string,
    userId: string
  ): Promise<IExamAttempt | null> {
    const attempt = await ExamAttempt.findById(attemptId);
    if (!attempt || attempt.userId.toString() !== userId) return null;

    const questions = [...(attempt.attemptQuestions || [])];
    const q = questions[questionIndex];
    if (!q) return null;

    q.chat = q.chat || [];
    q.chat.push({ role, content });

    return ExamAttempt.findByIdAndUpdate(
      attemptId,
      { attemptQuestions: questions },
      { new: true }
    ).populate("examId");
  }
}
