const TABLE_DELIMITER_ROW = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

export const isTableDelimiterRow = (line: string): boolean => TABLE_DELIMITER_ROW.test(line);

const isTableBlock = (lines: string[], start: number): number => {
  if (start + 1 >= lines.length) return -1;
  const header = lines[start];
  if (!header.includes("|")) return -1;
  let delimIdx = start + 1;
  while (delimIdx < lines.length && lines[delimIdx].trim() === "") delimIdx++;
  if (delimIdx >= lines.length || !isTableDelimiterRow(lines[delimIdx])) return -1;
  let end = delimIdx;
  while (end + 1 < lines.length) {
    let k = end + 1;
    while (k < lines.length && lines[k].trim() === "") k++;
    if (k < lines.length && lines[k].includes("|")) end = k;
    else break;
  }
  return end;
};

const removeOrphanPipeRows = (lines: string[]): string[] => {
  const result: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes("|")) {
      result.push(lines[i]);
      continue;
    }
    let prev = -1;
    for (let p = i - 1; p >= 0; p--) {
      if (lines[p].trim() !== "") { prev = p; break; }
    }
    let next = -1;
    for (let n = i + 1; n < lines.length; n++) {
      if (lines[n].trim() !== "") { next = n; break; }
    }
    const neighborHasPipe =
      (prev >= 0 && lines[prev].includes("|")) ||
      (next >= 0 && lines[next].includes("|"));
    result.push(neighborHasPipe ? "" : lines[i]);
  }
  return result;
};

export const removeMarkdownTables = (content: string): string => {
  if (!content || !content.includes("|")) return content;
  let lines = content.split("\n");
  const result: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const end = isTableBlock(lines, i);
    if (end >= 0) {
      for (let j = i; j <= end; j++) {
        result.push("");
      }
      i = end + 1;
    } else {
      result.push(lines[i]);
      i++;
    }
  }
  lines = removeOrphanPipeRows(result);
  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
};

export const sanitizeLectureContent = (content: string): string => {
  return removeMarkdownTables(content || "").trim();
};

// Streaming filter: removes markdown tables from a live text stream.
// Any "|" line that could be the start of a table (or is inside one) is
// held back until it is confirmed or the stream ends, so tables never
// reach the client.
export const createMarkdownTableFilter = () => {
  let pending = "";

  const push = (chunk: string): string => {
    pending += chunk;
    const lines = pending.split("\n");
    if (lines.length < 2) return "";

    // Find the earliest pipe line that is either an unconfirmed table
    // start (its next non-blank line has not arrived yet) or a confirmed
    // table start (next non-blank line is a delimiter row). Everything
    // from that line onward is held back.
    let holdFrom = -1;
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].includes("|")) continue;
      let j = i + 1;
      while (j < lines.length && lines[j].trim() === "") j++;
      if (j >= lines.length) {
        holdFrom = i;
        break;
      }
      if (isTableDelimiterRow(lines[j])) {
        holdFrom = i;
        break;
      }
      // Next line exists and is not a delimiter: not a table, keep scanning
    }

    if (holdFrom < 0) {
      // Nothing unconfirmed: flush everything except the last line,
      // which may be a partial line mid-stream.
      holdFrom = lines.length - 1;
    }

    const ready = lines.slice(0, holdFrom).join("\n");
    pending = lines.slice(holdFrom).join("\n");
    return removeMarkdownTables(ready);
  };

  const flush = (): string => {
    const out = removeMarkdownTables(pending);
    pending = "";
    return out;
  };

  return { push, flush };
};