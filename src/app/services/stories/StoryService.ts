import Story from "../../db/models/Story";
import StoryProgress from "../../db/models/StoryProgress";
import { IStory, IChapter, IStoryProgress } from "../../../../types/models";
import { sanitizeLectureContent } from "../../utils/text/sanitizeLectureContent";
import { escapeRegex } from "../../utils/escapeRegex";
import { paginateQuery, PaginatedResult } from "../db/paginationHelper";

export class StoryService {
  async createStory(data: Partial<IStory> & { userId: string }): Promise<IStory> {
    const story = new Story({
      title: data.title || "",
      description: data.description || "",
      img: data.img || "",
      languageLevel: data.languageLevel,
      language: data.language,
      genre: data.genre,
      chapters: [],
      userId: data.userId,
    });
    return await story.save();
  }

  async getStoryById(id: string): Promise<IStory | null> {
    return await Story.findById(id);
  }

  async updateStory(id: string, data: Partial<IStory>): Promise<IStory | null> {
    let updateData = data;

    if (data.chapters !== undefined) {
      updateData = {
        ...data,
        chapters: data.chapters.map((ch) => ({
          ...ch,
          content: sanitizeLectureContent(ch.content || ""),
        })),
      };
    }

    return await Story.findByIdAndUpdate(id, updateData, { new: true });
  }

  async deleteStory(id: string): Promise<IStory | null> {
    return await Story.findByIdAndDelete(id);
  }

  async getStoriesAdvanced(filters: {
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

  async addChapter(storyId: string, chapter: Omit<IChapter, "createdAt">): Promise<IStory | null> {
    const story = await Story.findById(storyId);
    if (!story) return null;

    story.chapters.push({
      ...chapter,
      content: sanitizeLectureContent(chapter.content || ""),
      createdAt: new Date(),
    } as any);

    return await story.save();
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
    if (data.targetGrammar !== undefined) {
      updateData[`${updateKey}.targetGrammar`] = data.targetGrammar;
    }

    return await Story.findByIdAndUpdate(storyId, { $set: updateData }, { new: true });
  }

  async deleteChapter(storyId: string, chapterIndex: number): Promise<IStory | null> {
    const story = await Story.findById(storyId);
    if (!story || chapterIndex >= story.chapters.length) return null;

    story.chapters.splice(chapterIndex, 1);
    story.chapters.forEach((ch, i) => {
      (ch as any).order = i;
    });

    return await story.save();
  }

  async getVocabReport(storyId: string): Promise<{ word: string; count: number; chapters: number[] }[]> {
    const story = await Story.findById(storyId);
    if (!story) return [];

    const targetWordsSet = new Set<string>();
    story.chapters.forEach((ch) => {
      (ch.targetVocabulary || []).forEach((w) => targetWordsSet.add(w.toLowerCase()));
    });
    const targetWords = Array.from(targetWordsSet);
    if (!targetWords.length) return [];

    const report = targetWords.map((word) => {
      const regex = new RegExp(`\\b${escapeRegex(word)}\\b`, "gi");
      const chapters: number[] = [];
      let totalCount = 0;

      story.chapters.forEach((ch, idx) => {
        const matches = ch.content.match(regex);
        const count = matches ? matches.length : 0;
        if (count > 0) {
          chapters.push(idx);
          totalCount += count;
        }
      });

      return { word, count: totalCount, chapters };
    });

    return report.filter((r) => r.count > 0);
  }

  async updateProgress(
    userId: string,
    storyId: string,
    chapterIndex: number
  ): Promise<IStoryProgress> {
    let progress = await StoryProgress.findOne({ userId, storyId });

    if (!progress) {
      progress = new StoryProgress({
        userId,
        storyId,
        currentChapter: chapterIndex,
        completedChapters: [],
        lastReadAt: new Date(),
      });
    } else {
      progress.currentChapter = chapterIndex;
      progress.lastReadAt = new Date();
      if (!progress.completedChapters.includes(chapterIndex)) {
        progress.completedChapters.push(chapterIndex);
      }
    }

    return await progress.save();
  }

  async getProgress(userId: string, storyId: string): Promise<IStoryProgress | null> {
    return await StoryProgress.findOne({ userId, storyId });
  }
}
