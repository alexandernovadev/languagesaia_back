import Word from "../../db/models/Word";
import User from "../../db/models/User";
import UserWord from "../../db/models/UserWord";
import { withProgress } from "./UserWordService";

export class WordExportService {
  /** The whole dictionary, with the admin's own progress so a backup can restore it. */
  async getAllWordsForExport(): Promise<any[]> {
    const admin = await User.findOne({ role: "admin" }, { _id: 1 }).lean();
    const [words, progress] = await Promise.all([
      Word.find({}).sort({ createdAt: -1 }).lean(),
      admin ? UserWord.find({ userId: admin._id }).lean() : [],
    ]);
    const byWord = new Map<string, unknown>((progress as any[]).map((p) => [String(p.wordId), p]));
    return words.map((w) => withProgress(w, byWord.get(String(w._id))));
  }
}

export default new WordExportService();
