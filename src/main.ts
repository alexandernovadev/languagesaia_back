import express, { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import {
  SERVER_TIMEOUT_MS, AI_REQUEST_TIMEOUT_MS,
} from "./config/constants";
import { generalLimiter, authLimiter } from "./app/middlewares/rateLimiters";

import { connectDB, disconnectDB } from "./app/db/mongoConnection";
import { initializeBackupScheduler } from "./app/services/backup/backupSchedulerService";
import logger from "./app/utils/logger";

// Routes
import LectureRoutes from "./app/routes/lectureRoutes";
import WordsRoutes from "./app/routes/wordsRoutes";
import ExpressionRoutes from "./app/routes/expressionRoutes";
import LabsRoutes from "./app/routes/labsRoutes";
import UploadRoutes from "./app/routes/uploadRoutes";
import AuthRoutes from "./app/routes/authRoutes";
import UserRoutes from "./app/routes/userRoutes";
import StatsRoutes from "./app/routes/statsRoutes";
import ExamRoutes from "./app/routes/examRoutes";
import AIConfigRoutes from "./app/routes/aiConfigRoutes";

// Utils
import { errorResponse, successResponse } from "./app/utils/responseHelpers";
import { requestLogger } from "./app/utils/requestLogger";
import { authMiddleware } from "./app/middlewares/authMiddleware";

// Import package.json for version
import packageJson from "../package.json";

dotenv.config();

const app = express();
const NODE_ENV = process.env.NODE_ENV || "development";
const PORT = process.env.PORT || 3000;
const VERSION = `v${packageJson.version}-${NODE_ENV}`;
const LABS_AUTH = (process.env.LABS_AUTH || "true").toLowerCase() === "true";
const CORS_ORIGINS = (process.env.CORS_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

// Behind nginx / load balancer / PaaS: Express must trust X-Forwarded-* so req.ip and
// express-rate-limit work (avoids ERR_ERL_UNEXPECTED_X_FORWARDED_FOR). TRUST_PROXY=false if no proxy.
const trustProxyEnv = process.env.TRUST_PROXY;
if (trustProxyEnv === "false" || trustProxyEnv === "0") {
  // direct exposure, tests
} else if (trustProxyEnv === "true" || trustProxyEnv === "1") {
  app.set("trust proxy", 1);
} else if (trustProxyEnv && /^\d+$/.test(trustProxyEnv)) {
  app.set("trust proxy", parseInt(trustProxyEnv, 10));
} else if (NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// Security headers
app.use(helmet());

// Rate limiting — generalLimiter covers everything; aiLimiter is applied
// per-route (in each router) only to endpoints that actually call an AI provider.
app.use(generalLimiter);

// Middleware to parse JSON
app.use(express.json());

// Middleware to handle CORS
app.use(
  cors({
    origin: CORS_ORIGINS,
    credentials: true,
  })
);

// Middleware to log requests
app.use(requestLogger);

// Static files
const publicPath = path.join(__dirname, "..", "public");
app.use("/audios", express.static(path.join(publicPath, "audios")));
app.use("/images", express.static(path.join(publicPath, "images")));

// Extends the socket timeout for routes that call OpenAI (streaming, image gen)
const extendTimeout = (_req: Request, res: Response, next: NextFunction) => {
  res.setTimeout(AI_REQUEST_TIMEOUT_MS, () => {
    errorResponse(res, "Request timed out", 408);
  });
  next();
};

// Routes
app.use("/api/auth", authLimiter, AuthRoutes);
app.use("/api/lectures", authMiddleware, extendTimeout, LectureRoutes);
app.use("/api/words", authMiddleware, extendTimeout, WordsRoutes);
app.use("/api/expressions", authMiddleware, extendTimeout, ExpressionRoutes);
app.use("/api/users", authMiddleware, UserRoutes);
app.use("/api/stats", authMiddleware, StatsRoutes);
app.use("/api/exams", authMiddleware, extendTimeout, ExamRoutes);
app.use("/api/ai-config", authMiddleware, AIConfigRoutes);

// Labs routes (conditional auth)
if (LABS_AUTH) {
  app.use("/api/labs", authMiddleware, LabsRoutes);
} else {
  app.use("/api/labs", LabsRoutes);
}

// Upload routes (must be after labs to avoid conflict)
app.use("/api", authMiddleware, UploadRoutes);

app.get("/", (req: Request, res: Response) => {
  successResponse(res, "Server is running", {
    date: new Date().toISOString(),
    version: VERSION,
    environment: NODE_ENV,
  });
});

// Error-handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction): void => {
  errorResponse(res, "Internal server error", 500, err);
});

let server: ReturnType<typeof app.listen>;

async function shutdown(signal: string) {
  logger.info(`${signal} received, starting graceful shutdown...`);

  // Stop accepting new connections; wait for in-flight requests to finish
  server.close(async () => {
    logger.info("HTTP server closed");
    await disconnectDB();
    logger.info("Graceful shutdown complete");
    process.exit(0);
  });

  // Force-kill if shutdown takes too long (10 s)
  setTimeout(() => {
    logger.error("Graceful shutdown timed out, forcing exit");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));

async function init() {
  try {
    await connectDB();
    logger.info("Connection to MongoDB established successfully");

    server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT} - "${NODE_ENV}"`);
      logger.info(`Express trust proxy: ${JSON.stringify(app.get("trust proxy"))}`);

      // Initialize backup cron scheduler
      try {
        initializeBackupScheduler();
        logger.info("Backup cron scheduler initialized");
      } catch (error) {
        logger.error("Failed to initialize backup cron scheduler", { error });
      }
    });

    // Default socket timeout: 30s. AI/upload routes override this to 120s
    // via the extendTimeout middleware applied on their routers.
    server.setTimeout(SERVER_TIMEOUT_MS);
  } catch (error) {
    logger.error("Error connecting to MongoDB", { error });
    process.exit(1);
  }
}

init();
