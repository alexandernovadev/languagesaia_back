import { languagesJson } from "../../../data/business/shared";

const LABEL_MAP = Object.fromEntries(
  languagesJson.map((l) => [l.value, l.promptLabel])
);

export const getLangLabel = (code: string): string =>
  LABEL_MAP[code] || "English";

/** Extra rules for languages with a regional variant we care about. */
const VARIANT_RULES: Record<string, string> = {
  en: `American English only, in spelling and vocabulary: "color", "apartment", "movie", "vacation", "truck". Never British forms such as "colour", "flat", "film" or "holiday".`,
  pt: `Brazilian Portuguese only, as spoken in Brazil today: "você" instead of "tu", "estava fazendo" instead of "estava a fazer", "ônibus", "celular", "café da manhã". Never European forms such as "estiveste", "fizeste", "tens feito" or "autocarro".`,
};

export const getVariantRules = (code: string): string => VARIANT_RULES[code] ?? "";
