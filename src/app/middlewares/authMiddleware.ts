import { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/auth/authService";
import User from "../db/models/User";
import { errorResponse } from "../utils/responseHelpers";
import logger from "../utils/logger";

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        _id?: string;
        [key: string]: any;
      };
    }
  }
}

/**
 * The token only proves who the user is. Everything else (language, etc.) is
 * read from the database, because the copy inside the token goes stale as soon
 * as the user edits their profile.
 *
 * A bad or expired token must answer 401: that's what makes the app refresh it.
 */
export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return errorResponse(res, "Token not provided", 401, "Token not provided in request");
  }

  const token = authHeader.split(" ")[1];

  let userId: string;
  try {
    const decoded = AuthService.verifyToken(token) as any;
    userId = decoded.user._id || decoded.user.id;
  } catch (error) {
    logger.error("Auth middleware - invalid token", { error });
    return errorResponse(res, "Unauthorized access", 401, error);
  }

  try {
    const user = await User.findById(userId).select("-password").lean();
    if (!user) {
      return errorResponse(res, "Unauthorized access", 401, "Token user no longer exists");
    }
    const id = String(user._id);
    req.user = { ...user, id, _id: id };
  } catch (error) {
    return errorResponse(res, "Internal server error", 500, error);
  }

  logger.debug("Auth middleware - user authenticated", { userId });
  next();
};
