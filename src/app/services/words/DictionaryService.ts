/**
 * The admin's view of the shared dictionary: everything, not one learner's list.
 * A change here reaches everybody who has the word.
 */
import Word from "../../db/models/Word";
import UserWord from "../../db/models/UserWord";
import { escapeRegex } from "../../utils/escapeRegex";
import { normalizeWordKey } from "../../utils/text/normalizeWordKey";

export interface DictionaryQuery {
  language?: string;
  search?: string;
  type?: string;
  source?: string;
  missing?: "image" | "details" | "list";
  hidden?: boolean;
  sort?: "rank" | "alpha" | "recent";
  page: number;
  limit: number;
  userId: string;
}

const SORTS = { rank: { unranked: 1, rank: 1, wordKey: 1 }, alpha: { wordKey: 1 }, recent: { createdAt: -1 } } as const;
const EDITABLE = ["word", "definition", "examples", "synonyms", "type", "IPA", "codeSwitching", "conjugations", "spanish", "rank"] as const;

const pickEditable = (body: Record<string, unknown>) => Object.fromEntries(EDITABLE.filter((f) => body[f] !== undefined).map((f) => [f, body[f]]));

export class DictionaryService {
  async list(q: DictionaryQuery) {
    const filter: Record<string, unknown> = { hiddenAt: { $exists: !!q.hidden } };
    if (q.language) filter.language = q.language;
    if (q.type) filter.type = q.type;
    if (q.source) filter.source = q.source === "manual" ? { $exists: false } : q.source;
    if (q.search) {
      const like = new RegExp(escapeRegex(q.search), "i");
      filter.$or = [{ word: like }, { "spanish.word": like }];
    }
    if (q.missing === "image") filter.$and = [{ $or: [{ img: { $exists: false } }, { img: "" }, { img: null }] }];
    if (q.missing === "details") Object.assign(filter, { completedAt: { $exists: false }, "codeSwitching.0": { $exists: false } });
    if (q.missing === "list") filter._id = { $nin: await UserWord.distinct("wordId", { userId: q.userId } as any) };

    const [total, data] = await Promise.all([
      Word.countDocuments(filter as any),
      Word.aggregate([
        { $match: filter },
        { $addFields: { unranked: { $cond: [{ $gt: ["$rank", null] }, 0, 1] } } }, // Mongo would put the words without a rank first
        { $sort: SORTS[q.sort ?? "rank"] as any },
        { $skip: (q.page - 1) * q.limit },
        { $limit: q.limit },
        { $project: { word: 1, IPA: 1, img: 1, type: 1, rank: 1, source: 1, spanish: 1, completedAt: 1, codeSwitching: 1, hiddenAt: 1, language: 1 } },
      ]),
    ]);
    return { data, total, page: q.page, pages: Math.max(1, Math.ceil(total / q.limit)) };
  }

  /** How many learners have the word: the page warns before touching it. */
  async get(id: string) {
    const [word, learners] = await Promise.all([Word.findById(id).lean(), UserWord.countDocuments({ wordId: id } as any)]);
    return word ? { ...word, learners } : null;
  }

  async create(body: Record<string, unknown>, language: string) {
    return Word.create({ ...pickEditable(body), language } as any);
  }

  async update(id: string, body: Record<string, unknown>) {
    const word = await Word.findById(id);
    if (!word) return null;
    word.set(pickEditable(body));
    if (typeof body.word === "string") word.set("wordKey", normalizeWordKey(body.word));
    return word.save();
  }

  /** Hidden words stop reaching Repasar, and whoever had one keeps their progress. */
  async setHidden(id: string, hidden: boolean) {
    return Word.findByIdAndUpdate(id, hidden ? { hiddenAt: new Date() } : { $unset: { hiddenAt: 1 } }, { new: true });
  }

  /** Only for words nobody has: a real delete would take someone's progress with it. */
  async remove(id: string) {
    const learners = await UserWord.countDocuments({ wordId: id } as any);
    if (learners > 0) throw Object.assign(new Error(`${learners} learners have this word: hide it instead`), { status: 409 });
    return Word.findByIdAndDelete(id);
  }
}

export default new DictionaryService();
