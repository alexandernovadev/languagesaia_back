import mongoose, { Schema } from "mongoose";
import { IStory } from "../../../../types/models";
import { certificationLevelsList, storyGenresList } from "../../data/business/shared";

const ChapterSchema = new Schema(
  {
    order: { type: Number, required: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    urlAudio: { type: String, default: "" },
    audioRecordId: { type: String, default: "" },
    voice: { type: String, default: "" },
  },
  { timestamps: true }
);

const storySchema = new Schema<IStory>(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    img: { type: String, default: "" },
    languageLevel: { type: String, required: true, enum: certificationLevelsList },
    targetVocabulary: { type: [String], default: [] },
    targetGrammar: { type: [String], default: [] },
    genre: { type: String, required: true, enum: storyGenresList },
    chapters: { type: [ChapterSchema], default: [] },
    userId: { type: String, required: true },
  },
  { timestamps: true }
);

storySchema.index({ genre: 1, languageLevel: 1 });
storySchema.index({ userId: 1 });
storySchema.index({ "chapters.order": 1 });

const Story = mongoose.model<IStory>("Story", storySchema);

export default Story;
