import mongoose, { Schema } from "mongoose";
import { IStory } from "../../../../types/models";
import { certificationLevelsList, storyGenresList, languagesList } from "../../data/business/shared";

const ChapterSchema = new Schema(
  {
    order: { type: Number, required: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    urlAudio: { type: String, default: "" },
    audioRecordId: { type: String, default: "" },
    voice: { type: String, default: "" },
    audioAlignment: {
      type: [{ word: String, start: Number, end: Number }],
      default: [],
    },
    /** What happened: the next chapters are written from these. */
    summary: { type: String, default: "" },
    /** The learner's words used in this chapter. */
    targetVocabulary: { type: [String], default: [] },
    questions: {
      type: [{ _id: false, question: String, options: [String], answer: Number }],
      default: [],
    },
  },
  { timestamps: true }
);

const storySchema = new Schema<IStory>(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    img: { type: String, default: "" },
    languageLevel: { type: String, required: true, enum: certificationLevelsList },
    language: { type: String, required: true, enum: languagesList },
    genre: { type: String, required: true, enum: storyGenresList },
    protagonist: { type: String, default: "" },
    totalChapters: { type: Number, default: 6 },
    chapters: { type: [ChapterSchema], default: [] },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

storySchema.index({ genre: 1, languageLevel: 1 });
storySchema.index({ language: 1 });
storySchema.index({ userId: 1 });
storySchema.index({ "chapters.order": 1 });

const Story = mongoose.model<IStory>("Story", storySchema);

export default Story;
