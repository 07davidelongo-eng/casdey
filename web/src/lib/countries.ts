/**
 * The markets casdey sells into: the UK and Ireland, plus the EU countries the
 * outreach has already reached. Currency follows the country, because that is
 * what a gym expects to be billed in, and it is the only thing the country
 * decides.
 */

export type CountryCode =
  | "GB"
  | "IE"
  | "NL"
  | "DE"
  | "PT"
  | "ES"
  | "FR"
  | "IT"
  | "BE"
  | "AT";

export type Currency = "gbp" | "eur";

export const COUNTRIES: {
  code: CountryCode;
  name: string;
  timezone: string;
}[] = [
  { code: "GB", name: "United Kingdom", timezone: "Europe/London" },
  { code: "IE", name: "Ireland", timezone: "Europe/Dublin" },
  { code: "NL", name: "Netherlands", timezone: "Europe/Amsterdam" },
  { code: "DE", name: "Germany", timezone: "Europe/Berlin" },
  { code: "BE", name: "Belgium", timezone: "Europe/Brussels" },
  { code: "FR", name: "France", timezone: "Europe/Paris" },
  { code: "ES", name: "Spain", timezone: "Europe/Madrid" },
  { code: "PT", name: "Portugal", timezone: "Europe/Lisbon" },
  { code: "IT", name: "Italy", timezone: "Europe/Rome" },
  { code: "AT", name: "Austria", timezone: "Europe/Vienna" },
];

export function isCountryCode(value: unknown): value is CountryCode {
  return (
    typeof value === "string" && COUNTRIES.some((c) => c.code === value)
  );
}

/** The UK bills in pounds. Everywhere else casdey sells bills in euros. */
export function currencyFor(country: string): Currency {
  return country === "GB" ? "gbp" : "eur";
}

export function timezoneFor(country: string): string {
  return COUNTRIES.find((c) => c.code === country)?.timezone ?? "Europe/London";
}

export function countryName(country: string): string {
  return COUNTRIES.find((c) => c.code === country)?.name ?? country;
}
