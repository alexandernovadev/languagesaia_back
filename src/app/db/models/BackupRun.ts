import mongoose, { Schema } from "mongoose";

/** One line per backup attempt, so the admin panel can show the history. */
const BackupRunSchema = new Schema(
  {
    success: { type: Boolean, required: true },
    wordsCount: { type: Number, default: 0 },
    expressionsCount: { type: Number, default: 0 },
    error: { type: String },
  },
  { timestamps: true }
);

BackupRunSchema.index({ createdAt: -1 });

export default mongoose.model("BackupRun", BackupRunSchema);
