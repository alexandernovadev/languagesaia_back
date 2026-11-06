/**
 * Finds the pieces of a chapter that only mean something together. A beginner
 * can't know "picked her up" is one thing, so missing one is the real risk: two
 * models search at once, and a judge reads each one in its sentence.
 */
import { TEXT_AI } from "../../../config/aiConfig";
import { createPhraseJudgePrompt, createPhraseSearchPrompt, Phrase } from "./prompts/stories/phrasePrompts";
import { generateText } from "./textAIService";

// Thinking made this 20 times slower and the lists worse
const ask = async (prompt: string, model?: string): Promise<any[]> => {
  const res: any = await generateText(prompt, { model, responseFormat: "json_object", temperature: 0.2, reasoningEffort: "none" });
  return JSON.parse(res.choices[0].message.content ?? "{}").items ?? [];
};

const appearsIn = (content: string, text: string) => {
  const lower = content.toLowerCase();
  return text.toLowerCase().split(/\.{2,}|…/).every((piece) => lower.includes(piece.trim()));
};

const MAX_PHRASES = 15; // past this the page is all underlines

const wordsOf = (phrase: Phrase): string[] => phrase.text.toLowerCase().match(/\p{L}+/gu) ?? [];

/** "stay up" inside "stay up late", or the same phrase twice: one mark is enough. */
const withoutRepeats = (phrases: Phrase[]) => {
  const longest = [...phrases].sort((a, b) => wordsOf(b).length - wordsOf(a).length);
  const kept = longest.filter((phrase, i) => !longest.slice(0, i).some((other) => wordsOf(phrase).every((w) => wordsOf(other).includes(w))));
  return phrases.filter((phrase) => kept.includes(phrase));
};

export const findPhrases = async (content: string, language: string): Promise<Phrase[]> => {
  const search = createPhraseSearchPrompt(content, language);
  const found = await Promise.allSettled([ask(search), ask(search, TEXT_AI.fallback)]);

  const candidates = new Map<string, { text: string; base: string }>();
  for (const list of found) {
    if (list.status !== "fulfilled") continue;
    for (const item of list.value) if (item?.base && item?.text) candidates.set(item.base.toLowerCase(), item);
  }
  if (candidates.size === 0) return [];

  const judged = await ask(createPhraseJudgePrompt(content, language, [...candidates.values()]));
  const kept: Phrase[] = judged
    .filter((p) => p.keep && p.text && p.base && p.meaning && appearsIn(content, p.text))
    .map(({ text, base, type, meaning, sentence }) => ({ text, base, type, meaning, sentence }));
  return withoutRepeats(kept).slice(0, MAX_PHRASES);
};
