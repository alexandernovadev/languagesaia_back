/**
 * Exam AI (Bruno): write exercises, grade free translations, explain mistakes.
 */
import { generateChat, generateText } from "./textAIService";
import {
  createExamGenerationPrompt,
  createQuestionChatSystem,
  createTranslationEvalPrompt,
  type ExamGenerationParams,
} from "./prompts/exams/examPrompts";

const json = (res: any) => {
  const content = res?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty AI response");
  return JSON.parse(content);
};

/** Raw exercises from the AI (normalized later by ExamService). */
export const generateExercises = async (params: ExamGenerationParams): Promise<{ title?: string; questions: any[] }> => {
  const { system, user } = createExamGenerationPrompt(params);
  const res = await generateText(`${system}\n\n${user}`, { tier: "reasoning", responseFormat: "json_object", temperature: 0.8 });
  return json(res);
};

/** 0–1 score + short Markdown feedback for a free translation. */
export const gradeTranslation = async (p: Parameters<typeof createTranslationEvalPrompt>[0]): Promise<{ score: number; feedback: string }> => {
  const { system, user } = createTranslationEvalPrompt(p);
  const res = await generateText(`${system}\n\n${user}`, { responseFormat: "json_object", temperature: 0.2 });
  const out = json(res);
  const score = Math.max(0, Math.min(100, Number(out.score) || 0)) / 100;
  return { score, feedback: String(out.feedback ?? "") };
};

/** Streams Bruno's explanation for one exercise. */
export const streamQuestionChat = (
  context: Parameters<typeof createQuestionChatSystem>[0],
  history: Array<{ role: "user" | "assistant"; content: string }>,
  message: string,
) =>
  generateChat([{ role: "system", content: createQuestionChatSystem(context) }, ...history, { role: "user", content: message }], {
    stream: true,
    temperature: 0.5,
  });
