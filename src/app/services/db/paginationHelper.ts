import { Model, FilterQuery } from "mongoose";

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pages: number;
}

/**
 * Runs the count + find round trip shared by every advanced paginated
 * listing (Story, Lecture, ...). Callers stay responsible for building the
 * domain-specific `query`/`sort`/`projection` — this only wraps the DB call.
 */
export async function paginateQuery<T>(
  model: Model<T>,
  query: FilterQuery<T>,
  options: {
    sort?: Record<string, unknown>;
    projection?: Record<string, unknown>;
    skip: number;
    limit: number;
    page: number;
  }
): Promise<PaginatedResult<T>> {
  const { sort = {}, projection, skip, limit, page } = options;

  const [total, data] = await Promise.all([
    model.countDocuments(query),
    model.find(query, projection).sort(sort as any).skip(skip).limit(limit),
  ]);

  return { data, total, page, pages: Math.ceil(total / limit) };
}
