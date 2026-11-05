import { ContentLanguage, Language } from "../../../../../types/business";

export interface LanguageOption {
  value: Language;
  label: string;
  /** English name for AI prompts (e.g. "Spanish", "English") */
  promptLabel: string;
}

const languagesJson: LanguageOption[] = [
  { value: "en", label: "Inglés", promptLabel: "American English" },
  { value: "es", label: "Español", promptLabel: "Spanish" },
  { value: "pt", label: "Portugués", promptLabel: "Brazilian Portuguese" },
  { value: "it", label: "Italiano", promptLabel: "Italian" },
  { value: "fr", label: "Francés", promptLabel: "French" },
];

const languagesList: Language[] = languagesJson.map((language) => language.value);

/** Study language (User.language): excludes Spanish; Spanish is used in explainsLanguage */
const contentLanguagesJson: LanguageOption[] = languagesJson.filter(
  (l) => l.value !== "es"
);
const contentLanguagesList: ContentLanguage[] = contentLanguagesJson.map(
  (l) => l.value as ContentLanguage
);

export { languagesJson, languagesList, contentLanguagesJson, contentLanguagesList };
