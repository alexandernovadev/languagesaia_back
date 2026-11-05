import Word from "../../db/models/Word";
import { IWord } from "../../../../types/models";
import { escapeRegex } from "../../utils/escapeRegex";
import { filterTypesQueryForLanguage } from "../../data/business/shared/wordTypeCatalog";

export class WordQueryService {
  async getAnkiCards(options: {
    mode?: "random" | "review";
    limit?: number;
    difficulty?: string[];
    language?: string;
    type?: string[];
  } = {}): Promise<IWord[]> {
    const { mode = "random", limit = 30, difficulty = ["hard", "medium"], language, type } = options;

    const matchFilter: Record<string, unknown> = {
      difficulty: { $in: difficulty },
    };
    if (language) {
      matchFilter.language = language;
    }
    if (type && type.length > 0) {
      const typesFiltered = language
        ? filterTypesQueryForLanguage(type, language)
        : type;
      matchFilter.type =
        typesFiltered.length === 0 ? { $in: [] } : { $in: typesFiltered };
    }

    if (mode === "random") {
      return (await Word.aggregate([
        { $match: matchFilter },
        { $addFields: { randomSort: { $rand: {} } } },
        { $sort: { randomSort: 1 } },
        { $limit: limit },
        { $project: { randomSort: 0 } },
      ])) as unknown as IWord[];
    } else {
      // difficulty is text: sorting it directly would be alphabetical, so rank it first
      return (await Word.aggregate([
        { $match: matchFilter },
        { $addFields: { difficultyRank: { $indexOfArray: [["hard", "medium", "easy"], "$difficulty"] } } },
        { $sort: { difficultyRank: 1, seen: 1, createdAt: -1 } },
        { $limit: limit },
        { $project: { difficultyRank: 0 } },
      ])) as unknown as IWord[];
    }
  }

  /** How many words there are per language, for the language switcher. */
  async countByLanguage(): Promise<Array<{ language: string; count: number }>> {
    return Word.aggregate([
      { $group: { _id: "$language", count: { $sum: 1 } } },
      { $project: { _id: 0, language: "$_id", count: 1 } },
    ]);
  }

  async getLastEasyWords(): Promise<IWord[]> {
    return (await Word.find({ difficulty: "easy" })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()) as unknown as IWord[];
  }

  async getWordsByTypeOptimized(
    type: string,
    limit: number = 10,
    search?: string,
    fields?: string
  ): Promise<{ word: string }[]> {
    const query: Record<string, unknown> = { type: { $in: [type] } };

    if (search) {
      query.word = { $regex: escapeRegex(search), $options: "i" };
    }

    const projection = fields ? { word: 1 } : { word: 1, _id: 0 };

    return await Word.find(query)
      .select(projection)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }
}

export default new WordQueryService();
