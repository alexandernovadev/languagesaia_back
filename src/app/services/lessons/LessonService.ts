/**
 * Lessons (Bruno) — Duolingo-style practice, one exercise at a time.
 *
 * createLesson  quick (your weak topics + your words) | topic (you pick) | mistakes (redo what you failed)
 * fromBank      reuses reviewed exercises the learner hasn't seen, so the AI writes less
 * draftExercises  AI writes more than needed, a second AI pass rejects the bad ones, and all that pass go to the bank
 * current       the lesson left unfinished, to continue it
 * answer        checks one exercise right away (AI only for free translations) and stores it
 * report        the learner flags an exercise as wrong: it stops counting
 * finish        final score + XP
 * stats         accuracy per grammar topic (weak points) + recent lessons
 * chat          "¿Por qué?" — Bruno explains an exercise (streamed)
 */
import { Types } from "mongoose";
import Exercise from "../../db/models/Exercise";
import Lesson from "../../db/models/Lesson";
import LessonAttempt from "../../db/models/LessonAttempt";
import Word from "../../db/models/Word";
import { grammarCatalog, grammarLabel } from "../../data/business/shared/grammar";
import { generateExercises, gradeTranslation, reviewExercises, streamQuestionChat } from "../ai/lessonAIService";
import type { GeneratedType, LessonGenerationParams } from "../ai/prompts/lessons/lessonPrompts";
import { ILessonQuestion, LessonMode } from "../../../../types/models";
import logger from "../../utils/logger";

type User = { _id: string | Types.ObjectId; language?: string; explainsLanguage?: string };

const shuffle = <T>(a: T[]): T[] => {
  const arr = [...a];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[.,!?¿¡;:"“”«»]/g, "")
    .replace(/[’`]/g, "'")
    .replace(/\s+/g, " ")
    .trim();

/** Exercise types per lesson length (match is added separately from the user's words). */
const PLAN: GeneratedType[] = ["choice", "fillBlank", "order", "translate", "findError", "choice", "order", "fillBlank", "translate", "findError", "choice", "fillBlank", "order", "findError", "choice", "translate", "fillBlank", "order", "choice", "findError"];

/** How many extra exercises to write, so the review can reject some without leaving the lesson short. */
const SPARE_EXERCISES = 3;
const planFor = (count: number): GeneratedType[] => Array.from({ length: count }, (_, i) => PLAN[i % PLAN.length]);

/** Questions whose latest answer is still wrong. Attempts must come newest first. */
function pendingMistakes(attempts: any[]): ILessonQuestion[] {
  const decided = new Set<string>();
  const pending: ILessonQuestion[] = [];
  for (const attempt of attempts) {
    for (const ans of attempt.answers ?? []) {
      const q: ILessonQuestion | undefined = attempt.lessonId?.questions?.[ans.index];
      if (!q || q.type === "match" || decided.has(q.prompt)) continue;
      decided.add(q.prompt);
      if (!ans.correct && !ans.reported) pending.push(q);
    }
  }
  return pending;
}

/** Takes exercises following PLAN, so a lesson mixes types instead of repeating one. */
function pickVaried<T extends { type: string }>(pool: T[], count: number): T[] {
  const byType = new Map<string, T[]>();
  for (const item of pool) byType.set(item.type, [...(byType.get(item.type) ?? []), item]);
  const picked: T[] = [];
  for (let i = 0; picked.length < Math.min(count, pool.length); i++) {
    const next = byType.get(PLAN[i % PLAN.length])?.shift();
    if (next) picked.push(next);
  }
  return picked;
}

/** A bank entry as a lesson question. */
const toQuestion = ({ _id, language, explainsLanguage, level, reported, createdAt, updatedAt, __v, ...question }: any): ILessonQuestion => ({
  ...question,
  exerciseId: _id,
});

/** The AI sometimes writes the topic's label instead of its value: maps it back. */
function catalogTopic(language: string, topic: string | undefined, fallback: string): string {
  const match = grammarCatalog(language)
    .flatMap((g) => g.topics)
    .find((t) => topic && (norm(t.value) === norm(topic) || norm(t.label) === norm(topic)));
  return match?.value ?? fallback;
}

/** The reviewer sees each exercise with its answer spelled out. */
function forReview(q: ILessonQuestion, index: number) {
  const answer =
    q.type === "order" ? (q.answerTokens ?? []).join(" ") : q.type === "translate" ? q.reference : q.type === "findError" ? `${q.tokens?.[q.errorIndex ?? 0]} -> ${q.correction}` : q.options?.[q.answerIndex ?? 0];
  return { index, type: q.type, prompt: q.prompt, options: q.options, answer, explanation: q.explanation };
}

/** Keeps only alternatives that can really be built with the exercise's words. */
function usableAlternatives(q: ILessonQuestion, alternatives: string[] = []): string[] {
  const sameWords = (s: string) => norm(s).split(" ").sort().join(" ");
  const expected = sameWords((q.answerTokens ?? []).join(" "));
  return [...new Set(alternatives.filter((a) => sameWords(a) === expected).map(norm))];
}

/** Turns raw AI output into a clean, checkable exercise (or null if it's broken). */
function normalize(raw: any): ILessonQuestion | null {
  try {
    const base = { type: raw.type, grammarTopic: raw.grammarTopic, explanation: raw.explanation };
    switch (raw.type) {
      case "choice":
      case "fillBlank": {
        const options: string[] = (raw.options ?? []).map(String).filter(Boolean);
        const i = Number(raw.answerIndex);
        if (options.length < 3 || !(i >= 0 && i < options.length) || !raw.prompt) return null;
        if (raw.type === "fillBlank" && !String(raw.prompt).includes("___")) return null;
        const correct = options[i];
        const mixed = shuffle(options);
        return { ...base, prompt: String(raw.prompt), options: mixed, answerIndex: mixed.indexOf(correct) };
      }
      case "order": {
        const answerTokens: string[] = (raw.answerTokens ?? []).map(String).filter(Boolean);
        const distractors: string[] = (raw.distractors ?? []).map(String).filter((d: string) => d && !answerTokens.some((a) => norm(a) === norm(d)));
        if (answerTokens.length < 3 || answerTokens.length > 12 || !raw.prompt) return null;
        return { ...base, prompt: String(raw.prompt), answerTokens, tokens: shuffle([...answerTokens, ...distractors.slice(0, 3)]) };
      }
      case "translate": {
        if (!raw.prompt || !raw.reference) return null;
        return { ...base, prompt: String(raw.prompt), reference: String(raw.reference) };
      }
      case "findError": {
        const sentence = String(raw.prompt ?? "");
        const tokens = sentence.split(/\s+/).filter(Boolean);
        const target = norm(String(raw.errorWord ?? ""));
        const errorIndex = tokens.findIndex((t) => norm(t) === target);
        if (tokens.length < 3 || errorIndex < 0 || !raw.correction) return null;
        return { ...base, prompt: sentence, tokens, errorIndex, correction: String(raw.correction) };
      }
    }
  } catch {
    /* broken item */
  }
  return null;
}

/** 5 of the user's words with a Spanish translation → a "match" exercise. */
async function buildMatch(language: string): Promise<ILessonQuestion | null> {
  const words = await Word.aggregate([
    { $match: { language, "spanish.word": { $exists: true, $ne: "" }, difficulty: { $in: ["hard", "medium"] } } },
    { $sample: { size: 5 } },
    { $project: { word: 1, "spanish.word": 1 } },
  ]);
  if (words.length < 4) return null;
  return {
    type: "match",
    prompt: "Une cada palabra con su traducción",
    pairs: words.map((w: any) => ({ left: w.word, right: w.spanish.word })),
    explanation: "Palabras de tu colección.",
  };
}

async function vocabularyFor(language: string): Promise<string[]> {
  const words = await Word.aggregate([
    { $match: { language, difficulty: { $in: ["hard", "medium"] } } },
    { $sample: { size: 12 } },
    { $project: { word: 1 } },
  ]);
  return words.map((w: any) => w.word);
}

export class LessonService {
  catalog(language: string) {
    return grammarCatalog(language);
  }

  /** Every recent attempt with answers, finished or not, newest first. */
  private history(user: User, language: string) {
    return LessonAttempt.find({ userId: user._id, language })
      .sort({ createdAt: -1 })
      .limit(60)
      .populate("lessonId", "questions title mode level")
      .lean();
  }

  /** Accuracy per grammar topic from everything answered (weakest first). */
  async stats(user: User) {
    const language = user.language ?? "en";
    const attempts = await this.history(user, language);
    const byTopic = new Map<string, { seen: number; score: number }>();
    for (const a of attempts as any[]) {
      const qs: ILessonQuestion[] = a.lessonId?.questions ?? [];
      for (const ans of a.answers ?? []) {
        const topic = ans.reported ? undefined : qs[ans.index]?.grammarTopic;
        if (!topic) continue;
        const s = byTopic.get(topic) ?? { seen: 0, score: 0 };
        s.seen += 1;
        s.score += ans.score;
        byTopic.set(topic, s);
      }
    }
    const topics = [...byTopic.entries()]
      .map(([value, s]) => ({ value, label: grammarLabel(language, value), seen: s.seen, accuracy: Math.round((s.score / s.seen) * 100) }))
      .sort((x, y) => x.accuracy - y.accuracy);
    const recent = (attempts as any[]).filter((a) => a.completedAt).slice(0, 10).map((a) => ({
      _id: a._id,
      title: a.lessonId?.title ?? "Lección",
      mode: a.lessonId?.mode,
      level: a.lessonId?.level,
      score: a.score,
      xp: a.xp,
      completedAt: a.completedAt,
    }));
    return { topics, recent, mistakes: pendingMistakes(attempts).length };
  }

  /** Reviewed exercises that fit and this learner hasn't seen yet. */
  private async fromBank(user: User, filter: { language: string; explainsLanguage: string; level: string; topics: string[] }, count: number) {
    const seen = (await Lesson.distinct("questions.exerciseId", { createdBy: user._id })).filter(Boolean);
    const pool = await Exercise.aggregate([
      {
        $match: {
          language: filter.language,
          explainsLanguage: filter.explainsLanguage,
          level: filter.level,
          grammarTopic: { $in: filter.topics },
          reported: { $ne: true },
          _id: { $nin: seen },
        },
      },
      { $sample: { size: 100 } },
    ]);
    return pickVaried(pool, count).map(toQuestion);
  }

  /**
   * Writes at least `count` exercises that pass the review (asks once more if
   * too many were rejected) and stores them all in the bank, spares included.
   */
  async draftExercises(params: Omit<LessonGenerationParams, "plan">, count: number) {
    const { language, explainsLanguage, level } = params;
    const approved: ILessonQuestion[] = [];
    let title = "";

    for (let round = 0; round < 2 && approved.length < count; round++) {
      const missing = count - approved.length;
      const raw = await generateExercises({ ...params, plan: planFor(missing + SPARE_EXERCISES) });
      title ||= raw.title ?? "";

      const written = (raw.questions ?? []).map(normalize).filter(Boolean) as ILessonQuestion[];
      const [reviews, known] = await Promise.all([
        reviewExercises({ language, explainsLanguage, level, exercises: written.map(forReview) }),
        Exercise.find({ language, explainsLanguage, prompt: { $in: written.map((q) => q.prompt) } }, { prompt: 1 }).lean(),
      ]);
      const inBank = new Set(known.map((e) => e.prompt));

      written.forEach((q, index) => {
        const review = reviews.find((r) => r.index === index);
        if (!review?.ok) {
          logger.info(`[lesson] rejected: "${q.prompt}" — ${review?.problem ?? "not reviewed"}`);
          return;
        }
        if (inBank.has(q.prompt) || approved.some((a) => a.prompt === q.prompt)) return;
        approved.push(q.type === "order" ? { ...q, altAnswers: usableAlternatives(q, review.alternatives) } : q);
      });
    }

    const fallbackTopic = params.topics[0].split(":")[0];
    const saved = await Exercise.insertMany(
      approved.map((q) => ({ ...q, grammarTopic: catalogTopic(language, q.grammarTopic, fallbackTopic), language, explainsLanguage, level })),
    );
    return { title, questions: saved.map((e) => toQuestion(e.toObject())) };
  }

  async createLesson(user: User, input: { mode: LessonMode; level?: string; grammarTopics?: string[]; count?: number }) {
    const language = user.language ?? "en";
    const explainsLanguage = user.explainsLanguage ?? "es";
    const level = input.level ?? "B1";
    let questions: ILessonQuestion[] = [];
    let title = "";
    let topics: string[] = input.grammarTopics ?? [];

    if (input.mode === "mistakes") {
      const attempts = await this.history(user, language);
      questions = shuffle(pendingMistakes(attempts)).slice(0, input.count ?? 10);
      if (!questions.length) throw Object.assign(new Error("No tienes errores pendientes"), { status: 404 });
      title = "Repetir errores";
      topics = [...new Set(questions.map((q) => q.grammarTopic).filter(Boolean) as string[])];
    } else {
      const count = input.count ?? (input.mode === "quick" ? 8 : 10);
      if (input.mode === "quick" && !topics.length) {
        // weakest topics first; if there's no history yet, topics around the level
        const { topics: weak } = await this.stats(user);
        topics = weak.filter((t) => t.accuracy < 85).slice(0, 3).map((t) => t.value);
        if (!topics.length) {
          const all = grammarCatalog(language).flatMap((g) => g.topics);
          const near = all.filter((t) => t.level <= level);
          topics = shuffle(near.length ? near : all).slice(0, 3).map((t) => t.value);
        }
      }
      if (!topics.length) throw Object.assign(new Error("Elige al menos un tema"), { status: 400 });

      const match = await buildMatch(language);
      const aiCount = match ? count - 1 : count;
      const banked = await this.fromBank(user, { language, explainsLanguage, level, topics }, aiCount);
      const missing = aiCount - banked.length;
      logger.info(`[lesson] ${banked.length} exercises from the bank, ${missing} from the AI`);

      let draft: Awaited<ReturnType<LessonService["draftExercises"]>> | null = null;
      if (missing > 0) {
        const vocabulary = input.mode === "quick" ? await vocabularyFor(language) : [];
        draft = await this.draftExercises(
          { language, explainsLanguage, level, topics: topics.map((t) => `${t}: ${grammarLabel(language, t)}`), vocabulary },
          missing,
        );
      }
      // what the AI wrote beyond `missing` stays in the bank for the next lesson
      questions = pickVaried([...banked, ...(draft?.questions.slice(0, missing) ?? [])], aiCount);
      if (questions.length < Math.ceil(aiCount / 2)) {
        logger.warn(`[lesson] only ${questions.length}/${aiCount} exercises passed the review`);
        throw new Error("Bruno no pudo preparar la lección. Inténtalo otra vez.");
      }
      if (match) questions.splice(Math.min(3, questions.length), 0, match);
      title = draft?.title || (input.mode === "quick" ? "Lección rápida" : "Lección");
    }

    // One open lesson per language: the old one's answers still count, but it can't be continued
    await LessonAttempt.updateMany(
      { userId: user._id, language, completedAt: { $exists: false }, abandonedAt: { $exists: false } },
      { abandonedAt: new Date() },
    );
    const lesson = await Lesson.create({ title, mode: input.mode, language, level, grammarTopics: topics, questions, createdBy: user._id });
    const attempt = await LessonAttempt.create({ lessonId: lesson._id, userId: user._id, language, answers: [] });
    return { lesson: lesson.toObject(), attemptId: attempt._id, topics: topics.map((t) => ({ value: t, label: grammarLabel(language, t) })) };
  }

  /** The lesson left unfinished, if any, to pick it up where it was. */
  async current(user: User) {
    const language = user.language ?? "en";
    const attempt = await LessonAttempt.findOne({ userId: user._id, language, completedAt: { $exists: false }, abandonedAt: { $exists: false } })
      .sort({ createdAt: -1 })
      .lean();
    const lesson = attempt && (await Lesson.findById(attempt.lessonId).lean());
    if (!attempt || !lesson) return null;
    return {
      lesson,
      attemptId: attempt._id,
      topics: lesson.grammarTopics.map((t) => ({ value: t, label: grammarLabel(language, t) })),
      answered: attempt.answers.map((a) => a.index),
    };
  }

  /** Languages with a lesson left unfinished, for the language switcher. */
  openLanguages(user: User): Promise<string[]> {
    return LessonAttempt.distinct("language", { userId: user._id, completedAt: { $exists: false }, abandonedAt: { $exists: false } });
  }

  /** Flags an exercise as wrong: it stops counting for the score, weak points and mistakes. */
  async report(user: User, attemptId: string, index: number) {
    const attempt = await LessonAttempt.findOne({ _id: attemptId, userId: user._id });
    if (!attempt) throw Object.assign(new Error("Attempt not found"), { status: 404 });
    const lesson = await Lesson.findById(attempt.lessonId).lean();
    const q = lesson?.questions?.[index];
    if (!q) throw Object.assign(new Error("Question not found"), { status: 404 });

    const entry = attempt.answers.find((a) => a.index === index);
    if (entry) entry.reported = true;
    else attempt.answers.push({ index, answer: null, correct: false, score: 0, reported: true, chat: [] } as any);
    attempt.markModified("answers");
    await attempt.save();
    if (q.exerciseId) await Exercise.updateOne({ _id: q.exerciseId }, { reported: true });
    logger.info(`[lesson] reported by the learner: "${q.prompt}"`);
  }

  /** Checks one exercise and stores the result. */
  async answer(user: User, attemptId: string, index: number, answer: unknown) {
    const attempt = await LessonAttempt.findOne({ _id: attemptId, userId: user._id });
    if (!attempt) throw Object.assign(new Error("Attempt not found"), { status: 404 });
    const lesson = await Lesson.findById(attempt.lessonId).lean();
    const q = lesson?.questions?.[index];
    if (!lesson || !q) throw Object.assign(new Error("Question not found"), { status: 404 });

    let correct = false;
    let score = 0;
    let feedback: string | undefined;
    switch (q.type) {
      case "choice":
      case "fillBlank":
        correct = Number(answer) === q.answerIndex;
        break;
      case "order":
        if (Array.isArray(answer)) {
          const given = norm(answer.join(" "));
          correct = given === norm((q.answerTokens ?? []).join(" ")) || (q.altAnswers ?? []).includes(given);
        }
        break;
      case "findError":
        correct = Number(answer) === q.errorIndex;
        break;
      case "match": {
        const mistakes = Math.max(0, Number((answer as any)?.mistakes) || 0);
        score = Math.max(0, 1 - mistakes * 0.2);
        correct = mistakes === 0;
        break;
      }
      case "translate": {
        const graded = await gradeTranslation({
          prompt: q.prompt,
          reference: q.reference ?? "",
          answer: String(answer ?? ""),
          language: lesson.language,
          explainsLanguage: user.explainsLanguage ?? "es",
          level: lesson.level,
        });
        score = graded.score;
        feedback = graded.feedback;
        correct = score >= 0.8;
        break;
      }
    }
    if (q.type !== "match" && q.type !== "translate") score = correct ? 1 : 0;

    const entry = { index, answer, correct, score, feedback, chat: [] };
    const i = attempt.answers.findIndex((a) => a.index === index);
    if (i >= 0) attempt.answers[i] = entry as any;
    else attempt.answers.push(entry as any);
    await attempt.save();
    return { correct, score, feedback };
  }

  async finish(user: User, attemptId: string) {
    const attempt = await LessonAttempt.findOne({ _id: attemptId, userId: user._id });
    if (!attempt) throw Object.assign(new Error("Attempt not found"), { status: 404 });
    const lesson = await Lesson.findById(attempt.lessonId).lean();
    const counted = attempt.answers.filter((a) => !a.reported);
    const reported = attempt.answers.length - counted.length;
    const total = (lesson?.questions?.length ?? attempt.answers.length) - reported;
    const sum = counted.reduce((n, a) => n + a.score, 0);
    const correct = counted.filter((a) => a.correct).length;
    const score = total ? Math.round((sum / total) * 100) : 0;
    const xp = Math.round(sum * 2) + (score === 100 ? 5 : 0);
    attempt.score = score;
    attempt.xp = xp;
    attempt.completedAt = new Date();
    await attempt.save();
    return { score, xp, correct, total };
  }

  /** Bruno explains one exercise; the conversation is saved on the answer. */
  async chat(user: User, attemptId: string, index: number, message: string) {
    const attempt = await LessonAttempt.findOne({ _id: attemptId, userId: user._id });
    if (!attempt) throw Object.assign(new Error("Attempt not found"), { status: 404 });
    const lesson = await Lesson.findById(attempt.lessonId).lean();
    const q = lesson?.questions?.[index];
    if (!lesson || !q) throw Object.assign(new Error("Question not found"), { status: 404 });
    const ans = attempt.answers.find((a) => a.index === index);

    const show = (v: unknown): string => {
      if (q.type === "choice" || q.type === "fillBlank") return q.options?.[Number(v)] ?? String(v);
      if (q.type === "findError") return q.tokens?.[Number(v)] ?? String(v);
      if (Array.isArray(v)) return v.join(" ");
      return typeof v === "string" ? v : JSON.stringify(v);
    };
    const correctAnswer =
      q.type === "choice" || q.type === "fillBlank"
        ? q.options?.[q.answerIndex ?? 0] ?? ""
        : q.type === "order"
          ? (q.answerTokens ?? []).join(" ")
          : q.type === "findError"
            ? `${q.tokens?.[q.errorIndex ?? 0]} → ${q.correction}`
            : q.type === "translate"
              ? q.reference ?? ""
              : (q.pairs ?? []).map((p) => `${p.left} = ${p.right}`).join(", ");

    const history = (ans?.chat ?? []) as Array<{ role: "user" | "assistant"; content: string }>;
    const stream = await streamQuestionChat(
      {
        language: lesson.language,
        explainsLanguage: user.explainsLanguage ?? "es",
        level: lesson.level,
        question: `${q.type}: ${q.prompt}${q.options ? ` (options: ${q.options.join(" / ")})` : ""}`,
        correctAnswer,
        learnerAnswer: ans ? show(ans.answer) : "(not answered)",
        wasCorrect: !!ans?.correct,
        explanation: q.explanation,
      },
      history,
      message,
    );

    const save = async (reply: string) => {
      const fresh = await LessonAttempt.findById(attemptId);
      const a = fresh?.answers.find((x) => x.index === index);
      if (!fresh || !a) return;
      a.chat = [...(a.chat ?? []), { role: "user", content: message }, { role: "assistant", content: reply }];
      fresh.markModified("answers");
      await fresh.save();
    };
    return { stream, save };
  }

  async chatHistory(user: User, attemptId: string, index: number) {
    const attempt = await LessonAttempt.findOne({ _id: attemptId, userId: user._id }).lean();
    return attempt?.answers?.find((a) => a.index === index)?.chat ?? [];
  }
}

export default new LessonService();
