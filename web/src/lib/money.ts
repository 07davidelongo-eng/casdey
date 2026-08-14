import { currencyFor, type Currency } from "./countries";
import type { Practice } from "./types";

/**
 * Money, in one place.
 *
 * casdey stores every amount as an integer number of minor units (pence or
 * cents), so there is never a floating-point rounding question about someone's
 * money. Formatting to a human string, and the one derived figure the product
 * cares about, revenue recovered, both live here so they cannot drift between
 * the settings form, the dashboard, and the guarantee.
 */

/**
 * A practice's currency. It follows the billing currency once that is set at
 * checkout, and the country before that, so pricing reads the same currency the
 * practice will be charged in.
 */
export function practiceCurrency(
  practice: Pick<Practice, "plan_currency" | "country">,
): Currency {
  return practice.plan_currency ?? currencyFor(practice.country);
}

const LOCALE: Record<Currency, string> = { gbp: "en-GB", eur: "en-IE" };
const CODE: Record<Currency, string> = { gbp: "GBP", eur: "EUR" };

/**
 * Minor units to a display string: 125000 gbp -> "£1,250". A round amount is
 * shown without a decimal part, because "£1,250.00" reads like a system talking
 * and "£1,250" reads like a person; a non-round amount keeps both digits.
 */
export function formatMoney(minor: number, currency: Currency): string {
  const major = minor / 100;
  const whole = Number.isInteger(major);
  return new Intl.NumberFormat(LOCALE[currency], {
    style: "currency",
    currency: CODE[currency],
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(major);
}

export function currencySymbol(currency: Currency): string {
  return currency === "gbp" ? "£" : "€";
}

/**
 * The revenue estimate: patients rebooked times the practice's typical
 * recovered-appointment value. Null when there is no value to multiply by, so
 * callers show a prompt to set one rather than a confident "£0".
 *
 * Deliberately an estimate, not billed amounts: casdey does not yet know the
 * exact treatment each returning patient booked, so it values them all at the
 * practice's own typical figure and says so wherever the number appears.
 */
export function estimatedRecoveredMinor(
  rebooked: number,
  appointmentValueMinor: number | null,
): number | null {
  if (!appointmentValueMinor || appointmentValueMinor <= 0) return null;
  return rebooked * appointmentValueMinor;
}
