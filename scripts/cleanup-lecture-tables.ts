import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import Lecture from "../src/app/db/models/Lecture";
import { removeMarkdownTables } from "../src/app/utils/text/sanitizeLectureContent";

(async () => {
  const uri = process.env.MONGO_URL;
  if (!uri) throw new Error("MONGO_URL is required in .env");

  await mongoose.connect(uri);
  console.log("Conectado a MongoDB");

  const withPipes = await Lecture.find({ content: { $regex: /\|/ } }).select("_id content").lean();
  console.log(`Lecturas con "|" en content: ${withPipes.length}`);

  let cleaned = 0;
  for (const lecture of withPipes) {
    const sanitized = removeMarkdownTables(lecture.content || "");
    if (sanitized !== lecture.content) {
      await Lecture.updateOne({ _id: lecture._id }, { $set: { content: sanitized } });
      cleaned++;
      console.log(`  ✓ lecture ${lecture._id} limpiada`);
    }
  }

  console.log(`Tablas eliminadas en ${cleaned} lecturas`);
  await mongoose.disconnect();
  process.exit(0);
})().catch(async (err) => {
  console.error("ERROR:", err.message);
  await mongoose.disconnect();
  process.exit(1);
});