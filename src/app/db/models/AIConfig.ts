import mongoose, { Schema } from "mongoose";
import { IAIConfig } from "../../../../types/models";

const AIConfigSchema: Schema = new Schema(
  {
    userId: {
      type: String,
      default: null, // null = global/default configuration
      index: true,
    },
    feature: {
      type: String,
      required: true,
      enum: ["word", "expression", "exam"],
      index: true,
    },
    operation: {
      type: String,
      required: true,
      enum: [
        "generate",
        "examples",
        "codeSwitching",
        "types",
        "synonyms",
        "chat",
        "image",
        "text",
        "topic",
        "title",
        "validate",
        "correct",
        "questionChat",
        "questionFeedback",
        "evaluateTranslation",
      ],
      index: true,
    },
    provider: {
      type: String,
      required: true,
      enum: ['openai', 'deepseek'],
    },
    model: {
      type: String,
      default: undefined, // optional model-specific override
    },
  },
  { timestamps: true }
);

// Compound index for fast lookups
AIConfigSchema.index({ userId: 1, feature: 1, operation: 1 }, { unique: true });

export default mongoose.model<IAIConfig>("AIConfig", AIConfigSchema);
