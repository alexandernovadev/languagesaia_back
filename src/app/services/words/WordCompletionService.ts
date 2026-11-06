/**
 * Dictionary words arrive lean: three examples and no mixed-language sentences.
 * The first time someone opens one, the AI fills in what's missing and it stays
 * saved for good, so no word is paid for until somebody really looks at it.
 */
import Word from "../../db/models/Word";
import { generateWordCodeSwitching, generateWordExamples, generateWordSynonyms } from "../ai/wordAIService";
import type { Language } from "../../../../types/business";

const FULL_EXAMPLES = 5;
const MAX_SYNONYMS = 6;

/** Two opens at once must not pay twice. */
const running = new Map<string, Promise<unknown>>();

const fill = async (id: string, userId: string | null) => {
  const word = await Word.findById(id);
  if (!word) return null;
  const pick = ({ examples, codeSwitching, synonyms, completedAt }: typeof word) => ({ examples, codeSwitching, synonyms, completedAt });
  if (word.completedAt) return pick(word);

  const language = word.language as Language;
  const options = { userId, reasoningEffort: "none" as const }; // short lists: thinking only added a long wait
  const [examples, codeSwitching, synonyms] = await Promise.allSettled([
    word.examples.length < FULL_EXAMPLES ? generateWordExamples(word.word, language, word.examples.join("\n"), options) : null,
    word.codeSwitching?.length ? null : generateWordCodeSwitching(word.word, language, "", options),
    word.synonyms?.length ? null : generateWordSynonyms(word.word, language, "", options),
  ]);

  if (examples.status === "fulfilled" && examples.value?.examples) {
    word.examples = [...word.examples, ...examples.value.examples].slice(0, FULL_EXAMPLES);
  }
  if (codeSwitching.status === "fulfilled" && codeSwitching.value?.codeSwitching) word.codeSwitching = codeSwitching.value.codeSwitching;
  if (synonyms.status === "fulfilled" && synonyms.value?.synonyms) word.synonyms = synonyms.value.synonyms.slice(0, MAX_SYNONYMS);

  // a part that failed is tried again the next time the word is opened
  const allDone = [examples, codeSwitching, synonyms].every((part) => part.status === "fulfilled");
  if (allDone) word.completedAt = new Date();
  await word.save({ timestamps: false });
  return pick(word);
};

export const completeWord = (id: string, userId: string | null) => {
  const inFlight = running.get(id);
  if (inFlight) return inFlight;
  const work = fill(id, userId).finally(() => running.delete(id));
  running.set(id, work);
  return work;
};
