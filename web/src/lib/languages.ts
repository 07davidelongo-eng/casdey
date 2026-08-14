/**
 * The languages a practice can write a campaign in.
 *
 * casdey sells into the UK and Ireland plus the EU countries the outreach has
 * reached, so the message needs to go out in the patient's own language, not
 * only English. The default follows the practice's country, the same way the
 * billing currency does, but the practice can override it per campaign.
 */

export type LanguageCode = "en" | "nl" | "de" | "fr" | "es" | "pt" | "it";

export const LANGUAGES: { code: LanguageCode; label: string; endonym: string }[] = [
  { code: "en", label: "English", endonym: "English" },
  { code: "nl", label: "Dutch", endonym: "Nederlands" },
  { code: "de", label: "German", endonym: "Deutsch" },
  { code: "fr", label: "French", endonym: "Français" },
  { code: "es", label: "Spanish", endonym: "Español" },
  { code: "pt", label: "Portuguese", endonym: "Português" },
  { code: "it", label: "Italian", endonym: "Italiano" },
];

export function isLanguageCode(value: unknown): value is LanguageCode {
  return typeof value === "string" && LANGUAGES.some((l) => l.code === value);
}

export function languageLabel(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.label ?? code;
}

/** The name of the language, in the language itself, for the model to write in. */
export function languageEndonym(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.endonym ?? "English";
}

/**
 * The language a practice most likely writes to its patients in, from its
 * country. A starting point the practice can change, not a rule. Belgium is
 * split, and French is the safer default for a dental practice there.
 */
const COUNTRY_LANGUAGE: Record<string, LanguageCode> = {
  GB: "en",
  IE: "en",
  NL: "nl",
  DE: "de",
  AT: "de",
  FR: "fr",
  BE: "fr",
  ES: "es",
  PT: "pt",
  IT: "it",
};

export function languageForCountry(country: string): LanguageCode {
  return COUNTRY_LANGUAGE[country] ?? "en";
}
