import PocketBase from "pocketbase";
import dotenv from "dotenv";
dotenv.config();

const PB_URL = process.env.POCKETBASE_URL || "http://127.0.0.1:8090";
const PB_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL || "";
const PB_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD || "";
const COLLECTION = "lecture_audio";

(async () => {
  const pb = new PocketBase(PB_URL);
  await pb.collection("_superusers").authWithPassword(PB_EMAIL, PB_PASSWORD);
  console.log("Autenticado como superuser");

  const existing = await pb.collections.getFullList();
  if (existing.some((c) => c.name === COLLECTION)) {
    console.log(`Colección "${COLLECTION}" ya existe`);
    process.exit(0);
  }

  const created = await pb.collections.create({
    name: COLLECTION,
    type: "base",
    listRule: "",
    viewRule: "",
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      {
        name: "audio",
        type: "file",
        required: true,
        maxSelect: 1,
        maxSize: 52428800,
        mimeTypes: ["audio/mpeg", "audio/mp3", "audio/wav", "audio/m4a"],
      },
      {
        name: "contentId",
        type: "text",
        required: false,
        max: 100,
      },
      {
        name: "voice",
        type: "text",
        required: false,
        max: 50,
      },
    ],
  });

  console.log("Colección creada:", created.id, created.name);
  process.exit(0);
})();
