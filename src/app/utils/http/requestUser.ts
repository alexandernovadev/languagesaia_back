import { Request } from "express";

/**
 * Reads the authenticated user id set by authMiddleware. `_id` and `id` are
 * always the same string there, kept in sync — this is just the one place
 * that reads them instead of every controller repeating the fallback chain.
 */
export function getUserId(req: Request): string | null {
  return req.user?._id ?? req.user?.id ?? null;
}
