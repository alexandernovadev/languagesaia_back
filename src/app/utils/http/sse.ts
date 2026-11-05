import { Response } from "express";
import { createMarkdownTableFilter } from "../text/sanitizeLectureContent";

export function setSSEHeaders(res: Response): void {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
}

/**
 * Consumes an OpenAI-shaped chat completion stream, writes each delta to `res`
 * and ends the response. Markdown tables are stripped live by default
 * (`createMarkdownTableFilter`) since generated content is never supposed to
 * include them; pass `filterMarkdownTables: false` for chats and short
 * generations. `onComplete` gets the full text before the response ends
 * (e.g. to save the assistant's message).
 */
export async function streamTextResponse(
  res: Response,
  stream: AsyncIterable<any>,
  options: {
    filterMarkdownTables?: boolean;
    onComplete?: (text: string) => Promise<unknown>;
  } = {}
): Promise<void> {
  const { filterMarkdownTables = true, onComplete } = options;
  const tableFilter = filterMarkdownTables ? createMarkdownTableFilter() : null;
  let text = "";
  const write = (piece: string) => {
    text += piece;
    res.write(piece);
  };

  for await (const chunk of stream as any) {
    const content = chunk.choices?.[0]?.delta?.content || "";
    if (content) write(tableFilter ? tableFilter.push(content) : content);
  }

  if (tableFilter) write(tableFilter.flush());
  await onComplete?.(text);
  res.end();
}
