import Word from "../../db/models/Word";
import UserWord from "../../db/models/UserWord";
import { joinWord, toObjectId } from "./UserWordService";
import { IWord } from "../../../../types/models";
import { escapeRegex } from "../../utils/escapeRegex";
import { normalizeWordKey } from "../../utils/text/normalizeWordKey";
import {
  validateWordTypesForLanguage,
  WordTypeValidationError,
  filterTypesQueryForLanguage,
} from "../../data/business/shared/wordTypeCatalog";

interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pages: number;
}

export class WordService {
  async createWord(wordData: IWord): Promise<IWord> {
    const lang = wordData.language;
    const check = validateWordTypesForLanguage(wordData.type, lang);
    if (check.ok === false) {
      throw new WordTypeValidationError(check.invalid, lang);
    }
    const word = new Word(wordData);
    return await word.save();
  }

  async getWordById(id: string): Promise<IWord | null> {
    return await Word.findById(id);
  }

  /** The learner's list, with the dictionary's data and their own. */
  async getWords(
    userId: string,
    filters: {
      page?: number;
      limit?: number;
      wordUser?: string;
      difficulty?: string | string[];
      language?: string | string[];
      type?: string | string[];
      seenMin?: number;
      seenMax?: number;
      sortBy?: string;
      sortOrder?: string;
      definition?: string;
      IPA?: string;
      hasImage?: string;
      hasExamples?: string;
      hasSynonyms?: string;
      hasCodeSwitching?: string;
      spanishWord?: string;
      spanishDefinition?: string;
      createdAfter?: string;
      createdBefore?: string;
      updatedAfter?: string;
      updatedBefore?: string;
    } = {}
  ): Promise<PaginatedResult<any>> {
    const {
      page = 1,
      limit = 10,
      wordUser,
      difficulty,
      language,
      type,
      seenMin,
      seenMax,
      sortBy = "createdAt",
      sortOrder = "desc",
      definition,
      IPA,
      hasImage,
      hasExamples,
      hasSynonyms,
      hasCodeSwitching,
      spanishWord,
      spanishDefinition,
      createdAfter,
      createdBefore,
      updatedAfter,
      updatedBefore,
    } = filters;

    const filter: Record<string, unknown> & { $or?: unknown[] } = {};

    const addOrConditions = (conditions: unknown[]) => {
      if (filter.$or && Array.isArray(filter.$or)) {
        (filter.$or as unknown[]).push(...conditions);
      } else {
        filter.$or = conditions;
      }
    };

    if (wordUser) {
      filter.word = { $regex: escapeRegex(wordUser), $options: "i" };
    }

    if (difficulty) {
      if (Array.isArray(difficulty)) {
        const validDifficulties = difficulty.filter((d) =>
          ["easy", "medium", "hard"].includes(d)
        );
        if (validDifficulties.length > 0) {
          filter.difficulty = { $in: validDifficulties };
        }
      } else {
        if (["easy", "medium", "hard"].includes(difficulty)) {
          filter.difficulty = difficulty;
        }
      }
    }

    if (language) {
      if (Array.isArray(language)) {
        filter.language = { $in: language };
      } else {
        filter.language = { $in: [language] };
      }
    }

    if (type) {
      let typeArr = Array.isArray(type) ? type : [type];
      const singleLang =
        language != null
          ? Array.isArray(language)
            ? language.length === 1
              ? language[0]
              : undefined
            : language
          : undefined;
      if (singleLang) {
        typeArr = filterTypesQueryForLanguage(typeArr, singleLang);
      }
      filter.type = typeArr.length === 0 ? { $in: [] } : { $in: typeArr };
    }

    if (seenMin !== undefined || seenMax !== undefined) {
      const seenFilter: Record<string, number> = {};
      if (seenMin !== undefined) seenFilter.$gte = seenMin;
      if (seenMax !== undefined) seenFilter.$lte = seenMax;
      filter.seen = seenFilter;
    }

    if (definition) {
      filter.definition = { $regex: escapeRegex(definition), $options: "i" };
    }

    if (IPA) {
      filter.IPA = { $regex: escapeRegex(IPA), $options: "i" };
    }

    if (hasImage === "true") {
      filter.img = { $exists: true, $nin: [null, ""] };
    } else if (hasImage === "false") {
      addOrConditions([{ img: { $exists: false } }, { img: null }, { img: "" }]);
    }

    if (hasExamples === "true") {
      filter.examples = { $exists: true, $ne: [] };
    } else if (hasExamples === "false") {
      addOrConditions([{ examples: { $exists: false } }, { examples: [] }]);
    }

    if (hasSynonyms === "true") {
      filter.synonyms = { $exists: true, $ne: [] };
    } else if (hasSynonyms === "false") {
      addOrConditions([{ synonyms: { $exists: false } }, { synonyms: [] }]);
    }

    if (hasCodeSwitching === "true") {
      filter.codeSwitching = { $exists: true, $ne: [] };
    } else if (hasCodeSwitching === "false") {
      addOrConditions([{ codeSwitching: { $exists: false } }, { codeSwitching: [] }]);
    }

    if (spanishWord) {
      filter["spanish.word"] = { $regex: escapeRegex(spanishWord), $options: "i" };
    }

    if (spanishDefinition) {
      filter["spanish.definition"] = { $regex: escapeRegex(spanishDefinition), $options: "i" };
    }

    if (createdAfter || createdBefore) {
      const createdAtFilter: Record<string, Date> = {};
      if (createdAfter) createdAtFilter.$gte = new Date(createdAfter);
      if (createdBefore) createdAtFilter.$lte = new Date(createdBefore);
      filter.createdAt = createdAtFilter;
    }

    if (updatedAfter || updatedBefore) {
      const updatedAtFilter: Record<string, Date> = {};
      if (updatedAfter) updatedAtFilter.$gte = new Date(updatedAfter);
      if (updatedBefore) updatedAtFilter.$lte = new Date(updatedBefore);
      filter.updatedAt = updatedAtFilter;
    }

    // difficulty, seen and language are on UserWord; the rest is on the word
    const { difficulty: byDifficulty, seen: bySeen, language: byLanguage, ...wordFilter } = filter;
    const mine: Record<string, unknown> = { userId: toObjectId(userId) };
    if (byDifficulty) mine.difficulty = byDifficulty;
    if (bySeen) mine.seen = bySeen;
    if (byLanguage) mine.language = byLanguage;

    const sortField = sortBy === "createdAt" ? "addedAt" : sortBy;
    const [result] = await UserWord.aggregate([
      { $match: mine },
      ...joinWord,
      { $match: wordFilter },
      { $sort: { [sortField]: sortOrder === "asc" ? 1 : -1 } },
      { $project: { chat: 0 } },
      { $facet: { data: [{ $skip: (page - 1) * limit }, { $limit: limit }], count: [{ $count: "total" }] } },
    ]);

    const total = result.count[0]?.total ?? 0;
    return { data: result.data, total, page, pages: Math.ceil(total / limit) };
  }

  async updateWord(id: string, updateData: Partial<IWord>): Promise<IWord | null> {
    const existing = await Word.findById(id);
    if (!existing) return null;

    const mergedLang =
      updateData.language !== undefined ? updateData.language : existing.language;
    const mergedTypes =
      updateData.type !== undefined ? updateData.type : existing.type ?? [];

    if (updateData.type !== undefined || updateData.language !== undefined) {
      if (mergedTypes.length > 0) {
        const check = validateWordTypesForLanguage(mergedTypes, mergedLang);
        if (check.ok === false) {
          throw new WordTypeValidationError(check.invalid, mergedLang);
        }
      }
    }

    return await Word.findByIdAndUpdate(id, updateData, { new: true });
  }

  async updateWordExamples(id: string, examples: string[]): Promise<{ examples?: string[] } | null> {
    return await Word.findByIdAndUpdate(id, { examples }, { new: true, projection: { examples: 1 } });
  }

  async updateWordCodeSwitching(id: string, codeSwitching: string[]): Promise<{ codeSwitching?: string[] } | null> {
    return await Word.findByIdAndUpdate(id, { codeSwitching }, { new: true, projection: { codeSwitching: 1 } });
  }

  async updateWordSynonyms(id: string, synonyms: string[]): Promise<{ synonyms?: string[] } | null> {
    return await Word.findByIdAndUpdate(id, { synonyms: synonyms }, { new: true, projection: { synonyms: 1 } });
  }

  async updateWordType(id: string, type: string[]): Promise<{ type?: string[] } | null> {
    const word = await Word.findById(id);
    if (!word) return null;
    const check = validateWordTypesForLanguage(type, word.language);
    if (check.ok === false) {
      throw new WordTypeValidationError(check.invalid, word.language);
    }
    return await Word.findByIdAndUpdate(id, { type }, { new: true, projection: { type: 1 } });
  }

  async updateWordImg(id: string, img: string): Promise<{ img?: string } | null> {
    return await Word.findByIdAndUpdate(id, { img }, { new: true, projection: { img: 1 } });
  }

  async findWordByWord(word: string, language?: string): Promise<IWord | null> {
    const query: Record<string, unknown> = { wordKey: normalizeWordKey(word) };
    if (language) query.language = language;
    return await Word.findOne(query);
  }

}

export default new WordService();
