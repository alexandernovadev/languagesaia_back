import { generateAIContent, AIContentOptions } from "./aiGenerationHelper";
import { getLangLabel, getVariantRules } from "./prompts/langUtils";

export interface WordLookup {
  lemma: string;
  translation: string;
  ipa: string;
}

/** What a word in a sentence means: for the forms the dictionary doesn't list, like "batia". */
export const lookupWordInContext = (word: string, sentence: string, language: string, options: AIContentOptions = {}): Promise<WordLookup> =>
  generateAIContent({
    promptData: {
      system: `You help a Spanish speaker reading ${getLangLabel(language)}. ${getVariantRules(language)}
Respond with only a JSON object: {"lemma": "dictionary form of the word", "translation": "Spanish meaning in this sentence, 1 to 3 words", "ipa": "/pronunciation of the word as written/"}`,
      user: `Word: ${word}\nSentence: ${sentence}`,
    },
    options: { ...options, reasoningEffort: "none" },
    stream: false,
    defaultTemperature: 0.1,
    nonStreamResponseFormat: "json_object",
    parseJSON: true,
  });
