/**
 * DTO mappers — explicit whitelist of fields returned by each entity.
 * Protects against future sensitive fields being auto-exposed via API responses.
 * Apply to every successResponse that returns a DB document.
 */

const plain = (doc: any) => (doc?.toObject ? doc.toObject() : doc);

// ─── User ─────────────────────────────────────────────────────────────────────

export const toUserDTO = (doc: any) => {
  if (!doc) return null;
  const d = plain(doc);
  return {
    _id: d._id,
    username: d.username,
    email: d.email,
    role: d.role,
    firstName: d.firstName,
    lastName: d.lastName,
    image: d.image,
    language: d.language,
    explainsLanguage: d.explainsLanguage,
    isActive: d.isActive,
    address: d.address,
    phone: d.phone,
    lastLogin: d.lastLogin,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
};

// ─── Word ─────────────────────────────────────────────────────────────────────

export const toWordDTO = (doc: any) => {
  if (!doc) return null;
  const d = plain(doc);
  return {
    _id: d._id,
    word: d.word,
    language: d.language,
    definition: d.definition,
    examples: d.examples,
    synonyms: d.synonyms,
    type: d.type,
    IPA: d.IPA,
    seen: d.seen,
    img: d.img,
    difficulty: d.difficulty,
    codeSwitching: d.codeSwitching,
    spanish: d.spanish,
    chat: d.chat,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
};

// ─── Lecture ──────────────────────────────────────────────────────────────────

export const toLectureDTO = (doc: any) => {
  if (!doc) return null;
  const d = plain(doc);
  return {
    _id: d._id,
    time: d.time,
    difficulty: d.difficulty,
    typeWrite: d.typeWrite,
    language: d.language,
    urlAudio: d.urlAudio,
    audioRecordId: d.audioRecordId,
    voice: d.voice,
    img: d.img,
    content: d.content,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
};

// ─── Expression ───────────────────────────────────────────────────────────────

export const toExpressionDTO = (doc: any) => {
  if (!doc) return null;
  const d = plain(doc);
  return {
    _id: d._id,
    expression: d.expression,
    language: d.language,
    definition: d.definition,
    examples: d.examples,
    type: d.type,
    context: d.context,
    img: d.img,
    difficulty: d.difficulty,
    spanish: d.spanish,
    chat: d.chat,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
};

// ─── Exam ─────────────────────────────────────────────────────────────────────

export const toExamDTO = (doc: any) => {
  if (!doc) return null;
  const d = plain(doc);
  return {
    _id: d._id,
    title: d.title,
    language: d.language,
    difficulty: d.difficulty,
    grammarTopics: d.grammarTopics,
    topic: d.topic,
    questions: d.questions,
    createdBy: d.createdBy,
    attemptCount: d.attemptCount,
    bestScore: d.bestScore,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
};

// ─── ExamAttempt ──────────────────────────────────────────────────────────────

export const toAttemptDTO = (doc: any) => {
  if (!doc) return null;
  const d = plain(doc);
  return {
    _id: d._id,
    examId: d.examId,
    userId: d.userId,
    score: d.score,
    startedAt: d.startedAt,
    completedAt: d.completedAt,
    attemptQuestions: d.attemptQuestions,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
};

// ─── Story ─────────────────────────────────────────────────────────────────────

export const toStoryDTO = (doc: any) => {
  if (!doc) return null;
  const d = plain(doc);
  return {
    _id: d._id,
    title: d.title,
    description: d.description,
    img: d.img,
    languageLevel: d.languageLevel,
    targetVocabulary: d.targetVocabulary,
    targetGrammar: d.targetGrammar,
    genre: d.genre,
    chapters: (d.chapters || []).map((ch: any) => ({
      order: ch.order,
      title: ch.title,
      content: ch.content,
      urlAudio: ch.urlAudio,
      audioRecordId: ch.audioRecordId,
      voice: ch.voice,
      createdAt: ch.createdAt,
    })),
    userId: d.userId,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
};

// ─── Paginated helper ─────────────────────────────────────────────────────────

export const mapPaginated = <T>(
  result: { data: any[]; total: number; page?: number; pages?: number },
  mapper: (doc: any) => T
) => ({
  data: result.data.map(mapper),
  total: result.total,
  ...(result.page !== undefined && { page: result.page }),
  ...(result.pages !== undefined && { pages: result.pages }),
});
