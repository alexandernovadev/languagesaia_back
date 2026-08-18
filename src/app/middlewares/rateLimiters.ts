import rateLimit from "express-rate-limit";
import {
  RATE_LIMIT_WINDOW_MS, RATE_LIMIT_GENERAL_MAX, RATE_LIMIT_AUTH_MAX,
  RATE_LIMIT_AI_WINDOW_MS, RATE_LIMIT_AI_MAX,
} from "../../config/constants";

export const generalLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_GENERAL_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests, please try again later" },
});

export const authLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_AUTH_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many login attempts, please try again later" },
});

// Only for routes that actually call an AI provider — CRUD/listing routes
// must not share this budget, or normal browsing exhausts it.
export const aiLimiter = rateLimit({
  windowMs: RATE_LIMIT_AI_WINDOW_MS,
  max: RATE_LIMIT_AI_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "AI request limit reached, please slow down" },
});
