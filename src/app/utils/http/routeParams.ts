import { Request } from "express";

/**
 * Express 5 types route params as `string | string[]` (to cover wildcard
 * segments). None of our routes use wildcards, so every param is a string.
 */
export const routeParams = (req: Request): Record<string, string> =>
  req.params as Record<string, string>;
