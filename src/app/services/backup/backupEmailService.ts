import { WordExportService } from '../words/WordExportService';
import { ExpressionImportExportService } from '../expressions/ExpressionImportExportService';
import { ExamExportService } from '../exams/ExamExportService';
import { sendEmailWithAttachments } from '../email/gmailService';
import logger from '../../utils/logger';
import { generateId } from '../../utils/generateId';

const wordService = new WordExportService();
const expressionService = new ExpressionImportExportService();
const examService = new ExamExportService();

// Backup email configuration
const BACKUP_EMAIL_RECIPIENT = process.env.BACKUP_EMAIL_RECIPIENT || 'titoantifa69@gmail.com';
const BACKUP_EMAIL_ENABLED = process.env.BACKUP_EMAIL_ENABLED === 'true';

export interface BackupResult {
  success: boolean;
  wordsCount: number;
  expressionsCount: number;
  examsCount: number;
  emailSent: boolean;
  messageId?: string;
  error?: string;
  timestamp: string;
  duration: number;
}

// Generate backup files and send by email
export const sendBackupByEmail = async (): Promise<BackupResult> => {
  const operationId = generateId();
  const startTime = Date.now();

  try {
    logger.info('Starting backup email process', {
      operationId,
      recipient: BACKUP_EMAIL_RECIPIENT,
      enabled: BACKUP_EMAIL_ENABLED,
      timestamp: new Date().toISOString()
    });

    if (!BACKUP_EMAIL_ENABLED) {
      throw new Error('Backup email service is disabled');
    }

    // 1. Generate backup data
    logger.info('Generating backup data', { operationId });

    const [words, expressions, exams] = await Promise.all([
      wordService.getAllWordsForExport(),
      expressionService.getAllExpressionsForExport(),
      examService.getAllExamsForExport(),
    ]);

    logger.info('Backup data generated', {
      operationId,
      wordsCount: words.length,
      expressionsCount: expressions.length,
      examsCount: exams.length,
    });

    // 2. Create backup files with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const wordsFilename = `words-backup-${timestamp}.json`;
    const expressionsFilename = `expressions-backup-${timestamp}.json`;
    const examsFilename = `exams-backup-${timestamp}.json`;

    // 3. Prepare email content
    const emailSubject = `🔒 Backup Diario - LanguageAI [${new Date().toLocaleDateString('es-ES')}]`;
    const emailText = `Backup completado exitosamente.

📊 Resumen:
- Words: ${words.length} registros
- Expressions: ${expressions.length} registros
- Exams: ${exams.length} registros
- Fecha: ${new Date().toLocaleDateString('es-ES')}
- Hora: ${new Date().toLocaleTimeString('es-ES')}

📎 Archivos adjuntos:
- ${wordsFilename}
- ${expressionsFilename}
- ${examsFilename}

Este backup se genera automáticamente todos los días.`;

    // 4. Prepare attachments with same structure as exports
    const attachments = [
      {
        filename: wordsFilename,
        content: JSON.stringify({
          success: true,
          message: `Backup generated ${words.length} words successfully`,
          data: {
            totalWords: words.length,
            exportDate: new Date().toISOString(),
            words: words
          }
        }, null, 2),
        contentType: 'application/json'
      },
      {
        filename: expressionsFilename,
        content: JSON.stringify({
          success: true,
          message: `Backup generated ${expressions.length} expressions successfully`,
          data: {
            totalExpressions: expressions.length,
            exportDate: new Date().toISOString(),
            expressions: expressions
          }
        }, null, 2),
        contentType: 'application/json'
      },
      {
        filename: examsFilename,
        content: JSON.stringify({
          success: true,
          message: `Backup generated ${exams.length} exams successfully`,
          data: {
            totalExams: exams.length,
            exportDate: new Date().toISOString(),
            exams: exams
          }
        }, null, 2),
        contentType: 'application/json'
      }
    ];

    // 5. Send email
    logger.info('Sending backup email', {
      operationId,
      recipient: BACKUP_EMAIL_RECIPIENT,
      subject: emailSubject,
      attachmentsCount: attachments.length,
      attachments: attachments.map(a => a.filename)
    });

    const emailSent = await sendEmailWithAttachments(
      BACKUP_EMAIL_RECIPIENT,
      emailSubject,
      emailText,
      attachments
    );

    if (!emailSent) {
      throw new Error('Failed to send backup email');
    }

    const duration = Date.now() - startTime;

    logger.info('Backup email sent successfully', {
      operationId,
      wordsCount: words.length,
      expressionsCount: expressions.length,
      examsCount: exams.length,
      recipient: BACKUP_EMAIL_RECIPIENT,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });

    return {
      success: true,
      wordsCount: words.length,
      expressionsCount: expressions.length,
      examsCount: exams.length,
      emailSent: true,
      timestamp: new Date().toISOString(),
      duration
    };

  } catch (error: any) {
    const duration = Date.now() - startTime;

    logger.error('Backup email process failed', {
      operationId,
      error: {
        message: error.message,
        stack: error.stack
      },
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });

    return {
      success: false,
      wordsCount: 0,
      expressionsCount: 0,
      examsCount: 0,
      emailSent: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      duration
    };
  }
};

    // Test backup service
    export const testBackupService = async (): Promise<boolean> => {
      try {
        logger.info('Testing backup service...');

        // Test data generation
        const [words, expressions, exams] = await Promise.all([
          wordService.getAllWordsForExport(),
          expressionService.getAllExpressionsForExport(),
          examService.getAllExamsForExport(),
        ]);

        logger.info('Backup service test successful', {
          wordsCount: words.length,
          expressionsCount: expressions.length,
          examsCount: exams.length,
        });

        return true;
      } catch (error: any) {
        logger.error('Backup service test failed', {
          error: error.message,
          stack: error.stack
        });
        return false;
      }
    };

export default {
  sendBackupByEmail,
  testBackupService
};
