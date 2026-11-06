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

async function fromDictionary(word: IWord, userId: string, extra: { translation?: string; ipa?: string } = {}) {
  const mine = await UserWord.exists({ userId, wordId: word._id } as any);
  return {
    lemma: word.word,
    translation: extra.translation || word.spanish?.word || "",
    ipa: extra.ipa || word.IPA || "",
    wordId: String(word._id),
    audio: word.audio,
    inList: !!mine,
  };
}

export async function lookupWord(text: string, sentence: string, language: string, userId: string, options: AIContentOptions = {}) {
  const form = normalizeWordKey(text);

  const known = (await findByKey(form, language)) ?? (await findByConjugation(form, language));
  if (known) return fromDictionary(known, userId);

  const saved = await WordForm.findOne({ language, form }).lean();
  const explained = saved ?? (await lookupWordInContext(form, sentence, language, options));
  if (!saved) {
    await WordForm.updateOne({ language, form }, { $set: { lemma: explained.lemma, translation: explained.translation, ipa: explained.ipa } }, { upsert: true });
  }

  const lemma = await findByKey(explained.lemma, language);
  if (lemma) return fromDictionary(lemma, userId, explained);
  return { lemma: explained.lemma, translation: explained.translation, ipa: explained.ipa, inList: false };
}
