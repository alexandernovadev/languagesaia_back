import { generateText, generateChat } from "./textAIService";
import {
  createExamGenerationPrompt,
  createExamValidationPrompt,
  createExamCorrectionPrompt,
  createExamQuestionChatPrompt,
  createExamQuestionFeedbackPrompt,
  createExamEvaluateTranslationPrompt,
} from "./prompts/exams";

export interface GenerateExamParams {
  language: string;
  grammarTopics: string[];
  difficulty: string;
  questionCount: number;
  questionTypes?: string[];
  topic?: string;
}

/**
 * Generates an exam via AI. Returns JSON with title and questions.
 */
export const generateExam = async (
  params: GenerateExamParams,
  options?: { userId?: string | null }
) => {
  const questionTypes = params.questionTypes?.length
    ? params.questionTypes
    : ["multiple"];
  const promptData = createExamGenerationPrompt({
    ...params,
    questionTypes: questionTypes as any,
  });
  const fullPrompt = `${promptData.system}\n\n${promptData.user}`;

  const response = await generateText(fullPrompt, {
    responseFormat: "json_object",
    temperature: 0.3,
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content) throw new Error("Exam generation returned empty content");

  return JSON.parse(content);
};

export const validateExam = async (
  examJson: string,
  options?: { userId?: string | null }
) => {
  const promptData = createExamValidationPrompt(examJson);
  const fullPrompt = `${promptData.system}\n\n${promptData.user}`;

  const response = await generateText(fullPrompt, {
    model: "deepseek-reasoner",
    responseFormat: "json_object",
    temperature: 0.3,
    maxTokens: 4000,
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content) throw new Error("Validation returned empty content");

  return JSON.parse(content);
};

export const correctExam = async (
  exam: object,
  validation: object,
  options?: { userId?: string | null }
) => {
  const examJson = JSON.stringify(exam);
  const validationJson = JSON.stringify(validation);
  const promptData = createExamCorrectionPrompt({ examJson, validationJson });
  const fullPrompt = `${promptData.system}\n\n${promptData.user}`;

  const response = await generateText(fullPrompt, {
    model: "deepseek-reasoner",
    responseFormat: "json_object",
    temperature: 0.3,
    maxTokens: 4000,
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content) throw new Error("Correction returned empty content");

  return JSON.parse(content);
};

export interface ExamQuestionChatParams {
  questionText: string;
  questionType: string;
  grammarTopic?: string;
  difficulty?: string;
  options?: string[];
  correctIndex?: number;
  correctIndices?: number[];
  correctAnswer?: string;
  explanation: string;
  userAnswer: number | number[] | string;
  userMessage: string;
  chatHistory: Array<{ role: string; content: string }>;
  language: string;
  explainsLanguage?: string;
  userId?: string | null;
}

export const generateExamQuestionChat = async (params: ExamQuestionChatParams) => {
  const { userId, ...promptParams } = params;
  const { messages } = createExamQuestionChatPrompt(promptParams);

  const response = await generateChat(messages, {
    temperature: 0.3,
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content) throw new Error("Chat returned empty content");

  return content;
};

export interface ExamQuestionFeedbackParams {
  questionText: string;
  questionType: string;
  grammarTopic?: string;
  difficulty?: string;
  options?: string[];
  correctIndex?: number;
  correctIndices?: number[];
  correctAnswer?: string;
  explanation: string;
  userAnswer: number | number[] | string;
  isCorrect: boolean;
  language: string;
  explainsLanguage?: string;
  userId?: string | null;
}

export const generateExamQuestionFeedback = async (
  params: ExamQuestionFeedbackParams
): Promise<string> => {
  const { userId, ...feedbackParams } = params;
  const { system, messages } = createExamQuestionFeedbackPrompt(feedbackParams);
  const fullPrompt = `${system}\n\n${messages[0].content}`;

  const response = await generateText(fullPrompt, {
    temperature: 0.3,
    maxTokens: 300,
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content) throw new Error("Feedback returned empty content");

  return content.trim();
};

export interface EvaluateTranslationResult {
  score: number;
  reasoning: string;
  feedback: string;
}

export const evaluateTranslationAnswer = async (params: {
  questionText: string;
  grammarTopic?: string;
  difficulty?: string;
  correctAnswer?: string;
  explanation: string;
  userAnswer: string;
  language: string;
  explainsLanguage?: string;
  userId?: string | null;
}): Promise<EvaluateTranslationResult> => {
  const { userId, ...rest } = params;
  const { system, user } = createExamEvaluateTranslationPrompt({
    ...rest,
    questionType: "translateText",
  });
  const fullPrompt = `${system}\n\n${user}`;

  const response = await generateText(fullPrompt, {
    responseFormat: "json_object",
    temperature: 0.3,
    maxTokens: 500,
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content) throw new Error("Evaluate translation returned empty content");

  const parsed = JSON.parse(content) as {
    score?: number;
    reasoning?: string;
    feedback?: string;
  };
  const score = Math.min(100, Math.max(0, Math.round(Number(parsed.score) || 0)));
  return {
    score,
    reasoning: String(parsed.reasoning || ""),
    feedback: String(parsed.feedback || "").trim(),
  };
};
