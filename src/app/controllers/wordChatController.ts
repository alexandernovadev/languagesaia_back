/** Words: the AI chat attached to each word. */
import { Request, Response } from "express";
import { WordService } from "../services/words/wordService";
import { WordChatService } from "../services/words/WordChatService";
import { generateWordChat } from "../services/ai/wordAIService";
import { errorResponse, successResponse } from "../utils/responseHelpers";
import { toWordDTO } from "../dto/mappers";
import { routeParams } from "../utils/http/routeParams";
import { getUserId } from "../utils/http/requestUser";
import { setSSEHeaders, streamTextResponse } from "../utils/http/sse";
import logger from "../utils/logger";

const wordService = new WordService();
const wordChatService = new WordChatService();

export const addChatMessage = async (req: Request, res: Response) => {
  try {
    const { id } = routeParams(req);
    const { message } = req.body;

    if (!message) {
      return errorResponse(res, "Message is required", 400);
    }

    const word = await wordChatService.addChatMessage(id, message);
    if (!word) {
      return errorResponse(res, "Word not found", 404);
    }

    return successResponse(res, "Chat message added successfully", { word: toWordDTO(word) });
  } catch (error: any) {
    logger.error("Error adding chat message:", error);
    return errorResponse(res, error.message, 500, error);
  }
};

export const getChatHistory = async (req: Request, res: Response) => {
  try {
    const { id } = routeParams(req);
    const chatHistory = await wordChatService.getChatHistory(id);
    return successResponse(res, "Chat history retrieved", chatHistory);
  } catch (error: any) {
    logger.error("Error getting chat history:", error);
    return errorResponse(res, error.message, 500, error);
  }
};

export const clearChatHistory = async (req: Request, res: Response) => {
  try {
    const { id } = routeParams(req);
    const word = await wordChatService.clearChatHistory(id);
    if (!word) {
      return errorResponse(res, "Word not found", 404);
    }

    return successResponse(res, "Chat history cleared successfully", { word: toWordDTO(word) });
  } catch (error: any) {
    logger.error("Error clearing chat history:", error);
    return errorResponse(res, error.message, 500, error);
  }
};

// Streaming chat response
export const streamChatResponse = async (req: Request, res: Response) => {
  try {
    const { id } = routeParams(req);
    const { message } = req.body;

    if (!message) {
      return errorResponse(res, "Message is required", 400);
    }

    const word = await wordService.getWordById(id);
    if (!word) {
      return errorResponse(res, "Word not found", 404);
    }

    setSSEHeaders(res);

    const stream = await generateWordChat(
      word.word,
      word.definition,
      message,
      word.chat || [],
      { stream: true, userId: getUserId(req) },
      word.language,
      req.user?.explainsLanguage || "es"
    );

    await streamTextResponse(res, stream as any, {
      filterMarkdownTables: false,
      // Saved together, only once the answer is complete
      onComplete: async (text) => {
        await wordChatService.addUserMessage(id, message);
        await wordChatService.addAssistantMessage(id, text);
      },
    });
  } catch (error: any) {
    logger.error("Error streaming chat response:", error);
    return errorResponse(res, error.message, 500, error);
  }
};
