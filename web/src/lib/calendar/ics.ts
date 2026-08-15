/**
 * Building the .ics a patient gets with their confirmation email.
 *
 * A one-event calendar file so the appointment lands in whatever calendar the
 * patient actually uses, phone or desktop. Pure and dependency-free: it takes
 * the appointment facts and returns a string, so it is unit tested without a
 * database or a mail provider (see ics.test.ts).
 *
 * Only the fields a confirmation needs are emitted, and each value is escaped
 * per RFC 5545 so a practice name with a comma or a newline cannot break the
 * file.
 */

export type IcsEvent = {
  /** Stable unique id for the event. Reuse the appointment id. */
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  description?: string;
  location?: string;
  /** When the file was generated. Defaults to now. */
  stamp?: Date;
};

/** RFC 5545 TEXT escaping: backslash, comma, semicolon, and newline. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** UTC timestamp in the basic format iCalendar wants: 20260815T140000Z. */
function formatUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * Long lines must be folded at 75 octets with a leading space on continuations.
 * Folding by character is close enough for the ASCII-dominant fields here and
 * never splits a multi-byte sequence because it only breaks on plain chars.
 */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 74) {
    chunks.push(" " + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  if (rest.length) chunks.push(" " + rest);
  return chunks.join("\r\n");
}

export function buildIcs(event: IcsEvent): string {
  const stamp = event.stamp ?? new Date();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//casdey//booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${escapeText(event.uid)}`,
    `DTSTAMP:${formatUtc(stamp)}`,
    `DTSTART:${formatUtc(event.start)}`,
    `DTEND:${formatUtc(event.end)}`,
    `SUMMARY:${escapeText(event.summary)}`,
  ];

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  }
  if (event.location) {
    lines.push(`LOCATION:${escapeText(event.location)}`);
  }

  lines.push("STATUS:CONFIRMED", "END:VEVENT", "END:VCALENDAR");

  // CRLF line endings, and every line folded to the 75-octet limit.
  return lines.map(fold).join("\r\n") + "\r\n";
}
