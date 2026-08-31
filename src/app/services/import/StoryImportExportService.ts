import Story from "../../db/models/Story";
import StoryProgress from "../../db/models/StoryProgress";

export interface StoryBackup {
  stories: any[];
  storyProgress: any[];
}

export class StoryImportExportService {
  async getBackupForExport(): Promise<StoryBackup> {
    const [stories, storyProgress] = await Promise.all([
      Story.find({}).sort({ createdAt: -1 }).lean(),
      StoryProgress.find({}).sort({ updatedAt: -1 }).lean(),
    ]);

    return { stories, storyProgress };
  }

  validateStories(stories: any[]) {
    return stories.map((story, index) => {
      const errors: string[] = [];
      if (!story || typeof story !== "object") errors.push("Story must be an object");
      if (!story?.title) errors.push("Title is required");
      if (!story?.description) errors.push("Description is required");
      if (!story?.languageLevel) errors.push("Language level is required");
      if (!story?.language) errors.push("Language is required");
      if (!story?.genre) errors.push("Genre is required");
      if (!story?.userId) errors.push("User ID is required");
      if (!Array.isArray(story?.chapters)) errors.push("Chapters must be an array");
      else if (story.chapters.some((chapter: any) => !chapter?.title || !chapter?.content)) {
        errors.push("Every chapter requires a title and content");
      }

      return {
        index,
        data: story,
        status: errors.length ? "invalid" : "valid",
        errors,
      };
    });
  }

  async importBackup(
    backup: StoryBackup,
    duplicateStrategy: "skip" | "overwrite" | "merge" | "error",
    batchSize: number
  ) {
    const startTime = Date.now();
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    const errorDetails: { index: number; error: string }[] = [];

    for (let i = 0; i < backup.stories.length; i += batchSize) {
      const batch = backup.stories.slice(i, i + batchSize);
      for (let offset = 0; offset < batch.length; offset++) {
        const storyData = batch[offset];
        const index = i + offset;
        try {
          const existing = storyData._id ? await Story.findById(storyData._id) : null;
          if (existing) {
            if (duplicateStrategy === "skip") {
              skipped++;
              continue;
            }
            if (duplicateStrategy === "error") {
              errors++;
              errorDetails.push({ index, error: "Duplicate story found" });
              continue;
            }
            if (duplicateStrategy === "overwrite" || duplicateStrategy === "merge") {
              const { _id: _ignoredId, ...updateData } = storyData;
              await Story.findByIdAndUpdate(existing._id, updateData, {
                new: true,
                runValidators: true,
              });
              updated++;
              continue;
            }
          }

          await new Story(storyData).save();
          inserted++;
        } catch (error) {
          errors++;
          errorDetails.push({
            index,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
    }

    let progressInserted = 0;
    let progressUpdated = 0;
    let progressSkipped = 0;
    let progressErrors = 0;

    for (const progressData of backup.storyProgress) {
      try {
        if (!progressData?.userId || !progressData?.storyId) {
          progressErrors++;
          continue;
        }

        const existing = await StoryProgress.findOne({
          userId: progressData.userId,
          storyId: progressData.storyId,
        });
        if (existing) {
          if (duplicateStrategy === "skip") {
            progressSkipped++;
          } else {
            const { _id: _ignoredId, ...updateData } = progressData;
            await StoryProgress.findByIdAndUpdate(existing._id, updateData, {
              new: true,
              runValidators: true,
            });
            progressUpdated++;
          }
        } else {
          await new StoryProgress(progressData).save();
          progressInserted++;
        }
      } catch {
        progressErrors++;
      }
    }

    return {
      totalItems: backup.stories.length,
      totalProgress: backup.storyProgress.length,
      totalInserted: inserted,
      totalUpdated: updated,
      totalSkipped: skipped,
      totalErrors: errors,
      progressInserted,
      progressUpdated,
      progressSkipped,
      progressErrors,
      errorDetails,
      duration: Date.now() - startTime,
    };
  }
}

export default new StoryImportExportService();
