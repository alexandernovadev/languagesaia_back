import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import Lecture from "../src/app/db/models/Lecture";
import { sanitizeLectureContent } from "../src/app/utils/text/sanitizeLectureContent";

(async () => {
  const uri = process.env.MONGO_URL;
  if (!uri) throw new Error("MONGO_URL is required in .env");

  await mongoose.connect(uri);
  console.log("Conectado a MongoDB");

  const withIssues = await Lecture.find({
    content: { $regex: /(\|)|(^#{1,6}[ \t]*#)/m },
  })
    .select("_id content")
    .lean();
  console.log(`Lecturas con tablas o headings rotos: ${withIssues.length}`);

  let cleaned = 0;
  for (const lecture of withIssues) {
    const sanitized = sanitizeLectureContent(lecture.content || "");
    if (sanitized !== lecture.content) {
      await Lecture.updateOne({ _id: lecture._id }, { $set: { content: sanitized } });
      cleaned++;
      console.log(`  ✓ lecture ${lecture._id} limpiada`);
    }
  }

  console.log(`Contenido corregido en ${cleaned} lecturas`);

  // Normalize paragraph breaks (and single-line content) in every lecture
  const all = await Lecture.find({}).select("_id content").lean();
  let spaced = 0;
  for (const lecture of all) {
    const normalized = sanitizeLectureContent(lecture.content || "");
    if (normalized !== lecture.content) {
      await Lecture.updateOne({ _id: lecture._id }, { $set: { content: normalized } });
      spaced++;
    }
  }
  console.log(`Párrafos normalizados en ${spaced} lecturas`);

  await mongoose.disconnect();
  process.exit(0);
})().catch(async (err) => {
  console.error("ERROR:", err.message);
  await mongoose.disconnect();
  process.exit(1);
});