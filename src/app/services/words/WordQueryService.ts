import Word from "../../db/models/Word";
import UserWord from "../../db/models/UserWord";
import { joinWord, toObjectId } from "./UserWordService";
import { escapeRegex } from "../../utils/escapeRegex";
import { filterTypesQueryForLanguage } from "../../data/business/shared/wordTypeCatalog";

export class WordQueryService {
  /** Free practice: picks from the learner's list without touching the schedule. */
  async getAnkiCards(
    userId: string,
    options: {
      mode?: "random" | "review";
      limit?: number;
      difficulty?: string[];
      language?: string;
      type?: string[];
    } = {}
  ): Promise<any[]> {
    const { mode = "random", limit = 30, difficulty = ["hard", "medium"], language, type } = options;

    const mine: Record<string, unknown> = { userId: toObjectId(userId), difficulty: { $in: difficulty } };
    if (language) mine.language = language;

    const wordFilter: Record<string, unknown> = {};
    if (type && type.length > 0) {
      wordFilter.type = { $in: language ? filterTypesQueryForLanguage(type, language) : type };
    }

    const order =
      mode === "random"
        ? [{ $addFields: { randomSort: { $rand: {} } } }, { $sort: { randomSort: 1 } }]
        : // difficulty is text: sorting it directly would be alphabetical, so rank it first
          [{ $addFields: { difficultyRank: { $indexOfArray: [["hard", "medium", "easy"], "$difficulty"] } } }, { $sort: { difficultyRank: 1, seen: 1, addedAt: -1 } }];

    return UserWord.aggregate([{ $match: mine }, ...joinWord, { $match: wordFilter }, ...order, { $limit: limit }] as any[]);
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
