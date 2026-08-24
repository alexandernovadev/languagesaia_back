import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import Story from "../src/app/db/models/Story";

(async () => {
  const uri = process.env.MONGO_URL;
  if (!uri) throw new Error("MONGO_URL is required in .env");

  await mongoose.connect(uri);
  console.log("Conectado a MongoDB");

  const result = await Story.updateMany(
    { language: { $exists: false } },
    { $set: { language: "en" } }
  );
  console.log(`Historias sin idioma actualizadas a "en": ${result.modifiedCount}`);

  await mongoose.disconnect();
  process.exit(0);
})().catch(async (err) => {
  console.error("ERROR:", err.message);
  await mongoose.disconnect();
  process.exit(1);
});
