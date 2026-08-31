import { generateAIContent, AIContentOptions } from "./aiGenerationHelper";

export type ReaderTextOptions = AIContentOptions;

export interface SelectionClassification {
  is_phrasalVerb: boolean;
  is_commonWord: boolean;
  is_expression: boolean;
}

export const translateSelection = async (
  text: string,
  targetLanguage: string,
  options: ReaderTextOptions = {}
): Promise<string> => {
  return generateAIContent({
    feature: "reader",
    operation: "translate",
    promptData: {
      system:
        "You are a precise translator. Translate the user's text into the requested language. Return only the translation, nothing else.",
      user: `Translate the following text to ${targetLanguage}. Just give me the translation, nothing else.\n\n"${text}"`,
    },
    options,
    stream: false,
    defaultTemperature: 0.3,
  });
};

export const classifySelection = async (
  text: string,
  options: ReaderTextOptions = {}
): Promise<SelectionClassification> => {
  const result = await generateAIContent({
    feature: "reader",
    operation: "classify",
    promptData: {
      system:
        "You classify selected English text. Respond ONLY with valid JSON.",
      user:
        `Classify the selected text below using exactly three independent booleans:\n` +
        `- is_phrasalVerb: true if it is a phrasal verb (e.g. "give up", "look after")\n` +
        `- is_commonWord: true if it is a common, useful word worth saving\n` +
        `- is_expression: true if it is an expression or idiom (e.g. "piece of cake")\n\n` +
        `These flags are independent; more than one can be true.\n\n` +
        `Respond with JSON in this exact shape:\n` +
        `{ "is_phrasalVerb": boolean, "is_commonWord": boolean, "is_expression": boolean }\n\n` +
        `Selected text: "${text}"`,
    },
    options,
    stream: false,
    defaultTemperature: 0.2,
    nonStreamResponseFormat: "json_object",
    parseJSON: true,
  });

  return {
    is_phrasalVerb: !!result.is_phrasalVerb,
    is_commonWord: !!result.is_commonWord,
    is_expression: !!result.is_expression,
  };
};
