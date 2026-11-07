/**
 * The one backup of Glota: every collection worth keeping, in a single gzipped
 * file. Images and audio stay out, only their URLs travel: the files live in
 * PocketBase and Cloudinary, which have their own backups.
 *
 * Restoring is safe on a database that already has data. Each record is matched
 * by its natural key, and references are rewritten when the ids differ.
 */
import { gunzipSync, gzipSync } from "zlib";
import mongoose, { type Model } from "mongoose";
import Exercise from "../../db/models/Exercise";
import Expression from "../../db/models/Expression";
import Lesson from "../../db/models/Lesson";
import LessonAttempt from "../../db/models/LessonAttempt";
import Progress from "../../db/models/Progress";
import SpeechClip from "../../db/models/SpeechClip";
import Story from "../../db/models/Story";
import StoryProgress from "../../db/models/StoryProgress";
import User from "../../db/models/User";
import UserWord from "../../db/models/UserWord";
import Word from "../../db/models/Word";
import WordForm from "../../db/models/WordForm";
import XpDay from "../../db/models/XpDay";

const { EJSON } = mongoose.mongo.BSON;
const VERSION = 1;

type Doc = Record<string, any>;
type Section = "dictionary" | "expressions" | "stories" | "lessons" | "progress";
export type ImportStrategy = "keep" | "replace";

type Part = {
  name: string;
  section: Section;
  model: Model<any>;
  /** What makes a record the same one in two databases. */
  key: string[];
};

/** Referenced records go first, so their ids are known by the time something points at them. */
const PARTS: Part[] = [
  { name: "words", section: "dictionary", model: Word, key: ["wordKey", "language"] },
  { name: "wordForms", section: "dictionary", model: WordForm, key: ["language", "form"] },
  { name: "speechClips", section: "dictionary", model: SpeechClip, key: ["language", "key"] },
  { name: "expressions", section: "expressions", model: Expression, key: ["expression"] },
  { name: "stories", section: "stories", model: Story, key: ["_id"] },
  { name: "storyProgress", section: "stories", model: StoryProgress, key: ["userId", "storyId"] },
  { name: "exercises", section: "lessons", model: Exercise, key: ["language", "explainsLanguage", "prompt"] },
  { name: "lessons", section: "lessons", model: Lesson, key: ["_id"] },
  { name: "lessonAttempts", section: "lessons", model: LessonAttempt, key: ["_id"] },
  { name: "userWords", section: "progress", model: UserWord, key: ["userId", "wordId"] },
  { name: "progress", section: "progress", model: Progress, key: ["userId"] },
  { name: "xpDays", section: "progress", model: XpDay, key: ["userId", "day"] },
];

export type Backup = {
  version: number;
  createdAt: string;
  /** Who each userId in the file is, so it can find its owner in another database. */
  users: Array<{ _id: unknown; email: string }>;
  data: Record<string, Doc[]>;
};

export type SectionReport = { section: Section; total: number; new: number; existing: number };

export class BackupFileError extends Error {}

const keyOf = (doc: Doc, key: string[]) => key.map((field) => String(doc[field])).join("\u0000");

export async function createBackup() {
  const [users, ...collections] = await Promise.all([
    User.collection.find({}, { projection: { email: 1 } }).toArray(),
    ...PARTS.map((part) => part.model.collection.find().toArray()),
  ]);
  const data = Object.fromEntries(PARTS.map((part, i) => [part.name, collections[i]]));
  const createdAt = new Date().toISOString();
  const backup = { version: VERSION, createdAt, users, data };

  return {
    filename: `glota-backup-${createdAt.slice(0, 10)}.json.gz`,
    buffer: gzipSync(EJSON.stringify(backup)),
    wordsCount: data.words.length,
    expressionsCount: data.expressions.length,
    summary: sumBySection(data),
  };
}

export function readBackup(file: Buffer): Backup {
  let backup: Backup;
  try {
    backup = EJSON.parse(gunzipSync(file).toString("utf-8")) as Backup;
  } catch {
    throw new BackupFileError("El archivo no es una copia de Glota.");
  }
  if (backup?.version !== VERSION || !backup.data) throw new BackupFileError("El archivo no es una copia de Glota.");
  return backup;
}

function sumBySection(data: Record<string, Doc[]>) {
  const totals = {} as Record<Section, number>;
  for (const part of PARTS) totals[part.section] = (totals[part.section] ?? 0) + (data[part.name]?.length ?? 0);
  return totals;
}

/** File user id → user here, by email. Whoever isn't here becomes the person importing. */
async function ownersOf(backup: Backup, importerId: string) {
  const here = await User.collection.find({}, { projection: { email: 1 } }).toArray();
  const byEmail = new Map(here.map((user) => [user.email, user._id]));
  const importer = new mongoose.Types.ObjectId(importerId);
  return new Map(backup.users.map((user) => [String(user._id), byEmail.get(user.email) ?? importer])).set("", importer);
}

/** File id → id here, for records that already exist here under another id. */
async function idsHere(part: Part, docs: Doc[]) {
  const here = await part.model.collection.find({}, { projection: Object.fromEntries(part.key.map((field) => [field, 1])) }).toArray();
  const byKey = new Map(here.map((doc) => [keyOf(doc, part.key), doc._id]));
  return new Map(docs.flatMap((doc) => (byKey.has(keyOf(doc, part.key)) ? [[String(doc._id), byKey.get(keyOf(doc, part.key))]] : [])));
}

/**
 * The file's records, pointing at this database. Runs before anything is
 * written, so the preview and the import see exactly the same thing.
 */
async function prepare(backup: Backup, importerId: string) {
  const owners = await ownersOf(backup, importerId);
  const docsOf = (name: string) => backup.data[name] ?? [];
  const words = await idsHere(PARTS[0], docsOf("words"));
  const exercises = await idsHere(PARTS.find((part) => part.name === "exercises")!, docsOf("exercises"));

  const owner = (id: unknown) => owners.get(String(id)) ?? owners.get("");
  const pointAtHere = (doc: Doc): Doc => ({
    ...doc,
    ...(doc.userId && { userId: owner(doc.userId) }),
    ...(doc.createdBy && { createdBy: owner(doc.createdBy) }),
    ...(doc.wordId && { wordId: words.get(String(doc.wordId)) ?? doc.wordId }),
    ...(doc.exercises && {
      exercises: doc.exercises.map((item: Doc) => ({ ...item, exerciseId: exercises.get(String(item.exerciseId)) ?? item.exerciseId })),
    }),
  });

  return Promise.all(
    PARTS.map(async (part) => {
      const docs = docsOf(part.name).map(pointAtHere);
      return { part, docs, existing: (await idsHere(part, docs)).size };
    })
  );
}

const report = (prepared: Awaited<ReturnType<typeof prepare>>) => {
  const sections = new Map<Section, SectionReport>();
  for (const { part, docs, existing } of prepared) {
    const row = sections.get(part.section) ?? { section: part.section, total: 0, new: 0, existing: 0 };
    row.total += docs.length;
    row.existing += existing;
    row.new += docs.length - existing;
    sections.set(part.section, row);
  }
  return [...sections.values()];
};

/** What an import would do. Changes nothing. */
export async function previewBackup(backup: Backup, importerId: string) {
  return { createdAt: backup.createdAt, sections: report(await prepare(backup, importerId)) };
}

export async function importBackup(backup: Backup, importerId: string, strategy: ImportStrategy) {
  const prepared = await prepare(backup, importerId);
  let failed = 0;

  for (const { part, docs } of prepared) {
    if (docs.length === 0) continue;
    const writes = docs.map((doc) => {
      const { _id, ...fields } = doc;
      return {
        updateOne: {
          filter: Object.fromEntries(part.key.map((field) => [field, doc[field]])),
          update: strategy === "replace" ? { $set: fields, $setOnInsert: { _id } } : { $setOnInsert: doc },
          upsert: true,
        },
      };
    });
    // one record that can't go in, like an id taken by a renamed word, must not stop the rest
    await part.model.collection.bulkWrite(writes, { ordered: false }).catch((error) => {
      if (!(error instanceof mongoose.mongo.MongoBulkWriteError)) throw error;
      failed += [error.writeErrors].flat().length;
    });
  }

  return { sections: report(prepared), failed };
}
