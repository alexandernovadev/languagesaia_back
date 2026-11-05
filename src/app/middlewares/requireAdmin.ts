import { Request, Response, NextFunction } from "express";
import { errorResponse } from "../utils/responseHelpers";

/** Admin-only routes. Goes after authMiddleware, which loads the user from the database. */
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (req.user?.role !== "admin") {
    return errorResponse(res, "Admin access required", 403, `User ${req.user?._id} is not an admin`);
  }
  next();
};
