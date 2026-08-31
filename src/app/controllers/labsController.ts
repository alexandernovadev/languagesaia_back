import { Request, Response } from "express";
import { errorResponse, successResponse } from "../utils/responseHelpers";
import { seedAdminUser } from "../services/seed/user";
import { sendBackupByEmail } from "../services/backup/backupEmailService";
import { LabsService } from "../services/labs/labsService";
import logger from "../utils/logger";
import Word from "../db/models/Word";

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
 * Backup & Maintenance:
 * - POST /api/labs/backup/send-email - Send backup by email
 * 
 * Data Management (DANGEROUS):
 * - DELETE /api/labs/data/words/delete-all - Delete all words
 * - DELETE /api/labs/data/expressions/delete-all - Delete all expressions
 * - DELETE /api/labs/data/lectures/delete-all - Delete all lectures
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
 * One-time migration: rename field "sinonyms" → "synonyms" on all Word documents
 */
export const migrateSinonymsToSynonyms = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const result = await (Word as any).updateMany(
      { sinonyms: { $exists: true } },
      { $rename: { sinonyms: "synonyms" } }
    );
    logger.info("Migration sinonyms→synonyms completed", { modifiedCount: result.modifiedCount });
    return successResponse(res, "Migration completed", { modifiedCount: result.modifiedCount });
  } catch (error) {
    logger.error("Migration sinonyms→synonyms failed", { error });
    return errorResponse(res, "Migration failed", 500, error);
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
 * Delete all lectures from the database
 * ⚠️ DANGEROUS OPERATION - Cannot be undone
 */
export const deleteAllLectures = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const result = await labsService.deleteAllLectures();
    
    return successResponse(
      res,
      `Successfully deleted all lectures`,
      {
        deletedCount: result.deletedCount,
        timestamp: result.timestamp
      }
    );
  } catch (error) {
    logger.error("Error in deleteAllLectures controller:", error);
    return errorResponse(res, "Error deleting all lectures", 500, error);
  }
};