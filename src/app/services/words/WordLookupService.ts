/**
 * What a tapped word means. Asking the AI takes seconds, so it comes last:
 * the dictionary, then its conjugations, then the forms already explained.
 * Whatever the AI answers is kept, so a form is never asked about twice.
 */
import Word from "../../db/models/Word";
import WordForm from "../../db/models/WordForm";
import UserWord from "../../db/models/UserWord";
import { IWord } from "../../../../types/models";
import { lookupWordInContext } from "../ai/readerAIService";
import { AIContentOptions } from "../ai/aiGenerationHelper";
import { normalizeWordKey } from "../../utils/text/normalizeWordKey";

const ENGLISH_FORMS = ["past", "participle", "gerund", "third"];
const TENSES = ["presente", "preterito", "imperfeito", "futuro", "subjuntivo"];
const PERSONS = ["eu", "voce", "nos", "eles"];

const conjugationPaths = (language: string) =>
  language === "pt"
    ? TENSES.flatMap((tense) => PERSONS.map((person) => `conjugations.${tense}.${person}`))
    : ENGLISH_FORMS.map((form) => `conjugations.forms.${form}`);

const findByKey = (key: string, language: string) => Word.findOne({ wordKey: normalizeWordKey(key), language } as any).lean<IWord>();

const findByConjugation = (form: string, language: string) =>
  Word.findOne({ language, $or: conjugationPaths(language).map((path) => ({ [path]: form })) } as any).lean<IWord>();

/** Which form of the verb it is: every person that writes it the same way, like eu and você in estava. */
function grammarOf(word: IWord, form: string, language: string) {
  const paths = conjugationPaths(language).filter((path) => {
    const value = path.split(".").reduce<any>((at, key) => at?.[key], word);
    return typeof value === "string" && normalizeWordKey(value) === form;
  });
  if (!paths.length) return undefined;
  const [, tense] = paths[0].split(".");
  return { tense: language === "pt" ? tense : paths[0].split(".")[2], persons: language === "pt" ? paths.filter((p) => p.split(".")[1] === tense).map((p) => p.split(".")[2]) : [] };
}

async function fromDictionary(word: IWord, userId: string, extra: { translation?: string; ipa?: string; grammar?: ReturnType<typeof grammarOf> } = {}) {
  const mine = await UserWord.exists({ userId, wordId: word._id } as any);
  return {
    lemma: word.word,
    translation: extra.translation || word.spanish?.word || "",
    ipa: extra.ipa || word.IPA || "",
    wordId: String(word._id),
    audio: word.audio,
    inList: !!mine,
    grammar: extra.grammar,
  };
}

export async function lookupWord(text: string, sentence: string, language: string, userId: string, options: AIContentOptions = {}) {
  const form = normalizeWordKey(text);

  const exact = await findByKey(form, language);
  if (exact) return fromDictionary(exact, userId);
  const verb = await findByConjugation(form, language);
  if (verb) return fromDictionary(verb, userId, { grammar: grammarOf(verb, form, language) });

  const saved = await WordForm.findOne({ language, form }).lean();
  const explained = saved ?? (await lookupWordInContext(form, sentence, language, options));
  if (!saved) {
    await WordForm.updateOne({ language, form }, { $set: { lemma: explained.lemma, translation: explained.translation, ipa: explained.ipa } }, { upsert: true });
  }

  const lemma = await findByKey(explained.lemma, language);
  if (lemma) return fromDictionary(lemma, userId, explained);
  return { lemma: explained.lemma, translation: explained.translation, ipa: explained.ipa, inList: false };
}
