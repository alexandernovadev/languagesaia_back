import mongoose, { Schema } from "mongoose";
import { ChatMessage, IWord } from "../../../../types/models";
import { chatRolesList, difficultyList, languagesList, wordTypesList } from "../../data/business/shared";
import { normalizeWordKey } from "../../utils/text/normalizeWordKey";

const ChatMessageSchema: Schema = new Schema<ChatMessage>({
  id: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: chatRolesList,
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

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
    seen: {
      type: Number,
      default: 0,
    },
    img: {
      type: String,
    },
    difficulty: {
      type: String,
      enum: difficultyList,
      default: "hard",
    },
    codeSwitching: {
      type: [String],
      default: [],
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
    chat: {
      type: [ChatMessageSchema],
      default: [],
    },
  },
  { timestamps: true }
);

// Keep `wordKey` in sync with `word` on every save (case-insensitive uniqueness).
WordSchema.pre("save", function (this: IWord, next) {
  if (this.word) {
    this.wordKey = normalizeWordKey(this.word);
  }
  next();
});

// Compound indexes for the most common query patterns
WordSchema.index({ language: 1, difficulty: 1 }); // getAnkiCards, getWords filtered by language+difficulty
WordSchema.index({ language: 1, createdAt: -1 }); // getWords sorted by date with language filter

// Crear el modelo
const Word = mongoose.model<IWord>("Word", WordSchema);

export default Word;
