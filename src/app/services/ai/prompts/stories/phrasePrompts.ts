import { getLangLabel } from "../langUtils";

export interface Phrase {
  /** The words as they appear in the text, with ... where other words sit between them. */
  text: string;
  /** Dictionary form: "picked her up" is pick up. */
  base: string;
  type: "phrasal verb" | "idiom" | "expression";
  /** What it means in this sentence, in Spanish. */
  meaning: string;
  sentence: string;
}

export const createPhraseSearchPrompt = (content: string, language: string) => `You find every multi-word unit in a text for a learner of ${getLangLabel(language)}: phrasal verbs (also separated, like "picked her up"), idioms, fixed expressions and multi-word connectors, where the words together work as one piece. Skip literal combinations.
Go sentence by sentence. Return JSON: {"items":[{"text":"exact words as they appear, with ... for a gap","base":"dictionary form"}]}
Text:
${content}`;

/** Learned on real chapters: too strict a judge dropped good ones, too lenient kept wrong readings. */
export const createPhraseJudgePrompt = (content: string, language: string, candidates: { text: string; base: string }[]) => `You are the final judge of multi-word units in a ${getLangLabel(language)} text for a beginner. For each candidate, find its exact sentence and decide using that sentence only.
Keep every phrasal verb used as a unit (put down, come back, walk up to) and every fixed expression a learner should learn as one piece, even if it is easy (take a deep breath, shake one's head, way out, ter que, de novo, pela primeira vez, dar certo).
Reject only:
- A wrong reading: the words appear but mean something else there. "She ran out of the hotel" is she left running, so run out of (to have none left) is rejected.
- Names, food, drinks, objects and other compound nouns (pão de queijo, telefone fixo, park ranger), dates and times, plain noun plus adjective.
- A verb with a preposition or direction that keeps its plain meaning: look at, work as, know about, rise from, pour into, stand along, push against, olhar para, voltar para.
- A plain description of what someone does: put her hands in her pockets, open wide, grow stronger.
Return JSON: {"items":[{"text":"exact words","base":"dictionary form","type":"phrasal verb | idiom | expression","sentence":"the sentence","meaning":"what it means in that sentence, in Spanish","keep":true}]}, with every candidate, keep false for rejected ones. List the kept ones first, the most useful for a learner at the top.
Candidates: ${JSON.stringify(candidates)}
Text:
${content}`;
