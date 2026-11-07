import { createBackup } from './fullBackupService';
import { sendEmailWithAttachments } from '../email/gmailService';
import BackupRun from '../../db/models/BackupRun';
import logger from '../../utils/logger';
import { generateId } from '../../utils/generateId';

// Backup email configuration
const BACKUP_EMAIL_RECIPIENT = process.env.BACKUP_EMAIL_RECIPIENT || 'titoantifa69@gmail.com';
const BACKUP_EMAIL_ENABLED = process.env.BACKUP_EMAIL_ENABLED === 'true';

export interface BackupResult {
  success: boolean;
  wordsCount: number;
  expressionsCount: number;
  emailSent: boolean;
  messageId?: string;
  error?: string;
  timestamp: string;
  duration: number;
}

/** Keeps the history for the admin panel. A failure here must never fail the backup. */
const recordRun = (result: BackupResult) =>
  BackupRun.create({
    success: result.success,
    wordsCount: result.wordsCount,
    expressionsCount: result.expressionsCount,
    error: result.error,
  }).catch((error) => logger.error('Could not record backup run', { error }));

// Generate backup files and send by email
export const sendBackupByEmail = async (): Promise<BackupResult> => {
  const result = await runBackup();
  await recordRun(result);
  return result;
};

const runBackup = async (): Promise<BackupResult> => {
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

    // 1. Generate the backup
    const { filename, buffer, wordsCount, expressionsCount, summary } = await createBackup();

    logger.info('Backup generated', { operationId, filename, bytes: buffer.length, summary });

    // 2. Prepare the email
    const emailSubject = `🔒 Backup Diario - Glota [${new Date().toLocaleDateString('es-ES')}]`;
    const emailText = `Backup completado.

📊 Resumen:
- Diccionario: ${summary.dictionary}
- Expresiones: ${summary.expressions}
- Historias: ${summary.stories}
- Lecciones: ${summary.lessons}
- Progreso: ${summary.progress}

📎 ${filename}

Se restaura en Admin, Importar y exportar. Imágenes y audios no van en el archivo.`;

    const attachments = [{ filename, content: buffer, contentType: 'application/gzip' }];

    // 3. Send email
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
      wordsCount,
      expressionsCount,
      recipient: BACKUP_EMAIL_RECIPIENT,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });

    return {
      success: true,
      wordsCount,
      expressionsCount,
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
      emailSent: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      duration
    };
  }
};
