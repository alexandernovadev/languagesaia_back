import Expression from "../../db/models/Expression";
import { IExpression } from "../../../../types/models";
import { ImportFailure, ImportPreview, MAX_REPORTED_FAILURES } from "../../utils/importTypes";

export class ExpressionImportExportService {
  async getAllExpressionsForExport(): Promise<IExpression[]> {
    const results: IExpression[] = [];
    const cursor = Expression.find({}).sort({ createdAt: -1 }).lean().cursor();
    for await (const doc of cursor) {
      results.push(doc as unknown as IExpression);
    }
    return results;
  }

  /** What importing these expressions would do. Changes nothing. */
  async previewExpressions(expressions: any[]): Promise<ImportPreview> {
    const existing = await Expression.find({}, { expression: 1 }).lean();
    const known = new Set(existing.map((e) => e.expression));
    const preview: ImportPreview = { total: expressions.length, new: 0, duplicates: 0, invalid: 0, failures: [] };

    expressions.forEach((item, index) => {
      const error = !item.expression ? "Expression is required" : !item.definition ? "Definition is required" : null;
      if (error) {
        preview.invalid++;
        if (preview.failures.length < MAX_REPORTED_FAILURES) {
          preview.failures.push({ index, label: item.expression || `#${index + 1}`, error });
        }
      } else if (known.has(item.expression)) {
        preview.duplicates++;
      } else {
        known.add(item.expression);
        preview.new++;
      }
    });

    return preview;
  }

  async importExpressions(
    expressions: any[],
    config: {
      duplicateStrategy: "skip" | "overwrite" | "error" | "merge";
      batchSize?: number;
    }
  ): Promise<{
    totalItems: number;
    totalInserted: number;
    totalUpdated: number;
    totalSkipped: number;
    totalErrors: number;
    batches: any[];
    failures: ImportFailure[];
    summary: { success: boolean; message: string; duration: number };
  }> {
    const startTime = Date.now();
    const batches: any[] = [];
    let totalInserted = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    const failures: ImportFailure[] = [];

    const batchSize = config.batchSize || 10;

    // No transaction: compatible with MongoDB standalone (no replica set required).
    for (let i = 0; i < expressions.length; i += batchSize) {
      const batchExpressions = expressions.slice(i, i + batchSize);
      const batchIndex = Math.floor(i / batchSize);
      let batchInserted = 0;
      let batchUpdated = 0;
      let batchSkipped = 0;
      let batchErrors = 0;

      for (const [offset, expressionData] of batchExpressions.entries()) {
        try {
          const existing = await Expression.findOne({
            expression: expressionData.expression,
          });

          if (existing) {
            switch (config.duplicateStrategy) {
              case "error":
                batchErrors++; totalErrors++; break;
              case "skip":
                batchSkipped++; totalSkipped++; break;
              case "overwrite":
              case "merge": {
                const { _id: _drop, ...updateData } = expressionData;
                await Expression.findByIdAndUpdate(existing._id, updateData, { new: true });
                batchUpdated++; totalUpdated++; break;
              }
            }
          } else {
            await new Expression(expressionData).save();
            batchInserted++; totalInserted++;
          }
        } catch (error: any) {
          batchErrors++; totalErrors++;
          if (failures.length < MAX_REPORTED_FAILURES) {
            const index = i + offset;
            failures.push({ index, label: expressionData.expression || `#${index + 1}`, error: error.message });
          }
        }
      }

      batches.push({
        batchIndex,
        processed: batchExpressions.length,
        inserted: batchInserted,
        updated: batchUpdated,
        skipped: batchSkipped,
        errors: batchErrors,
      });
    }

    const duration = Date.now() - startTime;
    return {
      totalItems: expressions.length,
      totalInserted,
      totalUpdated,
      totalSkipped,
      totalErrors,
      batches,
      failures,
      summary: {
        success: totalErrors === 0,
        message: `Import completed. ${totalInserted} inserted, ${totalUpdated} updated, ${totalSkipped} skipped, ${totalErrors} errors`,
        duration,
      },
    };
  }
}

export default new ExpressionImportExportService();
