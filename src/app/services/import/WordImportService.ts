import Word from "../../db/models/Word";
import { IWord } from "../../../../types/models";
import {
  ImportConfig,
  ProcessingResult,
  BatchResult,
  ImportResult,
  ImportFailure,
  ImportPreview,
  MAX_REPORTED_FAILURES,
} from "../../utils/importTypes";
import { WordValidator } from "../../utils/validators/wordValidator";
import { validateWordTypesForLanguage } from "../../data/business/shared/wordTypeCatalog";
import { normalizeWordKey } from "../../utils/text/normalizeWordKey";

export class WordImportService {
  private async checkDuplicate(word: Partial<IWord>): Promise<IWord | null> {
    if (!word.word) return null;
    return await Word.findOne({ wordKey: normalizeWordKey(word.word), language: word.language });
  }

  private async processWord(
    word: Partial<IWord>,
    index: number,
    config: ImportConfig
  ): Promise<ProcessingResult<Partial<IWord>>> {
    const validationResult = WordValidator.validateWord(word, index);
    if (!validationResult.isValid) {
      return {
        index,
        data: word,
        status: 'invalid',
        validationResult,
        action: 'skipped',
      };
    }

    const assertTypesOk = (
      types: string[] | undefined,
      lang: string | undefined
    ): ProcessingResult<Partial<IWord>> | null => {
      if (!lang) return null;
      const check = validateWordTypesForLanguage(types, lang);
      if (check.ok !== false) return null;
      return {
        index,
        data: word,
        status: "invalid",
        validationResult: {
          isValid: false,
          errors: [
            `Types not allowed for language "${lang}": ${check.invalid.join(", ")}`,
          ],
          warnings: [],
        },
        action: "skipped",
      };
    };

    const typeReject = assertTypesOk(
      word.type as string[] | undefined,
      word.language as string | undefined
    );
    if (typeReject) return typeReject;

    const existingWord = await this.checkDuplicate(word);
    if (existingWord) {
      switch (config.duplicateStrategy) {
        case 'error':
          return {
            index,
            data: word,
            status: 'duplicate',
            validationResult,
            error: 'Duplicate word found',
            action: 'skipped',
          };
        case 'skip':
          return {
            index,
            data: word,
            status: 'duplicate',
            validationResult,
            action: 'skipped',
          };
        case 'overwrite':
        case 'merge': {
          const merged = {
            ...existingWord.toObject(),
            ...word,
            updatedAt: new Date(),
          };
          const typeError = assertTypesOk(
            merged.type as string[] | undefined,
            merged.language as string | undefined
          );
          if (typeError) return typeError;
          // The file may come from another database: its _id can differ and _id can't change
          const { _id, __v, ...fields } = word as Partial<IWord> & { __v?: number };
          await Word.findByIdAndUpdate(
            existingWord._id,
            { ...fields, updatedAt: new Date() },
            { new: true }
          );
          return {
            index,
            data: word,
            status: 'valid',
            validationResult,
            action: 'updated',
          };
        }
      }
    }
    const newWord = new Word(word);
    await newWord.save();
    return {
      index,
      data: word,
      status: 'valid',
      validationResult,
      action: 'inserted',
    };
  }

  async importWords(
    words: Partial<IWord>[],
    config: ImportConfig
  ): Promise<ImportResult> {
    const startTime = Date.now();
    const batches: BatchResult[] = [];
    let totalValid = 0;
    let totalInvalid = 0;
    let totalDuplicates = 0;
    let totalErrors = 0;
    let totalInserted = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    const failures: ImportFailure[] = [];

    // No transaction: compatible with MongoDB standalone (no replica set required).
    for (let i = 0; i < words.length; i += config.batchSize) {
      const batchWords = words.slice(i, i + config.batchSize);
      const batchIndex = Math.floor(i / config.batchSize);
      let batchValid = 0;
      let batchInvalid = 0;
      let batchDuplicates = 0;
      let batchErrors = 0;
      let batchInserted = 0;
      let batchUpdated = 0;
      let batchSkipped = 0;
      for (let j = 0; j < batchWords.length; j++) {
        const index = i + j;
        // One bad word must never stop the rest of the import
        const result: ProcessingResult<Partial<IWord>> = await this.processWord(batchWords[j], index, config).catch((error) => ({
          index,
          data: batchWords[j],
          status: 'error' as const,
          error: error.message,
          action: 'skipped' as const,
        }));
        const reason = result.error ?? result.validationResult?.errors.join(", ");
        if (reason && result.status !== 'duplicate' && failures.length < MAX_REPORTED_FAILURES) {
          failures.push({ index, label: batchWords[j].word || `#${index + 1}`, error: reason });
        }
        switch (result.status) {
          case 'valid': batchValid++; totalValid++; break;
          case 'invalid': batchInvalid++; totalInvalid++; break;
          case 'duplicate': batchDuplicates++; totalDuplicates++; break;
          case 'error': batchErrors++; totalErrors++; break;
        }
        switch (result.action) {
          case 'inserted': batchInserted++; totalInserted++; break;
          case 'updated': batchUpdated++; totalUpdated++; break;
          case 'merged': batchUpdated++; totalUpdated++; break;
          case 'skipped': batchSkipped++; totalSkipped++; break;
        }
      }
      batches.push({
        batchIndex,
        processed: batchWords.length,
        valid: batchValid,
        invalid: batchInvalid,
        duplicates: batchDuplicates,
        errors: batchErrors,
        inserted: batchInserted,
        updated: batchUpdated,
        skipped: batchSkipped,
      });
    }

    const duration = Date.now() - startTime;
    return {
      totalItems: words.length,
      totalBatches: batches.length,
      totalValid,
      totalInvalid,
      totalDuplicates,
      totalErrors,
      totalInserted,
      totalUpdated,
      totalSkipped,
      batches,
      failures,
      summary: {
        success: totalErrors === 0,
        message: `Import completed. ${totalInserted} inserted, ${totalUpdated} updated, ${totalSkipped} skipped, ${totalErrors} errors`,
        duration,
      },
    };
  }

  /** What importing these words would do. Changes nothing. */
  async previewWords(words: Partial<IWord>[]): Promise<ImportPreview> {
    const existing = await Word.find({}, { wordKey: 1, language: 1 }).lean();
    const known = new Set(existing.map((w) => `${w.language}:${w.wordKey}`));
    const preview: ImportPreview = { total: words.length, new: 0, duplicates: 0, invalid: 0, failures: [] };

    words.forEach((word, index) => {
      const { errors } = WordValidator.validateWord(word, index);
      const types = word.language ? validateWordTypesForLanguage(word.type as string[], word.language) : null;
      if (types && types.ok === false) errors.push(`Types not allowed for language "${word.language}": ${types.invalid.join(", ")}`);

      if (errors.length > 0) {
        preview.invalid++;
        if (preview.failures.length < MAX_REPORTED_FAILURES) {
          preview.failures.push({ index, label: word.word || `#${index + 1}`, error: errors.join(", ") });
        }
        return;
      }

      const key = `${word.language}:${normalizeWordKey(word.word as string)}`;
      if (known.has(key)) {
        preview.duplicates++;
      } else {
        known.add(key);
        preview.new++;
      }
    });

    return preview;
  }
}

export default new WordImportService();
