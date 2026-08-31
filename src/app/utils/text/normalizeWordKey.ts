/**
 * Normalizes a word for case-insensitive uniqueness and lookup.
 * Used by the Word model (pre-save), word lookup and word import.
 */
export const normalizeWordKey = (word: string): string =>
  (word || "").trim().toLowerCase();
