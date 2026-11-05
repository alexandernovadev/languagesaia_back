/**
 * Exams (Bruno) — Duolingo-style practices, one exercise at a time.
 *
 * createPractice  quick (your weak topics + your words) | topic (you pick) | mistakes (redo what you failed)
 * answer          checks one exercise right away (AI only for free translations) and stores it
 * finish          final score + XP
 * stats           accuracy per grammar topic (weak points) + recent practices
 * chat            "¿Por qué?" — Bruno explains an exercise (streamed)
 */
import { Types } from "mongoose";
import Exam from "../../db/models/Exam";
import ExamAttempt from "../../db/models/ExamAttempt";
import Word from "../../db/models/Word";
import { grammarCatalog, grammarLabel } from "../../data/business/shared/grammar";
import { generateExercises, gradeTranslation, streamQuestionChat } from "../ai/examAIService";
import type { GeneratedType } from "../ai/prompts/exams/examPrompts";
import { IExamQuestion, ExamMode } from "../../../../types/models";
import logger from "../../utils/logger";

type User = { _id: string | Types.ObjectId; language?: string; explainsLanguage?: string };

/** Exams from the old format (before the redesign) are ignored. */
const TYPES = new Set(["choice", "fillBlank", "order", "translate", "match", "findError"]);
const isCurrent = (q?: IExamQuestion) => !!q && TYPES.has(q.type);

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

/** Exercise types per practice length (match is added separately from the user's words). */
const PLAN: GeneratedType[] = ["choice", "fillBlank", "order", "translate", "findError", "choice", "order", "fillBlank", "translate", "findError", "choice", "fillBlank", "order", "findError", "choice", "translate", "fillBlank", "order", "choice", "findError"];

/** Turns raw AI output into a clean, checkable exercise (or null if it's broken). */
function normalize(raw: any): IExamQuestion | null {
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
async function buildMatch(language: string): Promise<IExamQuestion | null> {
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

export class ExamService {
  catalog(language: string) {
    return grammarCatalog(language);
  }

  /** Accuracy per grammar topic from all finished practices (weakest first). */
  async stats(user: User) {
    const language = user.language ?? "en";
    const attempts = await ExamAttempt.find({ userId: user._id, language, completedAt: { $exists: true } })
      .sort({ createdAt: -1 })
      .limit(60)
      .populate("examId", "questions title mode level")
      .lean();
    const byTopic = new Map<string, { seen: number; score: number }>();
    for (const a of attempts as any[]) {
      const qs: IExamQuestion[] = a.examId?.questions ?? [];
      for (const ans of a.answers ?? []) {
        const topic = isCurrent(qs[ans.index]) ? qs[ans.index].grammarTopic : undefined;
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
    const recent = (attempts as any[]).filter((a) => isCurrent(a.examId?.questions?.[0])).slice(0, 10).map((a) => ({
      _id: a._id,
      title: a.examId?.title ?? "Práctica",
      mode: a.examId?.mode,
      level: a.examId?.level,
      score: a.score,
      xp: a.xp,
      completedAt: a.completedAt,
    }));
    const mistakes = (attempts as any[]).reduce(
      (n, a) => n + (a.answers ?? []).filter((x: any) => !x.correct && isCurrent(a.examId?.questions?.[x.index]) && a.examId.questions[x.index].type !== "match").length,
      0,
    );
    return { topics, recent, mistakes };
  }

  async createPractice(user: User, input: { mode: ExamMode; level?: string; grammarTopics?: string[]; count?: number }) {
    const language = user.language ?? "en";
    const explainsLanguage = user.explainsLanguage ?? "es";
    const level = input.level ?? "B1";
    let questions: IExamQuestion[] = [];
    let title = "";
    let topics: string[] = input.grammarTopics ?? [];

    if (input.mode === "mistakes") {
      const attempts = await ExamAttempt.find({ userId: user._id, language, completedAt: { $exists: true } })
        .sort({ createdAt: -1 })
        .limit(30)
        .populate("examId", "questions")
        .lean();
      const seen = new Set<string>();
      for (const a of attempts as any[]) {
        for (const ans of a.answers ?? []) {
          const q = a.examId?.questions?.[ans.index];
          if (!ans.correct && isCurrent(q) && q.type !== "match" && !seen.has(q.prompt)) {
            seen.add(q.prompt);
            questions.push(q);
          }
        }
      }
      questions = shuffle(questions).slice(0, input.count ?? 10);
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
      const plan = PLAN.slice(0, aiCount);
      const vocabulary = input.mode === "quick" ? await vocabularyFor(language) : [];
      const raw = await generateExercises({
        language,
        explainsLanguage,
        level,
        topics: topics.map((t) => `${t}: ${grammarLabel(language, t)}`),
        plan,
        vocabulary,
      });
      // the AI sometimes writes the topic label instead of its value: map it back
      const lookup = new Map<string, string>();
      for (const t of grammarCatalog(language).flatMap((g) => g.topics)) {
        lookup.set(norm(t.value), t.value);
        lookup.set(norm(t.label), t.value);
      }
      const fixTopic = (q: IExamQuestion) => ({ ...q, grammarTopic: q.grammarTopic ? lookup.get(norm(q.grammarTopic)) ?? topics[0] : topics[0] });
      questions = ((raw.questions ?? []).map(normalize).filter(Boolean) as IExamQuestion[]).map(fixTopic);
      if (questions.length < Math.ceil(aiCount / 2)) {
        logger.warn(`[exam] only ${questions.length}/${aiCount} valid exercises`);
        throw new Error("Bruno no pudo preparar la práctica. Inténtalo otra vez.");
      }
      if (match) questions.splice(Math.min(3, questions.length), 0, match);
      title = raw.title || (input.mode === "quick" ? "Práctica rápida" : "Examen");
    }

    const exam = await Exam.create({ title, mode: input.mode, language, level, grammarTopics: topics, questions, createdBy: user._id });
    const attempt = await ExamAttempt.create({ examId: exam._id, userId: user._id, language, answers: [] });
    return { exam: exam.toObject(), attemptId: attempt._id, topics: topics.map((t) => ({ value: t, label: grammarLabel(language, t) })) };
  }

  /** Checks one exercise and stores the result. */
  async answer(user: User, attemptId: string, index: number, answer: unknown) {
    const attempt = await ExamAttempt.findOne({ _id: attemptId, userId: user._id });
    if (!attempt) throw Object.assign(new Error("Attempt not found"), { status: 404 });
    const exam = await Exam.findById(attempt.examId).lean();
    const q = exam?.questions?.[index];
    if (!exam || !q) throw Object.assign(new Error("Question not found"), { status: 404 });

    let correct = false;
    let score = 0;
    let feedback: string | undefined;
    switch (q.type) {
      case "choice":
      case "fillBlank":
        correct = Number(answer) === q.answerIndex;
        break;
      case "order":
        correct = Array.isArray(answer) && norm((answer as string[]).join(" ")) === norm((q.answerTokens ?? []).join(" "));
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
          language: exam.language,
          explainsLanguage: user.explainsLanguage ?? "es",
          level: exam.level,
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
    const attempt = await ExamAttempt.findOne({ _id: attemptId, userId: user._id });
    if (!attempt) throw Object.assign(new Error("Attempt not found"), { status: 404 });
    const exam = await Exam.findById(attempt.examId).lean();
    const total = exam?.questions?.length ?? attempt.answers.length;
    const sum = attempt.answers.reduce((n, a) => n + a.score, 0);
    const correct = attempt.answers.filter((a) => a.correct).length;
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
    const attempt = await ExamAttempt.findOne({ _id: attemptId, userId: user._id });
    if (!attempt) throw Object.assign(new Error("Attempt not found"), { status: 404 });
    const exam = await Exam.findById(attempt.examId).lean();
    const q = exam?.questions?.[index];
    if (!exam || !q) throw Object.assign(new Error("Question not found"), { status: 404 });
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
        language: exam.language,
        explainsLanguage: user.explainsLanguage ?? "es",
        level: exam.level,
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
      const fresh = await ExamAttempt.findById(attemptId);
      const a = fresh?.answers.find((x) => x.index === index);
      if (!fresh || !a) return;
      a.chat = [...(a.chat ?? []), { role: "user", content: message }, { role: "assistant", content: reply }];
      fresh.markModified("answers");
      await fresh.save();
    };
    return { stream, save };
  }

  async chatHistory(user: User, attemptId: string, index: number) {
    const attempt = await ExamAttempt.findOne({ _id: attemptId, userId: user._id }).lean();
    return attempt?.answers?.find((a) => a.index === index)?.chat ?? [];
  }
}

export default new ExamService();
