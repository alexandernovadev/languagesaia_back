// ─── Auth ────────────────────────────────────────────────────────────────────
export const JWT_EXPIRES_IN = "7d";
export const REFRESH_TOKEN_EXPIRES_IN = "30d";

// ─── Rate limiting ────────────────────────────────────────────────────────────
export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const RATE_LIMIT_GENERAL_MAX = 300;
export const RATE_LIMIT_AUTH_MAX = 10;
export const RATE_LIMIT_AI_WINDOW_MS = 60 * 1000; // 1 minute
export const RATE_LIMIT_AI_MAX = 20;

// ─── Timeouts ─────────────────────────────────────────────────────────────────
export const SERVER_TIMEOUT_MS = 30_000;     // General socket timeout
// Extended timeout for AI routes. Must stay above TEXT_AI.primaryTimeoutMsFull + TEXT_AI.timeoutMs
// (main model + backup = 135 s), plus room for the picture in image routes.
export const AI_REQUEST_TIMEOUT_MS = 180_000;

// ─── File uploads ─────────────────────────────────────────────────────────────
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_IMPORT_ITEMS = 5_000;

// ─── Pagination ───────────────────────────────────────────────────────────────
export const MAX_PAGINATION_LIMIT = 100;

// ─── Review ───────────────────────────────────────────────────────────────────
export const MAX_NEW_CARDS_PER_DAY = 20;
export const MAX_INTERVAL_DAYS = 180;

// Longest example or expression sent to the voice model
export const MAX_SPEECH_TEXT_LENGTH = 300;

// XP and streak
export const DAILY_XP_GOAL = 50;
export const REVIEW_XP = 2;
export const NEW_CARD_BONUS_XP = 1;
export const ADD_WORD_XP = 5;
export const LEVEL_XP_STEP = 25;
export const MAX_STREAK_FREEZES = 2;
export const FREEZE_EVERY_DAYS = 7;

// ─── Chat ─────────────────────────────────────────────────────────────────────
export const MAX_CHAT_MESSAGES = 100; // Max messages kept per word/expression

// ─── MongoDB connection ───────────────────────────────────────────────────────
export const MONGO_RECONNECTION_DELAY_MS = 5_000;
export const MONGO_SERVER_SELECTION_TIMEOUT_MS = 10_000;
export const MONGO_SOCKET_TIMEOUT_MS = 45_000;
export const MONGO_HEARTBEAT_FREQUENCY_MS = 10_000;
