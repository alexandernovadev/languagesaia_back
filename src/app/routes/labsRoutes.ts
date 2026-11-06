import { Router } from "express";
import {
  createAdminUser,
  getBackupStatusHandler,
  getSystemInfoHandler,
  sendBackupByEmailHandler,
  deleteAllExercises,
  deleteAllWords,
  getDataCountsHandler,
  deleteAllExpressions,
  deleteAllLessons,
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
routes.get("/data/counts", getDataCountsHandler);
routes.delete("/data/words/delete-all", deleteAllWords);
routes.delete("/data/exercises/delete-all", deleteAllExercises);
routes.delete("/data/expressions/delete-all", deleteAllExpressions);
routes.delete("/data/lessons/delete-all", deleteAllLessons);
routes.delete("/data/stories/delete-all", deleteAllStories);

export default routes;