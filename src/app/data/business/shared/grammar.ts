/**
 * Grammar catalog per learning language, with Spanish labels for the UI and a
 * suggested CEFR level. Used to build exams and to track weak points.
 * Languages without their own catalog use GENERIC.
 */
export interface GrammarTopic {
  value: string;
  label: string;
  level: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
}
export interface GrammarGroup {
  value: string;
  label: string;
  topics: GrammarTopic[];
}

const t = (value: string, label: string, level: GrammarTopic["level"]): GrammarTopic => ({ value, label, level });

const EN: GrammarGroup[] = [
  { value: "sentence-basics", label: "La frase", topics: [t("word-order", "Orden de las palabras", "A1"), t("questions", "Preguntas", "A1"), t("negation", "Negación", "A1")] },
  {
    value: "nouns-pronouns",
    label: "Sustantivos y pronombres",
    topics: [t("countable-uncountable", "Contables e incontables", "A2"), t("articles", "Artículos (a, an, the)", "A1"), t("pronouns", "Pronombres", "A1"), t("possessives", "Posesivos", "A1")],
  },
  {
    value: "adjectives-adverbs",
    label: "Adjetivos y adverbios",
    topics: [t("adjectives", "Adjetivos", "A1"), t("comparatives-superlatives", "Comparativos y superlativos", "A2"), t("adverbs", "Adverbios", "A2"), t("intensifiers", "Intensificadores", "B1")],
  },
  {
    value: "verbs-tenses",
    label: "Tiempos verbales",
    topics: [
      t("present-simple", "Present simple", "A1"),
      t("present-continuous", "Present continuous", "A1"),
      t("past-simple", "Past simple", "A2"),
      t("past-continuous", "Past continuous", "A2"),
      t("present-perfect", "Present perfect", "B1"),
      t("past-perfect", "Past perfect", "B1"),
      t("future-forms", "Futuro (will, going to)", "A2"),
      t("future-continuous", "Future continuous", "B2"),
      t("future-perfect", "Future perfect", "B2"),
    ],
  },
  {
    value: "special-verbs",
    label: "Verbos especiales",
    topics: [
      t("modal-verbs", "Verbos modales", "A2"),
      t("past-modals", "Modales en pasado", "B2"),
      t("phrasal-verbs", "Phrasal verbs", "B1"),
      t("conditionals", "Condicionales", "B1"),
      t("passive-voice", "Voz pasiva", "B1"),
      t("reported-speech", "Estilo indirecto", "B2"),
    ],
  },
  {
    value: "sentence-structure",
    label: "Estructura de la frase",
    topics: [t("relative-clauses", "Oraciones de relativo", "B1"), t("conjunctions", "Conectores", "A2"), t("prepositions", "Preposiciones", "A2"), t("prepositions-of-time", "Preposiciones de tiempo", "A2")],
  },
  {
    value: "advanced",
    label: "Avanzado",
    topics: [
      t("gerunds-infinitives", "Gerundio e infinitivo", "B2"),
      t("wish-clauses", "Wish / If only", "B2"),
      t("mixed-conditionals", "Condicionales mixtos", "C1"),
      t("inversion", "Inversión", "C1"),
      t("cleft-sentences", "Frases escindidas (It was… who)", "C1"),
      t("discourse-markers", "Marcadores del discurso", "B2"),
    ],
  },
];

const PT: GrammarGroup[] = [
  { value: "sentence-basics", label: "La frase", topics: [t("word-order", "Orden de las palabras", "A1"), t("questions", "Preguntas", "A1"), t("negation", "Negación", "A1")] },
  {
    value: "nouns-pronouns",
    label: "Sustantivos y pronombres",
    topics: [t("gender-number", "Género y número", "A1"), t("articles", "Artículos y contracciones (no, da, pelo)", "A1"), t("pronouns", "Pronombres y colocación", "A2"), t("possessives", "Posesivos", "A1")],
  },
  {
    value: "adjectives-adverbs",
    label: "Adjetivos y adverbios",
    topics: [t("adjectives", "Adjetivos", "A1"), t("comparatives-superlatives", "Comparativos y superlativos", "A2"), t("adverbs", "Adverbios", "A2")],
  },
  {
    value: "verbs-tenses",
    label: "Tiempos verbales",
    topics: [
      t("present-indicative", "Presente do indicativo", "A1"),
      t("past-indicative", "Pretérito perfeito e imperfeito", "A2"),
      t("future-indicative", "Futuro (vou + infinitivo, futuro simple)", "A2"),
      t("conditional", "Futuro do pretérito (condicional)", "B1"),
      t("present-subjunctive", "Presente do subjuntivo", "B1"),
      t("past-subjunctive", "Pretérito do subjuntivo", "B2"),
      t("imperative", "Imperativo", "A2"),
      t("gerund", "Gerúndio (estar + -ndo)", "A2"),
      t("participle", "Particípio", "B1"),
    ],
  },
  {
    value: "special-verbs",
    label: "Verbos especiales",
    topics: [t("ser-estar", "Ser y estar", "A1"), t("ter-haver", "Ter y haver", "A2"), t("reflexive-verbs", "Verbos reflexivos", "A2"), t("passive-voice", "Voz pasiva", "B1"), t("reported-speech", "Estilo indirecto", "B2")],
  },
  {
    value: "sentence-structure",
    label: "Estructura de la frase",
    topics: [t("relative-clauses", "Oraciones de relativo", "B1"), t("conditional-clauses", "Oraciones condicionales (se)", "B1"), t("conjunctions", "Conectores", "A2"), t("prepositions", "Preposiciones", "A2")],
  },
  {
    value: "advanced",
    label: "Avanzado",
    topics: [t("subjunctive-uses", "Usos del subjuntivo", "B2"), t("personal-infinitive", "Infinitivo personal", "B2"), t("future-subjunctive", "Futuro do subjuntivo", "B2"), t("discourse-markers", "Marcadores del discurso", "B2")],
  },
];

const GENERIC: GrammarGroup[] = [
  { value: "sentence-basics", label: "La frase", topics: [t("word-order", "Orden de las palabras", "A1"), t("questions", "Preguntas", "A1"), t("negation", "Negación", "A1")] },
  { value: "nouns-pronouns", label: "Sustantivos y pronombres", topics: [t("articles", "Artículos", "A1"), t("gender-number", "Género y número", "A1"), t("pronouns", "Pronombres", "A2")] },
  { value: "verbs-tenses", label: "Tiempos verbales", topics: [t("present", "Presente", "A1"), t("past", "Pasado", "A2"), t("future", "Futuro", "A2"), t("conditional", "Condicional", "B1"), t("subjunctive", "Subjuntivo", "B2")] },
  { value: "sentence-structure", label: "Estructura de la frase", topics: [t("prepositions", "Preposiciones", "A2"), t("conjunctions", "Conectores", "A2"), t("relative-clauses", "Oraciones de relativo", "B1")] },
];

const CATALOG: Record<string, GrammarGroup[]> = { en: EN, pt: PT };

export const grammarCatalog = (language: string): GrammarGroup[] => CATALOG[language] ?? GENERIC;

/** value → label for a language (labels used in prompts, stats and UI). */
export const grammarLabel = (language: string, value: string): string =>
  grammarCatalog(language)
    .flatMap((g) => g.topics)
    .find((x) => x.value === value)?.label ?? value;
