import Word from "../../db/models/Word";
import Expression from "../../db/models/Expression";
import Lesson from "../../db/models/Lesson";
import LessonAttempt from "../../db/models/LessonAttempt";
import Story from "../../db/models/Story";
import BackupRun from "../../db/models/BackupRun";
import { getCronStatus } from "../backup/backupSchedulerService";
import logger from "../../utils/logger";

export class LabsService {
  /** Everything the admin panel shows about backups. */
  async getBackupStatus() {
    const [byLanguage, expressionsTotal, runs] = await Promise.all([
      Word.aggregate([
        { $group: { _id: "$language", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $project: { _id: 0, language: "$_id", count: 1 } },
      ]),
      Expression.countDocuments(),
      BackupRun.find().sort({ createdAt: -1 }).limit(10).lean(),
    ]);
    const cron = getCronStatus();

    return {
      words: {
        total: byLanguage.reduce((sum, l) => sum + l.count, 0),
        byLanguage,
      },
      expressions: { total: expressionsTotal },
      automatic: {
        active: cron.isActive,
        nextRun: cron.nextRun,
        timezone: cron.timezone,
      },
      recipient: process.env.BACKUP_EMAIL_RECIPIENT ?? null,
      runs: runs.map((r) => ({
        _id: r._id,
        success: r.success,
        wordsCount: r.wordsCount,
        expressionsCount: r.expressionsCount,
        error: r.error,
        createdAt: r.createdAt,
      })),
    };
  }

  /**
   * Delete all words from the database
   * ⚠️ DANGEROUS OPERATION - Cannot be undone
   */
  async deleteAllWords(): Promise<{ deletedCount: number; timestamp: Date }> {
    try {
      logger.warn("⚠️ INITIATING: Delete all words operation");
      
      const result = await Word.deleteMany({});
      const timestamp = new Date();
      
      logger.warn("⚠️ COMPLETED: All words deleted", {
        deletedCount: result.deletedCount,
        timestamp: timestamp.toISOString()
      });
      
      return {
        deletedCount: result.deletedCount || 0,
        timestamp
      };
    } catch (error) {
      logger.error("❌ Error deleting all words:", error);
      throw error;
    }
  }

  /**
   * Delete all expressions from the database
   * ⚠️ DANGEROUS OPERATION - Cannot be undone
   */
  async deleteAllExpressions(): Promise<{ deletedCount: number; timestamp: Date }> {
    try {
      logger.warn("⚠️ INITIATING: Delete all expressions operation");
      
      const result = await Expression.deleteMany({});
      const timestamp = new Date();
      
      logger.warn("⚠️ COMPLETED: All expressions deleted", {
        deletedCount: result.deletedCount,
        timestamp: timestamp.toISOString()
      });
      
      return {
        deletedCount: result.deletedCount || 0,
        timestamp
      };
    } catch (error) {
      logger.error("❌ Error deleting all expressions:", error);
      throw error;
    }
  }

  /**
   * Delete all stories from the database
   * ⚠️ DANGEROUS OPERATION - Cannot be undone
   */
  async deleteAllStories(): Promise<{ deletedCount: number; timestamp: Date }> {
    try {
      logger.warn("⚠️ INITIATING: Delete all stories operation");

      const result = await Story.deleteMany({});
      const timestamp = new Date();

      logger.warn("⚠️ COMPLETED: All stories deleted", {
        deletedCount: result.deletedCount,
        timestamp: timestamp.toISOString()
      });

      return {
        deletedCount: result.deletedCount || 0,
        timestamp
      };
    } catch (error) {
      logger.error("❌ Error deleting all stories:", error);
      throw error;
    }
  }

  /**
   * Delete all lessons and their attempts from the database
   * ⚠️ DANGEROUS OPERATION - Cannot be undone
   */
  async deleteAllLessons(): Promise<{ deletedCount: number; deletedAttempts: number; timestamp: Date }> {
    try {
      logger.warn("⚠️ INITIATING: Delete all lessons operation");

      const [lessonsResult, attemptsResult] = await Promise.all([
        Lesson.deleteMany({}),
        LessonAttempt.deleteMany({}),
      ]);
      const timestamp = new Date();

      logger.warn("⚠️ COMPLETED: All lessons and attempts deleted", {
        deletedCount: lessonsResult.deletedCount,
        deletedAttempts: attemptsResult.deletedCount,
        timestamp: timestamp.toISOString(),
      });

      return {
        deletedCount: lessonsResult.deletedCount || 0,
        deletedAttempts: attemptsResult.deletedCount || 0,
        timestamp,
      };
    } catch (error) {
      logger.error("❌ Error deleting all lessons:", error);
      throw error;
    }
  }
}
