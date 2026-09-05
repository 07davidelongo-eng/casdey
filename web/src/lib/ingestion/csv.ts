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

  const rawPhone = cell(row, mapping.phone);
  const phone = rawPhone
    ? (defaultCountry ? normalizePhoneForCountry(rawPhone, defaultCountry) : rawPhone).slice(0, 40)
    : null;

  // One of these three, or there is no way to tell this member apart from any
  // other on a repeat import and no way to reach them.
  //
  // Phone counts. It did not until now, and the rule's old comment ("no way to
  // contact them") stopped being true the day WhatsApp came back as the Pro
  // channel: a member with a number and no email address is precisely who that
  // channel exists for, and dropping them at the door meant Pro could never
  // reach the people it was sold on. The field hint on the import screen has
  // always said a member without an email still counts. Now it does.
  if (!email && !externalRef && !phone) {
    return issue("email", "No email address, phone number or member reference");
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
  // "Bookings" belongs here as well as in lastVisitAt: Glofox counts in
  // bookings, and an export headed "Total Bookings" used to match nothing at
  // all. That is not a cosmetic miss. A member whose count is lost falls back
  // to a single visit, and the lapse rule is "no visit for N months AND at
  // most X visits", so a nine-class regular is filed next to someone who came
  // once and never came back, and casdey writes to the wrong people.
  // The second gap was word order: "Classes Attended" reads noun then verb,
  // where every pattern here expected "Total Classes".
  {
    field: "visitCount",
    patterns: [
      /^(visits?|bookings?|attendances?|check-?ins?|classes|sessions?)$/i,
      /(number|total|count|\bno\b)[\s_-]*(of[\s_-]*)?(visit|booking|attend|check|class|session)/i,
      /(visit|booking|attend|check|class|session)s?[\s_-]*(count|total|attended|completed|taken)/i,
      /(visit|booking|attend|check|class|session).*(count|s\b)/i,
    ],
  },
];

/**
 * Turns the uploaded bytes into text, whatever the gym's software wrote.
 *
 * A byte-order mark is the only reliable signal of a UTF-16 file, and Excel's
 * "Unicode Text" export writes exactly that. Without this the strict-UTF-8
 * attempt below throws, the Windows-1252 fallback catches it, and every header
 * comes back interleaved with NUL bytes, so the gym is shown a column list of
 * mojibake and no way forward.
 *
 * After that: strict UTF-8 first, because it is the common and correct case,
 * and Windows-1252 only when the bytes are not valid UTF-8. An older platform
 * or an Excel "CSV (MS-DOS)" export is Windows-1252, and a name like
 * "François" read as UTF-8 would import as "FranÃ§ois" and go out verbatim in
 * a live campaign.
 */
export function decodeCsv(bytes: Uint8Array): string {
  if (bytes.length >= 2) {
    const [a, b] = bytes;
    if (a === 0xff && b === 0xfe) {
      return new TextDecoder("utf-16le").decode(bytes.subarray(2));
    }
    if (a === 0xfe && b === 0xff) {
      return new TextDecoder("utf-16be").decode(bytes.subarray(2));
    }
  }

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    text = new TextDecoder("windows-1252").decode(bytes);
  }
  // A UTF-8 BOM would otherwise contaminate the first header name.
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * How many lines to drop before the header row.
 *
 * Exported reports often open with a title and a date range before the table
 * starts, which is what a person wants and what a parser cannot survive:
 * the first line becomes the header, so the whole file collapses into one
 * column called "Client Attendance Report" and every real column is lost.
 * The gym sees a single nonsense column and no way to continue.
 *
 * The header is taken to be the first line carrying at least two separated
 * values. A title line is one long cell; a date-range line usually is too.
 * Returns 0 for the ordinary case, so a normal file is untouched.
 *
 * Line counting stays honest: the caller adds this offset back when reporting
 * row numbers, because a gym looking for "row 7" opens their own file.
 */
export function headerOffset(text: string, delimiter = ","): number {
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length && i < 20; i += 1) {
    const line = lines[i];
    if (!line.trim()) continue;
    // Count separators outside quotes, so a title containing a comma does not
    // masquerade as a header row.
    let quoted = false;
    let fields = 1;
    for (const char of line) {
      if (char === '"') quoted = !quoted;
      else if (char === delimiter && !quoted) fields += 1;
    }
    if (fields >= 2) return i;
  }
  return 0;
}

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
