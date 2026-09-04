import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/min";

import type {
  ColumnMapping,
  DateFormat,
  ParseResult,
  RawMember,
} from "./types";

/**
 * Turning one row of a gym's export into a member.
 *
 * Pure functions, no database, no framework. This is the code that decides what
 * a member's last visit date actually is, and every lapse calculation and
 * every campaign audience is built on top of it. It is unit tested in csv.test.ts
 * for that reason.
 */

/** Deliberately permissive, matching the waitlist. Rejecting a real address costs a member. */
const EMAIL_RE = /^[^\s@]+@[^\s@,]+\.[^\s@,]{2,}$/;

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isRealDate(year: number, month: number, day: number): boolean {
  if (year < 1900 || year > 2200) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1) return false;

  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const max = month === 2 && !leap ? 28 : DAYS_IN_MONTH[month - 1];
  return day <= max;
}

function iso(year: number, month: number, day: number): string {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

/**
 * Parses a date in the format the gym told us their file uses.
 *
 * Returns null rather than throwing: a bad date is a skipped row with a
 * readable reason, not a failed import.
 */
export function parseDate(
  value: string,
  format: DateFormat,
): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  // Exports frequently carry a time, and sometimes a timezone. Everything after
  // the date part is noise for our purposes: a visit is a day, not a moment.
  const datePart = trimmed.split(/[T\s]/)[0];

  // ISO is tried FIRST, whatever the gym chose, because it cannot be read any
  // other way: the four-digit year pins the order, so there is nothing for the
  // day/month setting to disambiguate. Gating it behind that setting made the
  // most common export format in the world fail by default — a file of plain
  // 2024-11-12 dates reported every row as "could not read as a date" unless
  // the gym happened to switch to Year first, and nothing on screen said so.
  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(datePart);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    const year = Number(y);
    const month = Number(m);
    const day = Number(d);
    return isRealDate(year, month, day) ? iso(year, month, day) : null;
  }

  // "Year first" means ISO and only ISO, so a non-ISO value under that setting
  // is genuinely unreadable rather than something to guess at.
  if (format === "iso") return null;

  const match = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|\d{4})$/.exec(datePart);
  if (!match) return null;

  const [, first, second, rawYear] = match;
  const day = format === "dmy" ? Number(first) : Number(second);
  const month = format === "dmy" ? Number(second) : Number(first);

  // A two-digit year is ambiguous forever. Member records are historical, so
  // a year that would land in the future is read as the previous century.
  let year = Number(rawYear);
  if (rawYear.length === 2) {
    const century = Math.floor(new Date().getFullYear() / 100) * 100;
    year = century + year;
    if (year > new Date().getFullYear()) year -= 100;
  }

  return isRealDate(year, month, day) ? iso(year, month, day) : null;
}

/**
 * A gym's export writes phone numbers the way the front desk dials them: local
 * format ("07700 900123"), not E.164 ("+447700900123"). Numbers are normalised
 * to E.164 at import so storage stays consistent whatever the source file's
 * formatting, using the gym's own country as the default region.
 *
 * Falls back to the trimmed raw value when it cannot be parsed: a phone number
 * that will not resolve to E.164 still gets stored (better than losing the row)
 * rather than blocking the import the way a bad required date does.
 */
export function normalizePhoneForCountry(
  raw: string,
  defaultCountry: string,
): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;

  const parsed = parsePhoneNumberFromString(trimmed, {
    defaultCountry: defaultCountry as CountryCode,
  });
  // isPossible (structurally a phone number) rather than isValid (matches an
  // actually-assigned range): a gym's real member may well carry a
  // number in a newer or less common range that the library's static
  // allocation tables do not recognise yet. Either way it is not casdey's
  // place to decide a member's own number is not real.
  return parsed?.isPossible() ? parsed.number : trimmed;
}

function cell(row: Record<string, string>, column?: string): string {
  if (!column) return "";
  return (row[column] ?? "").trim();
}

/** Splits "Jane Okafor" into parts. Last token is the surname, rest is the given name. */
function splitName(full: string): { first: string | null; last: string | null } {
  const parts = full.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: null, last: null };
  if (parts.length === 1) return { first: parts[0], last: null };
  return {
    first: parts.slice(0, -1).join(" "),
    last: parts[parts.length - 1],
  };
}

export function normalizeRow(
  row: Record<string, string>,
  mapping: ColumnMapping,
  dateFormat: DateFormat,
  rowNumber: number,
  /** The gym's country, used to read a local-format phone number.
   *  Omitted in the client-side preview, which never displays phone. */
  defaultCountry?: string,
): ParseResult {
  const issue = (field: string, reason: string): ParseResult => ({
    ok: false,
    issue: { row: rowNumber, field, reason },
  });

  const rawDate = cell(row, mapping.lastVisitAt);
  if (!rawDate) return issue("lastVisitAt", "No last visit date");

  const lastVisitAt = parseDate(rawDate, dateFormat);
  if (!lastVisitAt) {
    return issue("lastVisitAt", `Could not read "${rawDate}" as a date`);
  }

  // A visit that has not happened yet is a data error, not a lapsed member.
  // Tomorrow is allowed, to absorb timezone drift in the export.
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  if (lastVisitAt > tomorrow) {
    return issue("lastVisitAt", `Last visit is in the future (${lastVisitAt})`);
  }

  const rawEmail = cell(row, mapping.email).toLowerCase();
  let email: string | null = null;
  if (rawEmail) {
    if (!EMAIL_RE.test(rawEmail) || rawEmail.length > 320) {
      return issue("email", `"${rawEmail}" is not a usable email address`);
    }
    email = rawEmail;
  }

  const externalRef = cell(row, mapping.externalRef) || null;

  // Without one of these there is no way to identify the member on a repeat
  // import, and no way to contact them. The row is not worth storing.
  if (!email && !externalRef) {
    return issue("email", "No email address and no member reference");
  }

  let first: string | null = cell(row, mapping.firstName) || null;
  let last: string | null = cell(row, mapping.lastName) || null;
  if (!first && !last && mapping.fullName) {
    const split = splitName(cell(row, mapping.fullName));
    first = split.first;
    last = split.last;
  }

  // At least one, because a member who came once still counts as having come.
  let visitCount = 1;
  const rawVisits = cell(row, mapping.visitCount);
  if (rawVisits) {
    const parsed = Number.parseInt(rawVisits.replace(/[^\d-]/g, ""), 10);
    if (Number.isNaN(parsed) || parsed < 0) {
      return issue("visitCount", `Could not read "${rawVisits}" as a number`);
    }
    visitCount = Math.max(1, parsed);
  }

  const rawPhone = cell(row, mapping.phone);
  const phone = rawPhone
    ? (defaultCountry ? normalizePhoneForCountry(rawPhone, defaultCountry) : rawPhone).slice(0, 40)
    : null;

  const member: RawMember = {
    externalRef,
    firstName: first ? first.slice(0, 120) : null,
    lastName: last ? last.slice(0, 120) : null,
    email,
    phone,
    lastVisitAt,
    visitCount,
    sourceRow: rowNumber,
  };

  return { ok: true, member };
}

/**
 * Best guess at which column is which, offered as a starting point in the UI.
 * Always shown to the gym for confirmation, never applied silently.
 */
// [\s_-]* rather than \s* on purpose: CSV exports as often write these
// headers as "first_name" or "first-name" (snake/kebab case) as "First Name"
// (space-separated), and a plain \s* only matched the latter.
// Column names are drawn from real member exports across the target platforms:
// Mindbody ("Client ID", "Last Visit"), Glofox ("Member ID", "Last Booking"),
// TeamUp ("Customer", "Last attended"), ABC Fitness ("Last Check-In",
// "Total Check-Ins"), plus generic snake_case. A gym confirms the guess before
// anything is written, so the patterns lean towards catching a column rather
// than leaving it blank.
const HINTS: { field: keyof ColumnMapping; patterns: RegExp[] }[] = [
  { field: "externalRef", patterns: [/^((member|client|customer|contact)[\s_-]*)?(id|ref|reference|number|no)$/i, /(member|client|customer).*(id|ref)/i] },
  { field: "firstName", patterns: [/^(first|given|fore)[\s_-]*name$/i, /^first$/i] },
  { field: "lastName", patterns: [/^(last|sur|family)[\s_-]*name$/i, /^surname$/i, /^last$/i] },
  { field: "fullName", patterns: [/^(full[\s_-]*)?name$/i, /^(member|customer|client)([\s_-]*name)?$/i] },
  { field: "email", patterns: [/e-?mail/i] },
  { field: "phone", patterns: [/phone|mobile|tel|cell/i] },
  { field: "lastVisitAt", patterns: [/last.*(visit|booking|seen|attend|check|class)/i, /(visit|booking|attend|check|class).*date/i, /^date$/i] },
  { field: "visitCount", patterns: [/visit.*(count|s\b)/i, /(number|no|total).*(visit|attend|check|class)/i, /(attend|check).*(count|s\b)/i, /^(visits|attendances|check-?ins|classes)$/i] },
];

export function guessMapping(headers: string[]): Partial<ColumnMapping> {
  const guess: Partial<ColumnMapping> = {};
  const taken = new Set<string>();

  for (const { field, patterns } of HINTS) {
    for (const pattern of patterns) {
      const match = headers.find(
        (header) => !taken.has(header) && pattern.test(header.trim()),
      );
      if (match) {
        guess[field] = match;
        taken.add(match);
        break;
      }
    }
  }

  // Two name columns beat one combined column when both were matched.
  if (guess.firstName && guess.lastName) delete guess.fullName;

  return guess;
}
