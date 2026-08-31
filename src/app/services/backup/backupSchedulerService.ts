import * as cron from 'node-cron';
import { sendBackupByEmail } from './backupEmailService';
import logger from '../../utils/logger';
import { generateId } from '../../utils/generateId';

// Cron configuration
const BACKUP_CRON_SCHEDULE = process.env.BACKUP_CRON_SCHEDULE || '0 30 23 * * *'; // 11:30 PM daily
const BACKUP_EMAIL_ENABLED = process.env.BACKUP_EMAIL_ENABLED === 'true';

// Cron job instance
let backupCronJob: cron.ScheduledTask | null = null;
let isCronActive = false;
let lastRunTime: Date | null = null;
let nextRunTime: Date | null = null;
let totalRuns = 0;
let successfulRuns = 0;
let failedRuns = 0;

// Initialize cron scheduler
export const initializeBackupScheduler = (): void => {
  if (!BACKUP_EMAIL_ENABLED) {
    logger.warn('Backup email service is disabled, cron will not start');
    return;
  }

  try {
    // Stop existing cron if running
    if (backupCronJob) {
      backupCronJob.stop();
      backupCronJob.destroy();
    }

    // Create new cron job
    backupCronJob = cron.schedule(BACKUP_CRON_SCHEDULE, async () => {
      await executeScheduledBackup();
    }, {
      timezone: process.env.BACKUP_TIMEZONE || 'America/New_York'
    });

    // Start the cron job
    backupCronJob.start();
    isCronActive = true;
    
    logger.info('Backup cron scheduler initialized successfully', {
      schedule: BACKUP_CRON_SCHEDULE,
      timezone: process.env.BACKUP_TIMEZONE || 'America/New_York',
      isActive: isCronActive
    });

  } catch (error: any) {
    logger.error('Failed to initialize backup cron scheduler', {
      error: error.message,
      stack: error.stack,
      schedule: BACKUP_CRON_SCHEDULE
    });
    isCronActive = false;
  }
};

// Execute scheduled backup
const executeScheduledBackup = async (): Promise<void> => {
  const operationId = generateId();
  const startTime = Date.now();

  try {
    logger.info('Scheduled backup started', {
      operationId,
      schedule: BACKUP_CRON_SCHEDULE,
      timestamp: new Date().toISOString()
    });

    // Update last run time
    lastRunTime = new Date();
    totalRuns++;

    // Execute backup
    const result = await sendBackupByEmail();

    if (result.success) {
      successfulRuns++;
      logger.info('Scheduled backup completed successfully', {
        operationId,
        wordsCount: result.wordsCount,
        expressionsCount: result.expressionsCount,
        duration: `${Date.now() - startTime}ms`,
        totalRuns,
        successfulRuns,
        failedRuns
      });
    } else {
      failedRuns++;
      logger.error('Scheduled backup failed', {
        operationId,
        error: result.error,
        duration: `${Date.now() - startTime}ms`,
        totalRuns,
        successfulRuns,
        failedRuns
      });
    }

    // Next run time will be calculated automatically by cron

  } catch (error: any) {
    failedRuns++;
    logger.error('Scheduled backup execution failed', {
      operationId,
      error: {
        message: error.message,
        stack: error.stack
      },
      duration: `${Date.now() - startTime}ms`,
      totalRuns,
      successfulRuns,
      failedRuns
    });
  }
};

// Update next run time - not available in node-cron
const updateNextRunTime = (): void => {
  // nextDate() method is not available in node-cron ScheduledTask
  // Cron will handle scheduling automatically
};

// Start cron scheduler
export const startBackupScheduler = (): boolean => {
  try {
    if (!backupCronJob) {
      initializeBackupScheduler();
    } else if (!isCronActive) {
      backupCronJob.start();
      isCronActive = true;
    }

    logger.info('Backup cron scheduler started', {
      isActive: isCronActive,
      nextRun: nextRunTime?.toISOString()
    });

    return isCronActive;
  } catch (error: any) {
    logger.error('Failed to start backup cron scheduler', {
      error: error.message,
      stack: error.stack
    });
    return false;
  }
};

// Stop cron scheduler
export const stopBackupScheduler = (): boolean => {
  try {
    if (backupCronJob && isCronActive) {
      backupCronJob.stop();
      isCronActive = false;
      
      logger.info('Backup cron scheduler stopped', {
        isActive: isCronActive,
        lastRun: lastRunTime?.toISOString()
      });

      return true;
    }
    return false;
  } catch (error: any) {
    logger.error('Failed to stop backup cron scheduler', {
      error: error.message,
      stack: error.stack
    });
    return false;
  }
};

// Get cron status
export const getCronStatus = () => {
  return {
    isActive: isCronActive,
    schedule: BACKUP_CRON_SCHEDULE,
    timezone: process.env.BACKUP_TIMEZONE || 'America/New_York',
    lastRun: lastRunTime?.toISOString(),
    totalRuns,
    successfulRuns,
    failedRuns,
    successRate: totalRuns > 0 ? (successfulRuns / totalRuns * 100).toFixed(2) + '%' : '0%',
    enabled: BACKUP_EMAIL_ENABLED
  };
};

// Test cron without waiting
export const testCronExecution = async (): Promise<boolean> => {
  try {
    logger.info('Testing cron execution...');
    await executeScheduledBackup();
    return true;
  } catch (error: any) {
    logger.error('Cron execution test failed', {
      error: error.message,
      stack: error.stack
    });
    return false;
  }
};

// Update cron schedule
export const updateCronSchedule = (newSchedule: string): boolean => {
  try {
    // Validate cron expression
    if (!cron.validate(newSchedule)) {
      throw new Error('Invalid cron expression');
    }

    // Update environment variable
    process.env.BACKUP_CRON_SCHEDULE = newSchedule;

    // Reinitialize scheduler
    initializeBackupScheduler();

    logger.info('Cron schedule updated successfully', {
      oldSchedule: BACKUP_CRON_SCHEDULE,
      newSchedule,
      isActive: isCronActive
    });

    return true;
  } catch (error: any) {
    logger.error('Failed to update cron schedule', {
      error: error.message,
      schedule: newSchedule
    });
    return false;
  }
};

export default {
  initializeBackupScheduler,
  startBackupScheduler,
  stopBackupScheduler,
  getCronStatus,
  testCronExecution,
  updateCronSchedule
};
