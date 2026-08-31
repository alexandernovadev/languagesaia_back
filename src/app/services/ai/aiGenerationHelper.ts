import { generateText } from "./aiService";
import { TextProvider } from "../../../config/aiConfig";
import { getAIProvider } from "./aiConfigHelper";
import { AIFeature, AIOperation } from "../../../../types/models";

export interface AIContentOptions {
  provider?: TextProvider;
  userId?: string | null;
  stream?: boolean;
  temperature?: number;
  [key: string]: any;
}

interface GenerateAIContentParams {
  feature: AIFeature;
  operation: AIOperation;
  promptData: { system: string; user: string };
  options: AIContentOptions;
  /** Final streaming decision for this call (some callers force it, others forward `options.stream`). */
  stream: boolean;
  defaultTemperature: number;
  /** Only used when `stream` is false. Defaults to "text". */
  nonStreamResponseFormat?: "text" | "json_object";
  /** Only used when `stream` is false and `nonStreamResponseFormat` is "json_object". */
  parseJSON?: boolean;
}

/**
 * Shared tail end of every AI text-generation call: resolve the provider,
 * call the model, and either return the raw stream or extract/validate/parse
 * the completion content. Used by storyAIService (the same
 * "getAIProvider -> generateText -> validate content" shape also appears
 * in wordAIService/examAIService, left untouched for now).
 */
export async function generateAIContent(
  params: GenerateAIContentParams
): Promise<any> {
  const {
    feature,
    operation,
    promptData,
    options,
    stream,
    defaultTemperature,
    nonStreamResponseFormat = "text",
    parseJSON = false,
  } = params;

  const provider = await getAIProvider(options.userId, feature, operation, options);
  const temperature = options.temperature ?? defaultTemperature;
  const prompt = `${promptData.system}\n\n${promptData.user}`;

  if (stream) {
    return generateText(provider, prompt, undefined, {
      ...options,
      responseFormat: "text",
      temperature,
      stream: true,
    });
  }

  const response = await generateText(provider, prompt, undefined, {
    ...options,
    responseFormat: nonStreamResponseFormat,
    temperature,
    stream: false,
  });
  const content = response.choices[0].message.content;
  if (!content) throw new Error("Completion content is null");
  return parseJSON ? JSON.parse(content) : content.trim();
}
