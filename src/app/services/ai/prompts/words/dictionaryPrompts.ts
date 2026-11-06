import { getLangLabel, getVariantRules } from "../langUtils";

const CONJUGATIONS: Record<string, string> = {
  en: `If it is a verb, "conjugations" is {"forms":{"base":"<go>","past":"<went>","participle":"<gone>","gerund":"<going>","third":"<goes>"}}. Otherwise it is null.`,
  pt: `If it is a verb, "conjugations" is an object with the tenses presente, preterito, imperfeito, futuro, subjuntivo, each one an object with the persons eu, voce, nos, eles. "preterito" is the pretérito perfeito and "subjuntivo" the presente do subjuntivo (only the verb form, without "que"). Otherwise it is null.`,
};

/** An entry for the shared dictionary: a very common word, explained for a beginner. */
export const createDictionaryEntryPrompt = (word: string, language: string) => {
  const label = getLangLabel(language);
  return `You are a lexicographer writing a ${label} dictionary entry for a Spanish speaker who is a beginner.
${getVariantRules(language)}
Word: "${word}". It is one of the most common words of the language.

Return ONLY JSON:
{"definition":"<simple definition in ${label}, at least 5 characters>","examples":["<3 short, everyday sentences, level A1-A2>"],"type":["<one or more, only from: noun, verb, auxiliary verb, adjective, adverb, pronoun, preposition, conjunction, determiner, interjection, particle>"],"IPA":"<pronunciation>","spanish":{"word":"<translation>","definition":"<definition in Spanish>"},"synonyms":["<up to 3, may be empty>"],"conjugations":null}

${CONJUGATIONS[language] ?? ""}`;
};

export const createDictionaryReviewPrompt = (entry: unknown, language: string) => {
  const label = getLangLabel(language);
  return `You are a strict ${label} proofreader checking a dictionary entry for a beginner who speaks Spanish.
${getVariantRules(language)}
Check the definition, the examples (natural, level A1-A2, and each one uses the word), the IPA, the Spanish translation and every conjugated form, including accents. Don't reject for matters of taste.
The JSON keys and the values of "type" are in English without accents on purpose: never report them.

ENTRY: ${JSON.stringify(entry)}

Return ONLY JSON: {"ok":<boolean>,"problems":["<short and specific>"]}`;
};
