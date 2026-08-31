import Word from "../../db/models/Word";
import { IWord } from "../../../../types/models";
import {
  ImportConfig,
  ProcessingResult,
  BatchResult,
  ImportResult,
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
        case 'overwrite': {
          const merged = {
            ...existingWord.toObject(),
            ...word,
            updatedAt: new Date(),
          };
          const owReject = assertTypesOk(
            merged.type as string[] | undefined,
            merged.language as string | undefined
          );
          if (owReject) return owReject;
          await Word.findByIdAndUpdate(
            existingWord._id,
            { ...word, updatedAt: new Date() },
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
        case 'merge': {
          const mergedM = {
            ...existingWord.toObject(),
            ...word,
            updatedAt: new Date(),
          };
          const mergeReject = assertTypesOk(
            mergedM.type as string[] | undefined,
            mergedM.language as string | undefined
          );
          if (mergeReject) return mergeReject;
          await Word.findByIdAndUpdate(
            existingWord._id,
            { ...word, updatedAt: new Date() },
            { new: true }
          );
          return {
            index,
            data: word,
            status: 'valid',
            validationResult,
            action: 'merged',
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
        const result = await this.processWord(batchWords[j], i + j, config);
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
      summary: {
        success: totalErrors === 0,
        message: `Import completed. ${totalInserted} inserted, ${totalUpdated} updated, ${totalSkipped} skipped, ${totalErrors} errors`,
        duration,
      },
    };
  }

  async validateWords(words: Partial<IWord>[]): Promise<ProcessingResult<Partial<IWord>>[]> {
    return words.map((word, index) => ({
      index,
      data: word,
      status: WordValidator.validateWord(word, index).isValid ? 'valid' : 'invalid',
      validationResult: WordValidator.validateWord(word, index),
    }));
  }
} 