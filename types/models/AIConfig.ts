import { Document } from "mongoose";

export type AIFeature = "word" | "expression" | "lecture" | "exam" | "story";

export type AIOperation =
  | "generate"
  | "examples"
  | "codeSwitching"
  | "types"
  | "synonyms"
  | "chat"
  | "image"
  | "text"
  | "topic"
  | "validate"
  | "correct"
  | "questionChat"
  | "questionFeedback"
  | "evaluateTranslation";

export type AIProvider = 'openai' | 'deepseek';

export interface IAIConfig extends Omit<Document, 'model'> {
  userId?: string | null; // null = configuración global/default
  feature: AIFeature;
  operation: AIOperation;
  provider: AIProvider;
  model?: string; // opcional override de modelo específico
  createdAt: Date;
  updatedAt: Date;
}
