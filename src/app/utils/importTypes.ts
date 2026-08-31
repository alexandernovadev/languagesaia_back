import { IWord } from "../../../types/models";

// Strategies for handling duplicates
export type DuplicateStrategy = 'skip' | 'overwrite' | 'error' | 'merge';

// Import configuration
export interface ImportConfig {
  duplicateStrategy: DuplicateStrategy;
  validateOnly: boolean;
  batchSize: number;
}

// Validation result
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Generic processing result
export interface ProcessingResult<T = unknown> {
  index: number;
  data: T;
  status: 'valid' | 'invalid' | 'duplicate' | 'error';
  validationResult?: ValidationResult;
  error?: string;
  action?: 'skipped' | 'inserted' | 'updated' | 'merged';
}

// Batch processing result
export interface BatchResult {
  batchIndex: number;
  processed: number;
  valid: number;
  invalid: number;
  duplicates: number;
  errors: number;
  inserted: number;
  updated: number;
  skipped: number;
  results?: ProcessingResult[];
}

// Final import result
export interface ImportResult {
  totalItems: number;
  totalBatches: number;
  totalValid: number;
  totalInvalid: number;
  totalDuplicates: number;
  totalErrors: number;
  totalInserted: number;
  totalUpdated: number;
  totalSkipped: number;
  batches: BatchResult[];
  summary: {
    success: boolean;
    message: string;
    duration: number;
  };
}

// Specific types for backwards compatibility
export interface WordProcessingResult extends ProcessingResult<Partial<IWord>> {
  word: Partial<IWord>; // Backwards compatibility
}

export interface WordImportResult extends ImportResult {
  totalWords: number; // Backwards compatibility
}

// Import request payload
export interface ImportRequest<T = unknown> {
  data: T[];
  config: ImportConfig;
}