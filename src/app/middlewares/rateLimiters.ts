import { Request } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import {
  RATE_LIMIT_WINDOW_MS, RATE_LIMIT_GENERAL_MAX, RATE_LIMIT_AUTH_MAX,
  RATE_LIMIT_AI_WINDOW_MS, RATE_LIMIT_AI_MAX,
} from "../../config/constants";
import { AuthService } from "../services/auth/authService";

/**
 * One budget per signed-in user, so the app and a script on the same network
 * don't share it. Only a valid token counts; anything else falls back to the IP.
 */
const userOrIpKey = (req: Request) => {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    try {
      const decoded = AuthService.verifyToken(auth.slice(7)) as any;
      const id = decoded?.user?._id || decoded?.user?.id;
      if (id) return `user:${id}`;
    } catch {
      // bad or expired token: counted by IP
    }
  }
  return ipKeyGenerator(req.ip ?? "");
};

export const generalLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_GENERAL_MAX,
  keyGenerator: userOrIpKey,
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
