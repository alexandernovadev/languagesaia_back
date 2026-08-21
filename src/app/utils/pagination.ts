import { MAX_PAGINATION_LIMIT } from "../../config/constants";

/**
 * Parses a raw pagination limit value (from query params or filter objects),
 * enforcing a minimum of 1 and a hard cap of MAX_PAGINATION_LIMIT to prevent
 * DoS via memory exhaustion.
 */
export function parseLimit(raw: unknown, defaultValue: number): number {
  const parsed = parseInt(raw as string);
  const value = isNaN(parsed) ? defaultValue : parsed;
  return Math.min(Math.max(value, 1), MAX_PAGINATION_LIMIT);
}

/**
 * Parses a comma-separated query param into an array, passing through
 * arrays and single values unchanged. Used by list endpoints that accept
 * repeatable filters (e.g. `?genre=fantasy,mystery`).
 */
export function parseArrayParam(
  param: string | string[] | undefined
): string | string[] | undefined {
  if (!param) return undefined;
  if (Array.isArray(param)) return param;
  if (typeof param === "string" && param.includes(",")) {
    return param.split(",").map((v) => v.trim()).filter(Boolean);
  }
  return param;
}
