import { Response } from "express";
import { createMarkdownTableFilter } from "../text/sanitizeLectureContent";

export function setSSEHeaders(res: Response): void {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

/**
 * Consumes an OpenAI-shaped chat completion stream and writes each delta to
 * `res`. Markdown tables are stripped live by default (`createMarkdownTableFilter`)
 * since generated content is never supposed to include them; pass
 * `filterMarkdownTables: false` for short generations (e.g. topic ideas)
 * where the filter isn't needed.
 */
export async function streamTextResponse(
  res: Response,
  stream: AsyncIterable<any>,
  options: { filterMarkdownTables?: boolean } = {}
): Promise<void> {
  const { filterMarkdownTables = true } = options;
  const tableFilter = filterMarkdownTables ? createMarkdownTableFilter() : null;

  for await (const chunk of stream as any) {
    const content = chunk.choices?.[0]?.delta?.content || "";
    if (content) {
      res.write(tableFilter ? tableFilter.push(content) : content);
    }
  }

  if (tableFilter) res.write(tableFilter.flush());
  res.end();
}
