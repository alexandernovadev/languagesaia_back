import Story from "../../db/models/Story";
import StoryProgress from "../../db/models/StoryProgress";
import { IStory, IChapter, IStoryProgress } from "../../../../types/models";
import { sanitizeLectureContent } from "../../utils/text/sanitizeLectureContent";
import { escapeRegex } from "../../utils/escapeRegex";
import { paginateQuery, PaginatedResult } from "../db/paginationHelper";
import UserWord from "../../db/models/UserWord";
import { toObjectId } from "../words/UserWordService";
import Word from "../../db/models/Word";
import { generateChapterDetails, generateStoryIdea, streamChapter } from "../ai/storyAIService";
import { generateImage } from "../ai/imageAIService";
import { findPhrases } from "../ai/phraseAIService";
import { chapterImagePrompt, storyImagePrompt, storyVisualGuide } from "../ai/prompts";
import { uploadImageToCloudinary } from "../cloudinary/cloudinaryService";
import logger from "../../utils/logger";
import { AIContentOptions } from "../ai/aiGenerationHelper";

const WORD_POOL = 40;
const WORDS_PER_CHAPTER = 8;

export interface NewStory {
  genre: string;
  languageLevel: string;
  language: string;
  totalChapters: number;
  theme?: string;
}

/** One chapter at a time per story: a double tap must not pay for two. */
const writing = new Set<string>();

export class StoryService {
  async createStory(params: NewStory, userId: string, options: AIContentOptions = {}): Promise<IStory> {
    const { genre, languageLevel, language, totalChapters, theme } = params;
    const idea = await generateStoryIdea({ genre, level: languageLevel, language, totalChapters, theme }, options);
    const story = await Story.create({ ...idea, genre, languageLevel, language, totalChapters, userId: toObjectId(userId), chapters: [] } as Partial<IStory>);
    void this.paintCover(story); // nobody waits for it: until it's ready the card shows the genre's colors
    return story;
  }

  /** A failed cover is no reason to fail the story. */
  async paintCover(story: IStory) {
    try {
      const prompt = await storyImagePrompt(`${story.description} Main character: ${story.protagonist}`, story);
      const { b64_json } = await generateImage(prompt, "landscape_4_3");
      const img = await uploadImageToCloudinary(b64_json, "stories");
      if (img) await Story.updateOne({ _id: story._id }, { img }, { timestamps: false });
    } catch (error) {
      logger.error("Could not paint the story cover:", error);
    }
  }

  /** The words to practice: those in review with the shortest interval, then the rest of the list. */
  private async wordsToPractice(userId: string, language: string): Promise<string[]> {
    const scope: any = { userId: toObjectId(userId), language };
    const reviewing = await UserWord.find({ ...scope, "review.dueAt": { $exists: true } }, { wordId: 1 })
      .sort({ "review.intervalDays": 1 })
      .limit(WORD_POOL)
      .lean();
    const fresh = reviewing.length >= WORD_POOL
      ? []
      : await UserWord.find({ ...scope, "review.dueAt": { $exists: false } }, { wordId: 1 }).limit(WORD_POOL - reviewing.length).lean();
    const words = await Word.find({ _id: { $in: [...reviewing, ...fresh].map((m) => m.wordId) } }, { word: 1 }).lean();
    return words
      .map((w) => w.word)
      .sort(() => Math.random() - 0.5)
      .slice(0, WORDS_PER_CHAPTER);
  }

  /** Starts the next chapter. Call `save` with the streamed text, and `release` when it's over. */
  async writeChapter(storyId: string, userId: string, idea: string | undefined, options: AIContentOptions = {}) {
    const story = await Story.findById(storyId);
    if (!story) return null;
    if (story.chapters.length >= story.totalChapters) throw Object.assign(new Error("The story is finished"), { status: 409 });
    if (writing.has(storyId)) throw Object.assign(new Error("Already writing this chapter"), { status: 409 });

    writing.add(storyId);
    const release = () => writing.delete(storyId);
    try {
      const words = await this.wordsToPractice(userId, story.language);
      const stream = await streamChapter(
        {
          title: story.title,
          description: story.description,
          protagonist: story.protagonist,
          genre: story.genre,
          level: story.languageLevel,
          language: story.language,
          chapterNumber: story.chapters.length + 1,
          totalChapters: story.totalChapters,
          summaries: story.chapters.map((c) => c.summary ?? ""),
          previousText: story.chapters.at(-1)?.content,
          words,
          idea,
        },
        options,
      );
      return { stream, release, save: (text: string) => this.saveChapter(story, text, words, idea, options) };
    } catch (error) {
      release();
      throw error;
    }
  }

  private async saveChapter(story: IStory, text: string, words: string[], idea: string | undefined, options: AIContentOptions) {
    const [firstLine, ...rest] = text.trim().split("\n");
    const title = firstLine.replace(/[#*"“”]/g, "").trim();
    const content = sanitizeLectureContent(rest.join("\n").trim());
    if (!title || !content) throw new Error("The chapter came back incomplete");

    const lower = content.toLowerCase();
    story.chapters.push({
      order: story.chapters.length,
      title,
      content,
      idea,
      targetVocabulary: words.filter((w) => lower.includes(w.toLowerCase())), // the details bring the inflected forms
      questions: [],
    } as any);
    await story.save();

    // Readable from here on. Everything else arrives while you read
    const index = story.chapters.length - 1;
    const id = String(story._id);
    void this.addDetails(id, index, content, story.language, words, idea, options);
    void this.markPhrases(id, index);
    void this.paintChapter(id, index);
  }

  private async addDetails(storyId: string, index: number, content: string, language: string, words: string[], idea: string | undefined, options: AIContentOptions) {
    try {
      const details = await generateChapterDetails({ content, language, words, idea }, options);
      const at = `chapters.${index}`;
      await Story.updateOne(
        { _id: storyId },
        {
          [`${at}.summary`]: details.summary,
          [`${at}.questions`]: details.questions,
          ...(details.usedForms?.length ? { [`${at}.targetVocabulary`]: details.usedForms } : {}),
          ...(details.idea?.trim() ? { [`${at}.idea`]: details.idea.trim() } : {}),
        },
        { timestamps: false },
      );
    } catch (error) {
      logger.error("Could not write the chapter's details:", error);
    }
  }

  async addChatTurn(storyId: string, index: number, question: string, answer: string) {
    await Story.updateOne(
      { _id: storyId },
      { $push: { [`chapters.${index}.chat`]: { $each: [{ role: "user", content: question }, { role: "assistant", content: answer }] } } },
      { timestamps: false },
    );
  }

  async markPhrases(storyId: string, index: number) {
    try {
      const story = await Story.findById(storyId);
      const chapter = story?.chapters[index];
      if (!story || !chapter) return;
      const phrases = await findPhrases(chapter.content, story.language);
      await Story.updateOne({ _id: story._id }, { [`chapters.${index}.phrases`]: phrases }, { timestamps: false });
    } catch (error) {
      logger.error("Could not mark the chapter's phrases:", error);
    }
  }

  /** Same people and place in every chapter: the guide is written once and reused. */
  async paintChapter(storyId: string, index: number) {
    try {
      const story = await Story.findById(storyId);
      const chapter = story?.chapters[index];
      if (!story || !chapter) return;

      let guide = story.visualGuide;
      if (!guide) {
        guide = await storyVisualGuide({ ...story.toObject(), firstChapter: story.chapters[0].content });
        await Story.updateOne({ _id: story._id }, { visualGuide: guide }, { timestamps: false });
      }

      const prompt = await chapterImagePrompt({ title: chapter.title, content: chapter.content, summary: chapter.summary, genre: story.genre, guide });
      const { b64_json } = await generateImage(prompt, "landscape_16_9");
      const img = await uploadImageToCloudinary(b64_json, "stories");
      if (img) await Story.updateOne({ _id: story._id }, { [`chapters.${index}.img`]: img }, { timestamps: false });
    } catch (error) {
      logger.error("Could not paint the chapter:", error);
    }
  }

  async getStoryById(id: string): Promise<IStory | null> {
    return await Story.findById(id);
  }

  async deleteStory(id: string): Promise<IStory | null> {
    return await Story.findByIdAndDelete(id);
  }

  async getStoriesAdvanced(filters: {
    userId?: string;
    page?: number;
    limit?: number;
    search?: string;
    genre?: string | string[];
    level?: string | string[];
    language?: string | string[];
    sortBy?: string;
    sortOrder?: string;
  } = {}): Promise<PaginatedResult<IStory>> {
    const {
      page = 1,
      limit = 12,
      search = "",
      genre,
      level,
      language,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = filters;

    const skip = (page - 1) * limit;
    const query: Record<string, any> = {};
    if (filters.userId) query.userId = filters.userId;

    if (search.trim()) {
      query.$or = [
        { title: { $regex: escapeRegex(search.trim()), $options: "i" } },
        { description: { $regex: escapeRegex(search.trim()), $options: "i" } },
      ];
    }

    if (genre) {
      query.genre = Array.isArray(genre) ? { $in: genre } : genre;
    }

    if (level) {
      query.languageLevel = Array.isArray(level) ? { $in: level } : level;
    }

    if (language) {
      query.language = Array.isArray(language) ? { $in: language } : language;
    }

    const sortField = ["createdAt", "title", "languageLevel"].includes(sortBy) ? sortBy : "createdAt";
    const sortDirection = sortOrder === "asc" ? 1 : -1;

    return paginateQuery(Story, query, {
      sort: { [sortField]: sortDirection },
      skip,
      limit,
      page,
    });
  }

  async updateChapter(
    storyId: string,
    chapterIndex: number,
    data: Partial<IChapter>
  ): Promise<IStory | null> {
    const updateKey = `chapters.${chapterIndex}`;
    const updateData: Record<string, any> = {};

    if (data.content !== undefined) {
      updateData[`${updateKey}.content`] = sanitizeLectureContent(data.content);
    }
    if (data.title !== undefined) {
      updateData[`${updateKey}.title`] = data.title;
    }
    if (data.urlAudio !== undefined) {
      updateData[`${updateKey}.urlAudio`] = data.urlAudio;
    }
    if (data.audioRecordId !== undefined) {
      updateData[`${updateKey}.audioRecordId`] = data.audioRecordId;
    }
    if (data.voice !== undefined) {
      updateData[`${updateKey}.voice`] = data.voice;
    }
    if (data.audioAlignment !== undefined) {
      updateData[`${updateKey}.audioAlignment`] = data.audioAlignment;
    }
    if (data.targetVocabulary !== undefined) {
      updateData[`${updateKey}.targetVocabulary`] = data.targetVocabulary;
    }

    return await Story.findByIdAndUpdate(storyId, { $set: updateData }, { new: true });
  }

  /** The chapter is done: the reader moves on to the next one. */
  async updateProgress(userId: string, storyId: string, chapterIndex: number): Promise<IStoryProgress> {
    const progress = await StoryProgress.findOneAndUpdate(
      { userId, storyId } as any,
      { $addToSet: { completedChapters: chapterIndex }, $max: { currentChapter: chapterIndex + 1 }, $set: { lastReadAt: new Date() } },
      { upsert: true, returnDocument: "after" },
    );
    return progress as IStoryProgress;
  }

  async finishedChapters(userId: string, storyIds: string[]): Promise<Map<string, number>> {
    const rows = await StoryProgress.find({ userId, storyId: { $in: storyIds } } as any, { storyId: 1, completedChapters: 1 }).lean();
    return new Map(rows.map((r) => [String(r.storyId), r.completedChapters.length]));
  }

  async getProgress(userId: string, storyId: string): Promise<IStoryProgress | null> {
    return await StoryProgress.findOne({ userId, storyId });
  }
}
