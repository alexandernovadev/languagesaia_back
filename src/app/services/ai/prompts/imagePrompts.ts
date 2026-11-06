/**
 * Image prompts for FLUX (fal.ai).
 *
 * FLUX is NOT DALL·E: it doesn't follow instructions, doesn't understand "no …"
 * (mentioning "text" makes it draw text), draws anything in quotes as letters,
 * only reads ~256 tokens, and doesn't know what foreign words mean.
 *
 * So every image is made in two steps:
 *  1. The text AI turns the word/expression/story (+ its meaning) into a short,
 *     purely visual English scene: only what IS in the picture.
 *  2. FLUX gets that scene + Glota's fixed house style (IMAGE_AI.styles).
 */
import { IMAGE_AI } from "../../../../config/aiConfig";
import logger from "../../../utils/logger";
import { generateText } from "../textAIService";

export interface ImageSubject {
  kind: "word" | "expression" | "story";
  /** The word, the expression, or the story premise. */
  text: string;
  /** Definition / meaning (any language). */
  meaning?: string;
  /** Spanish translation, part of speech, usage context, genre… */
  extra?: string;
}

const BRIEF: Record<ImageSubject["kind"], string> = {
  word: "one simple illustration that makes the meaning of this word obvious at a glance (noun → the thing, verb → the action, adjective → the quality)",
  expression:
    "one simple illustration of a real-life situation where people would use this expression; show what it MEANS, never the literal words (for idioms, show the human situation)",
  story: "a book-cover scene for this story: its main character or key moment, with the mood of the genre",
};

/** Learned from bad pictures: mixed meanings and people cut off behind furniture. */
const FIGURE_RULES = `- Show one meaning only, the most common one, even if the definition lists several.
- For an abstract meaning, show one concrete everyday moment that makes it clear.
- If there is a person, there is exactly one, shown as a full-length figure, small enough to fit in the frame with space above the head and below the feet.
- Always name the person's lower clothing and shoes with colors (for example blue jeans and white sneakers), and say both feet stand on the ground or floor.
- The person stands or sits in the open. Any prop is small and held in the hands or resting on the floor beside them. Tables, desks and counters stay out of the scene.
`;

const sceneRequest = (s: ImageSubject) => `You write prompts for an image model that only understands visual descriptions.
Describe ${BRIEF[s.kind]}.

${s.kind === "story" ? "Story premise" : s.kind === "word" ? "Word" : "Expression"}: ${s.text}
${s.meaning ? `Meaning: ${s.meaning}\n` : ""}${s.extra ? `Details: ${s.extra}\n` : ""}
How to write the scene:
- English, 25 to 45 words.
- Describe only what is visible: subject, action, setting, mood, colors of key objects.
- One clear subject in a simple setting. People (if any) look modern and casual, and everything is friendly for all ages.
- Purely visual: describe objects, people and places only; avoid anything with writing on it (signs, labels, books with titles, screens, posters).
${s.kind === "story" ? "" : FIGURE_RULES}- Do not repeat the ${s.kind === "story" ? "title" : s.kind} itself and do not use quotation marks.

Return JSON: {"scene": "..."}`;

/** Removes anything that would make FLUX draw letters: quotes and the target text itself. */
const sanitize = (scene: string, s: ImageSubject) => {
  let out = scene.replace(/["“”«»'`]/g, "");
  if (s.kind !== "story") {
    const target = s.text.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (target) out = out.replace(new RegExp(`\\b${target}\\b`, "gi"), "it");
  }
  return out.replace(/\s+/g, " ").trim();
};

/** Builds the final FLUX prompt (scene + house style). Never throws: falls back to a meaning-based scene. */
export const buildImagePrompt = async (s: ImageSubject): Promise<string> => {
  const style = s.kind === "story" ? IMAGE_AI.styles.story : IMAGE_AI.styles.vocabulary;
  let scene = "";
  try {
    // a short descriptive task: no "thinking" needed (it would eat the whole answer)
    const res: any = await generateText(sceneRequest(s), { responseFormat: "json_object", temperature: 0.8, reasoningEffort: "none" });
    scene = sanitize(JSON.parse(res.choices[0].message.content ?? "{}").scene ?? "", s);
    if (!scene) logger.warn(`[image] empty scene (finish: ${res.choices[0].finish_reason})`);
  } catch (error) {
    logger.warn(`[image] could not write a scene, using the meaning instead: ${error}`);
  }
  if (!scene) scene = sanitize(`A simple illustration of ${s.meaning ?? s.text}`, s);
  const prompt = `${scene}. ${style}`;
  logger.info(`[image] ${s.kind} prompt: ${prompt}`);
  return prompt;
};

// ── Helpers per content type ──

export const wordImagePrompt = (w: { word: string; definition?: string; type?: string[]; spanish?: { word?: string; definition?: string } }) =>
  buildImagePrompt({
    kind: "word",
    text: w.word,
    meaning: w.spanish?.definition || w.definition,
    extra: [w.type?.length ? `part of speech: ${w.type.join(", ")}` : "", w.spanish?.word ? `Spanish: ${w.spanish.word}` : ""].filter(Boolean).join("; "),
  });

export const expressionImagePrompt = (e: { expression: string; definition?: string; context?: string; spanish?: { definition?: string } }) =>
  buildImagePrompt({
    kind: "expression",
    text: e.expression,
    meaning: e.spanish?.definition || e.definition,
    extra: e.context ? `typical context: ${e.context}` : undefined,
  });

export const storyImagePrompt = (premise: string, story?: { title?: string; genre?: string; languageLevel?: string } | null) =>
  buildImagePrompt({
    kind: "story",
    text: premise.slice(0, 1200),
    extra: [story?.genre ? `genre: ${story.genre}` : "", story?.title ? `title: ${story.title}` : ""].filter(Boolean).join("; "),
  });
