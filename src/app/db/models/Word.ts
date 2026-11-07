import mongoose, { Schema } from "mongoose";
import { IWord } from "../../../../types/models";
import { languagesList, wordTypesList } from "../../data/business/shared";
import { normalizeWordKey } from "../../utils/text/normalizeWordKey";

/** The shared dictionary. What belongs to each learner lives in UserWord. */
const WordSchema: Schema = new Schema<IWord>(
  {
    word: {
      type: String,
      required: true,
      minlength: 1,
      maxlength: 100,
    },
    wordKey: {
      type: String,
      minlength: 1,
      maxlength: 100,
    },
    language: {
      type: String,
      required: true,
      enum: languagesList,
    },
    definition: {
      type: String,
      required: true,
      minlength: 5,
      maxlength: 1000,
    },
    examples: {
      type: [String],
      default: [],
    },
    synonyms: {
      type: [String],
      default: [],
    },
    type: {
      type: [String],
      // Que pasa si quiero aprender chino ???? en fin algun dia
      enum: wordTypesList,
      default: [],
    },
    IPA: {
      type: String,
    },
    img: {
      type: String,
    },
    /** Pronunciation, created the first time someone listens. */
    audio: {
      type: String,
    },
    codeSwitching: {
      type: [String],
      default: [],
    },
    /** Position in the language's list of most common words. */
    completedAt: { type: Date },
    /** Hidden by an admin: it stops reaching Repasar, and learners keep their progress. */
    hiddenAt: { type: Date },
    rank: {
      type: Number,
    },
    /** Verbs only: tense → person → form. */
    conjugations: {
      type: Schema.Types.Mixed,
    },
    /** Which AI wrote the entry, when it came from the bulk seed. */
    source: {
      type: String,
    },
    /** What the AI reviewer found wrong. Empty when it passed. */
    reviewNotes: {
      type: [String],
      default: undefined,
    },
    spanish: {
      definition: {
        type: String,
        minlength: 5,
        maxlength: 1000,
      },
      word: {
        type: String,
        minlength: 1,
        maxlength: 100,
      },
    },
  },
  { timestamps: true }
);

// Keep `wordKey` in sync with `word` on every save (case-insensitive uniqueness).
WordSchema.pre("save", function (this: IWord) {
  if (this.word) {
    this.wordKey = normalizeWordKey(this.word);
  }
});

// Case-insensitive uniqueness: one entry per (word, language)
WordSchema.index({ wordKey: 1, language: 1 }, { unique: true });

// Compound indexes for the most common query patterns
WordSchema.index({ language: 1, rank: 1 }); // the next most common words for a learner
WordSchema.index({ language: 1, createdAt: -1 }); // getWords sorted by date with language filter

// Crear el modelo
const Word = mongoose.model<IWord>("Word", WordSchema);

export default Word;
