import Expression from "../../db/models/Expression";
import { IExpression } from "../../../../types/models";
import { escapeRegex } from "../../utils/escapeRegex";
import { parseLimit } from "../../utils/pagination";

interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pages: number;
}

export class ExpressionService {
  async createExpression(expressionData: IExpression): Promise<IExpression> {
    const expression = new Expression(expressionData);
    return await expression.save();
  }

  async getExpressionById(id: string): Promise<IExpression | null> {
    return await Expression.findById(id);
  }

  async getExpressions(filters: any = {}): Promise<PaginatedResult<IExpression>> {
    const page = parseInt(filters.page) || 1;
    const limit = parseLimit(filters.limit, 10);
    const skip = (page - 1) * limit;

    const filter: any = {};

    if (filters.search) {
      const escapedSearch = escapeRegex(filters.search);
      filter.$or = [
        { expression: { $regex: escapedSearch, $options: "i" } },
        { definition: { $regex: escapedSearch, $options: "i" } },
        { "spanish.expression": { $regex: escapedSearch, $options: "i" } },
        { "spanish.definition": { $regex: escapedSearch, $options: "i" } },
      ];
    }

    if (filters.type && filters.type.length > 0) {
      filter.type = { $in: Array.isArray(filters.type) ? filters.type : [filters.type] };
    }

    if (filters.difficulty) filter.difficulty = filters.difficulty;
    if (filters.language) filter.language = filters.language;

    if (filters.hasImage === "true") {
      filter.img = { $ne: null };
    } else if (filters.hasImage === "false") {
      filter.img = null;
    }

    if (filters.hasContext === "true") {
      filter.context = { $exists: true, $ne: null, $nin: ["", null] };
    } else if (filters.hasContext === "false") {
      filter.$or = filter.$or || [];
      filter.$or.push({ context: { $exists: false } }, { context: null }, { context: "" });
    }

    if (filters.createdAt) {
      if (!filter.createdAt) filter.createdAt = {};
      filter.createdAt.$gte = new Date(filters.createdAt);
    }

    if (filters.updatedAt) {
      if (!filter.updatedAt) filter.updatedAt = {};
      filter.updatedAt.$gte = new Date(filters.updatedAt);
    }

    const total = await Expression.countDocuments(filter);
    const data = await Expression.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit);

    return { data, total, page, pages: Math.ceil(total / limit) };
  }

  async updateExpression(id: string, updateData: Partial<IExpression>): Promise<IExpression | null> {
    return await Expression.findByIdAndUpdate(id, updateData, { new: true });
  }

  async updateExpressionImg(
    id: string,
    img: string
  ): Promise<{ _id: string; img?: string; updatedAt: Date } | null> {
    return await Expression.findByIdAndUpdate(
      id,
      { img },
      { new: true, projection: { _id: 1, img: 1, updatedAt: 1 } }
    );
  }

  async deleteExpression(id: string): Promise<IExpression | null> {
    return await Expression.findByIdAndDelete(id);
  }

  /** The same expression in that language, ignoring case and extra spaces. */
  async findSaved(expression: string, language: string): Promise<IExpression | null> {
    const text = expression.trim().replace(/\s+/g, " ");
    if (!text) return null;
    const filter: any = { language, expression: new RegExp(`^\\s*${escapeRegex(text).replace(/ /g, "\\s+")}\\s*$`, "i") };
    return await Expression.findOne(filter);
  }

  async findExpressionByExpression(expression: string): Promise<IExpression | null> {
    return await Expression.findOne({ expression });
  }

  async getExpressionsByType(type: string, limit: number = 10, search?: string): Promise<IExpression[]> {
    const filter: any = { type: { $in: [type] } };
    if (search) {
      const escapedSearch = escapeRegex(search);
      filter.$or = [
        { expression: { $regex: escapedSearch, $options: "i" } },
        { definition: { $regex: escapedSearch, $options: "i" } },
      ];
    }
    return await Expression.find(filter).limit(limit);
  }

  async getExpressionsOnly(filters: any = {}): Promise<PaginatedResult<{ expression: string }>> {
    const page = parseInt(filters.page) || 1;
    const limit = parseLimit(filters.limit, 10);
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (filters.search) {
      filter.expression = { $regex: escapeRegex(filters.search), $options: "i" };
    }

    const total = await Expression.countDocuments(filter);
    const data = await Expression.find(filter, { expression: 1 })
      .sort({ expression: 1 })
      .skip(skip)
      .limit(limit);

    return {
      data: data.map((doc) => ({ expression: doc.expression })),
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }
}

export default new ExpressionService();
