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
  /** A basic, very frequent word (pronouns, "is", "and"…): the most important ones, so they get a richer scene. */
  basic?: boolean;
}

/** Grammar words have no picture of their own: they are shown through a moment that uses them. */
const GRAMMAR_TYPES = ["auxiliary verb", "modal verb", "pronoun", "preposition", "conjunction", "determiner", "interjection", "particle"];
/** The most frequent words are the ones learned first: they all get the detailed scene. */
const BASIC_RANK = 300;

const BASIC_BRIEF =
  "one detailed illustration of an everyday moment that makes this very common word obvious. It is a basic word that may have no picture of its own, so build the moment from the example sentence and show the word's role through who is there, gestures, pointing, positions and facial expressions";

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

/** Basic words: pronouns and the like need the right number of people, and more detail. */
const BASIC_FIGURE_RULES = `- Show one meaning only, the most common one, through one clear everyday moment.
- Use as many people as the word needs and no more than three (for example two friends for we, one person pointing at their own chest for me). Each one is a full-length figure that fits in the frame.
- For each person say their pose, gesture and facial expression, and name their clothes and shoes with colors, with both feet on the ground or floor.
- Name the setting and two or three objects in it with their colors, so the moment feels real. Tables, desks and counters stay out of the scene.
`;

const sceneRequest = (s: ImageSubject) => `You write prompts for an image model that only understands visual descriptions.
Describe ${s.basic ? BASIC_BRIEF : BRIEF[s.kind]}.

${s.kind === "story" ? "Story premise" : s.kind === "word" ? "Word" : "Expression"}: ${s.text}
${s.meaning ? `Meaning: ${s.meaning}\n` : ""}${s.extra ? `Details: ${s.extra}\n` : ""}
How to write the scene:
- English, ${s.basic ? "50 to 75" : "25 to 45"} words.
- Describe only what is visible: subject, action, setting, mood, colors of key objects.
- One clear subject in a simple setting. People (if any) look modern and casual, and everything is friendly for all ages.
- Purely visual: describe objects, people and places only; avoid anything with writing on it (signs, labels, books with titles, screens, posters).
${s.kind === "story" ? "" : s.basic ? BASIC_FIGURE_RULES : FIGURE_RULES}- Do not repeat the ${s.kind === "story" ? "title" : s.kind} itself and do not use quotation marks.

Return JSON: {"scene": "..."}`;

/** Removes anything that would make FLUX draw letters: quotes and the target text itself. */
const sanitize = (scene: string, s: ImageSubject) => {
  let out = scene.replace(/["“”«»'`]/g, "");
  // basic words (is, me, a…) are part of any English sentence: removing them would break the scene
  if (s.kind !== "story" && !s.basic) {
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

// ── Chapter pictures ──

const askJson = async (prompt: string, field: string, reasoningEffort: "none" | "low") => {
  const res: any = await generateText(prompt, { responseFormat: "json_object", temperature: 0.6, reasoningEffort });
  return String(JSON.parse(res.choices[0].message.content ?? "{}")[field] ?? "").replace(/["“”«»`]/g, "").replace(/\s+/g, " ").trim();
};

/**
 * What every picture of a story shares: FLUX remembers nothing, so the same
 * people and place have to be described word for word in each prompt.
 */
export const storyVisualGuide = (s: { title: string; description: string; protagonist: string; genre: string; firstChapter: string }) =>
  askJson(
    `You are the art director of an illustrated story. Write the visual guide every picture must follow.

Title: ${s.title}
Genre: ${s.genre}
Premise: ${s.description}
Protagonist: ${s.protagonist}
First chapter:
${s.firstChapter}

Write in English, 40 to 55 words, only what can be seen:
- The protagonist: approximate age, build, skin tone, hair color and style, and one exact outfit with colors.
- Any second character who matters, in the same way but shorter.
- The main place and its era, and one color palette and kind of light.
Choose concrete details and stay faithful to the text.

Return JSON: {"guide": "..."}`,
    "guide",
    "low",
  );

/** Reads the whole chapter and paints the moment that sums it up. */
export const chapterImagePrompt = async (c: { title: string; content: string; summary?: string; genre: string; guide: string }) => {
  const scene = await askJson(
    `You write prompts for an image model that only understands visual descriptions. Read this whole chapter, then describe the one moment that best represents the chapter as a whole.

Genre: ${c.genre}
Chapter title: ${c.title}
${c.summary ? `What happens: ${c.summary}\n` : ""}Full chapter:
${c.content}

Visual guide, which the picture must respect exactly: ${c.guide}

How to write the scene, in English, 70 to 90 words:
- Be precise and faithful to the chapter: the exact place, the time of day, the weather and the light.
- Who is there, where each one stands, what they are doing and the expression on their faces.
- The objects from the chapter that matter, and where they are.
- What fills the foreground and the background, and the mood.
- Purely visual: describe only what is visible, never thoughts, sounds or words. Avoid anything with writing on it (signs, labels, screens, letters, maps with names).
- Do not repeat the guide: the people's looks are added afterwards. Refer to them as the woman, the boy, the old man.

Return JSON: {"scene": "..."}`,
    "scene",
    "low",
  );
  const prompt = `${scene} ${c.guide} ${IMAGE_AI.styles.story}`;
  logger.info(`[image] chapter prompt: ${prompt}`);
  return prompt;
};

// ── Helpers per content type ──

export const wordImagePrompt = (w: {
  word: string;
  definition?: string;
  type?: string[];
  rank?: number;
  examples?: string[];
  spanish?: { word?: string; definition?: string };
}) => {
  const basic = (w.rank != null && w.rank <= BASIC_RANK) || !!w.type?.some((t) => GRAMMAR_TYPES.includes(t));
  return buildImagePrompt({
    kind: "word",
    text: w.word,
    meaning: w.spanish?.definition || w.definition,
    extra: [
      w.type?.length ? `part of speech: ${w.type.join(", ")}` : "",
      w.spanish?.word ? `Spanish: ${w.spanish.word}` : "",
      basic && w.examples?.[0] ? `example sentence: ${w.examples[0]}` : "",
    ]
      .filter(Boolean)
      .join("; "),
    basic,
  });
};

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
