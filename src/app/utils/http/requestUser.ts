import { Request } from "express";

/**
 * Reads the authenticated user id set by authMiddleware. `_id` and `id` are
 * always the same string there, kept in sync — this is just the one place
 * that reads them instead of every controller repeating the fallback chain.
 */
export function getUserId(req: Request): string {
  return (req.user?._id ?? req.user?.id) as string;
}

/** The browser's time zone: the learner's day decides the goal and the streak. */
export function timeZoneOf(req: Request): string | undefined {
  return req.get("x-time-zone");
}
