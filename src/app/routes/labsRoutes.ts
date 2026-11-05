import { Router } from "express";
import {
  createAdminUser,
  getBackupStatusHandler,
  getSystemInfoHandler,
  sendBackupByEmailHandler,
  deleteAllWords,
  deleteAllExpressions,
  deleteAllExams,
  deleteAllStories,
} from "../controllers/labsController";

const routes = Router();

// User management
routes.post("/users/create-admin", createAdminUser);

// System
routes.get("/system", getSystemInfoHandler);

// Backup and maintenance
routes.get("/backup/status", getBackupStatusHandler);
routes.post("/backup/send-email", sendBackupByEmailHandler);

// Data Management - Dangerous Operations ⚠️
routes.delete("/data/words/delete-all", deleteAllWords);
routes.delete("/data/expressions/delete-all", deleteAllExpressions);
routes.delete("/data/exams/delete-all", deleteAllExams);
routes.delete("/data/stories/delete-all", deleteAllStories);

export default routes;