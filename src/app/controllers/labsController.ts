import { Request, Response } from "express";
import { errorResponse, successResponse } from "../utils/responseHelpers";
import { seedAdminUser } from "../services/seed/user";
import { sendBackupByEmail } from "../services/backup/backupEmailService";
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
 * Delete all exams and their attempts from the database
 * ⚠️ DANGEROUS OPERATION - Cannot be undone
 */
export const deleteAllExams = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const result = await labsService.deleteAllExams();
    return successResponse(
      res,
      "Successfully deleted all exams and attempts",
      {
        deletedCount: result.deletedCount,
        deletedAttempts: result.deletedAttempts,
        timestamp: result.timestamp,
      }
    );
  } catch (error) {
    logger.error("Error in deleteAllExams controller:", error);
    return errorResponse(res, "Error deleting all exams", 500, error);
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