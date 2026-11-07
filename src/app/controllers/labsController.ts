import { Request, Response } from "express";
import { errorResponse, successResponse } from "../utils/responseHelpers";
import { seedAdminUser } from "../services/seed/user";
import { sendBackupByEmail } from "../services/backup/backupEmailService";
import { BackupFileError, createBackup, importBackup, previewBackup, readBackup } from "../services/backup/fullBackupService";
import { getUserId } from "../utils/http/requestUser";
import { LabsService } from "../services/labs/labsService";
import { getSystemInfo } from "../services/system/systemService";
import logger from "../utils/logger";

const labsService = new LabsService();

/**
 * LABS CONTROLLER - Development & Maintenance Endpoints
 * 
 * This controller provides essential endpoints for development and maintenance.
 * 
 * AVAILABLE ENDPOINTS:
 * 
 * User Management:
 * - POST /api/labs/users/create-admin - Create admin user
 * 
 * System:
 * - GET  /api/labs/system - Server, database, AI and recent errors
 *
 * Backup & Maintenance:
 * - GET  /api/labs/backup/status - Word totals, schedule and recent backups
 * - POST /api/labs/backup/send-email - Send backup by email
 * 
 * Data Management (DANGEROUS):
 * - GET    /api/labs/data/counts - How much of each there is
 * - DELETE /api/labs/data/exercises/delete-all - Empty the exercise bank
 * - DELETE /api/labs/data/words/delete-all - Delete all words
 * - DELETE /api/labs/data/expressions/delete-all - Delete all expressions
 * - DELETE /api/labs/data/stories/delete-all - Delete all stories
 */

/**
 * Create admin user for development
 */
export const createAdminUser = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const seedUser = await seedAdminUser();
    
    return successResponse(
      res, 
      "Admin user created successfully", 
      { user: seedUser }
    );
  } catch (error) {
    return errorResponse(res, "Error creating admin user", 500, error);
  }
};

/**
 * Server, database, AI and recent errors
 */
export const getSystemInfoHandler = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    return successResponse(res, "System info", await getSystemInfo());
  } catch (error) {
    return errorResponse(res, "Error reading system info", 500, error);
  }
};

/**
 * Word totals, schedule and recent backups
 */
export const getBackupStatusHandler = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    return successResponse(res, "Backup status", await labsService.getBackupStatus());
  } catch (error) {
    return errorResponse(res, "Error reading backup status", 500, error);
  }
};

/**
 * Send backup by email
 */
export const sendBackupByEmailHandler = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    logger.info("📧 Iniciando envío de backup por email");
    
    const result = await sendBackupByEmail();
    
    if (!result.success) {
      logger.warn("❌ Error enviando backup por email", {
        error: result.error
      });
      return errorResponse(res, `Error sending backup: ${result.error}`, 500);
    }
    
    logger.info("✅ Backup enviado por email exitosamente", {
      wordsCount: result.wordsCount,
      expressionsCount: result.expressionsCount,
      emailSent: result.emailSent
    });

    return successResponse(
      res,
      "Backup sent by email successfully",
      {
        wordsCount: result.wordsCount,
        expressionsCount: result.expressionsCount,
        emailSent: result.emailSent
      }
    );
  } catch (error) {
    logger.error("❌ Error durante el envío de backup por email", {
      error: error.message,
      stack: error.stack
    });
    return errorResponse(res, "Error sending backup by email", 500, error);
  }
};

/**
 * How much of each kind of data there is
 */
export const getDataCountsHandler = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    return successResponse(res, "Data counts", await labsService.getDataCounts());
  } catch (error) {
    return errorResponse(res, "Error reading data counts", 500, error);
  }
};

/**
 * Empty the exercise bank
 * ⚠️ DANGEROUS OPERATION - Cannot be undone
 */
export const deleteAllExercises = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    return successResponse(res, "Successfully deleted all exercises", await labsService.deleteAllExercises());
  } catch (error) {
    return errorResponse(res, "Error deleting all exercises", 500, error);
  }
};

/**
 * Delete all words from the database
 * ⚠️ DANGEROUS OPERATION - Cannot be undone
 */
export const deleteAllWords = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const result = await labsService.deleteAllWords();
    
    return successResponse(
      res,
      `Successfully deleted all words`,
      {
        deletedCount: result.deletedCount,
        timestamp: result.timestamp
      }
    );
  } catch (error) {
    logger.error("Error in deleteAllWords controller:", error);
    return errorResponse(res, "Error deleting all words", 500, error);
  }
};

/**
 * Delete all expressions from the database
 * ⚠️ DANGEROUS OPERATION - Cannot be undone
 */
export const deleteAllExpressions = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const result = await labsService.deleteAllExpressions();
    
    return successResponse(
      res,
      `Successfully deleted all expressions`,
      {
        deletedCount: result.deletedCount,
        timestamp: result.timestamp
      }
    );
  } catch (error) {
    logger.error("Error in deleteAllExpressions controller:", error);
    return errorResponse(res, "Error deleting all expressions", 500, error);
  }
};

/**
 * Delete all lessons and their attempts from the database
 * ⚠️ DANGEROUS OPERATION - Cannot be undone
 */
export const deleteAllLessons = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const result = await labsService.deleteAllLessons();
    return successResponse(
      res,
      "Successfully deleted all lessons and attempts",
      {
        deletedCount: result.deletedCount,
        deletedAttempts: result.deletedAttempts,
        timestamp: result.timestamp,
      }
    );
  } catch (error) {
    logger.error("Error in deleteAllLessons controller:", error);
    return errorResponse(res, "Error deleting all lessons", 500, error);
  }
};

/**
 * Delete all stories from the database
 * ⚠️ DANGEROUS OPERATION - Cannot be undone
 */
export const deleteAllStories = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const result = await labsService.deleteAllStories();

    return successResponse(
      res,
      `Successfully deleted all stories`,
      {
        deletedCount: result.deletedCount,
        timestamp: result.timestamp
      }
    );
  } catch (error) {
    logger.error("Error in deleteAllStories controller:", error);
    return errorResponse(res, "Error deleting all stories", 500, error);
  }
};

/** The whole backup as a file to download. */
export const downloadBackup = async (req: Request, res: Response) => {
  try {
    const { filename, buffer } = await createBackup();
    res.setHeader("Content-Type", "application/gzip");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (error) {
    return errorResponse(res, "Error creating the backup", 500, error);
  }
};

const withBackupFile = (work: (req: Request, file: Buffer) => Promise<unknown>) => async (req: Request, res: Response) => {
  try {
    if (!req.file) return errorResponse(res, "No file uploaded", 400);
    return successResponse(res, "Backup read", await work(req, req.file.buffer));
  } catch (error) {
    if (error instanceof BackupFileError) return errorResponse(res, error.message, 400);
    return errorResponse(res, "Error reading the backup", 500, error);
  }
};

export const previewBackupFile = withBackupFile((req, file) => previewBackup(readBackup(file), getUserId(req)));

export const importBackupFile = withBackupFile((req, file) =>
  importBackup(readBackup(file), getUserId(req), req.query.strategy === "replace" ? "replace" : "keep")
);
