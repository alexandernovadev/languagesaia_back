import UserWord from "../../db/models/UserWord";
import { IUserWord, ChatMessage } from "../../../../types/models";
import { generateId } from "../../utils/generateId";
import { MAX_CHAT_MESSAGES } from "../../../config/constants";

/** Each learner has their own chat about a word. */
export class WordChatService {
  private async add(userId: string, wordId: string, role: ChatMessage["role"], content: string): Promise<IUserWord | null> {
    const mine = await UserWord.findOne({ userId, wordId });
    if (!mine) return null;

    mine.chat.push({ id: generateId(), role, content, timestamp: new Date() });
    if (mine.chat.length > MAX_CHAT_MESSAGES) mine.chat = mine.chat.slice(-MAX_CHAT_MESSAGES);
    return mine.save();
  }

  addUserMessage(userId: string, wordId: string, message: string) {
    return this.add(userId, wordId, "user", message);
  }

  addAssistantMessage(userId: string, wordId: string, message: string) {
    return this.add(userId, wordId, "assistant", message);
  }

  async getChatHistory(userId: string, wordId: string): Promise<ChatMessage[]> {
    const mine = await UserWord.findOne({ userId, wordId });
    return mine?.chat ?? [];
  }

  async clearChatHistory(userId: string, wordId: string): Promise<IUserWord | null> {
    return UserWord.findOneAndUpdate({ userId, wordId }, { chat: [] }, { new: true });
  }
}

export default new WordChatService();
