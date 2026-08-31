import Word from "../../db/models/Word";
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

  async getWords(
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
  ): Promise<PaginatedResult<IWord>> {
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

    const total = await Word.countDocuments(filter);
    const pages = Math.ceil(total / limit);

    const sortDirection = sortOrder === "asc" ? 1 : -1;
    const sortOptions: Record<string, 1 | -1> = {};
    sortOptions[sortBy] = sortDirection as 1 | -1;

    const data = await Word.find(filter)
      .sort(sortOptions)
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();

    return { data, total, page, pages };
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

  async updateWordDifficulty(id: string, difficulty: string): Promise<{ difficulty?: string } | null> {
    return await Word.findByIdAndUpdate(id, { difficulty }, { new: true, projection: { difficulty: 1 } });
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

  async incrementWordSeen(id: string): Promise<{ seen?: number } | null> {
    return await Word.findByIdAndUpdate(id, { $inc: { seen: 1 } }, { new: true, projection: { seen: 1 } });
  }

  async deleteWord(id: string): Promise<IWord | null> {
    return await Word.findByIdAndDelete(id);
  }

  async findWordByWord(word: string, language?: string): Promise<IWord | null> {
    const query: Record<string, unknown> = { wordKey: normalizeWordKey(word) };
    if (language) query.language = language;
    return await Word.findOne(query);
  }

  async updateWordReview(wordId: string, difficulty: number): Promise<IWord | null> {
    const word = await Word.findById(wordId);
    if (!word) return null;

    const updateData = {
      difficulty: difficulty === 1 ? "easy" : difficulty === 2 ? "medium" : "hard",
      seen: (word.seen || 0) + 1,
    };

    return await Word.findByIdAndUpdate(wordId, updateData, { new: true });
  }
}

export default new WordService();
