import mongoose, { Schema } from "mongoose";
import { ILecture } from "../../../../types/models";
import { certificationLevelsList, languagesList, readingTypesList } from "../../data/business/shared";

// Definir el esquema
const lectureSchema = new Schema<ILecture>(
  {
    time: { type: Number, required: true },
    difficulty: { 
      type: String, 
      required: true,
      enum: certificationLevelsList
    },
    typeWrite: { 
      type: String, 
      required: true,
      enum: readingTypesList
    },
    language: { 
      type: String, 
      required: true,
      enum: languagesList
    },
    urlAudio: { type: String, default: "" },
    audioRecordId: { type: String, default: "" },
    voice: { type: String, default: "" },
    img: { type: String, default: "" },
    content: { type: String, required: true },
  },
  {
    timestamps: true,
  }
);

// Full-text search index
lectureSchema.index({ content: "text", difficulty: "text", language: "text", typeWrite: "text" });

// Compound indexes for the most common query patterns
lectureSchema.index({ language: 1, difficulty: 1 }); // getLecturesAdvanced filtered by language+level
lectureSchema.index({ language: 1, typeWrite: 1 });  // getLecturesAdvanced filtered by language+typeWrite
// Crear el modelo
const Lecture = mongoose.model<ILecture>("Lecture", lectureSchema);

export default Lecture;
