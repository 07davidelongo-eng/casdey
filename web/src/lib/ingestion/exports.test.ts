import Papa from "papaparse";
import { describe, expect, it } from "vitest";

import {
  decodeCsv,
  guessMapping,
  headerOffset,
  normalizeRow,
} from "./csv";
import type { ColumnMapping, DateFormat, RawMember } from "./types";

/**
 * Whole-file import tests against gym-platform exports.
 *
 * **These files are synthetic.** They are written from the column names and
 * conventions each platform is documented or observed to use, not exported
 * from a live account, so they prove the importer survives the *shape* of a
 * real export. They are not proof of compatibility with any one platform, and
 * plan item B4 (get a real file, LegitFit first) still stands. What they do
 * catch is the class of breakage that only shows up on a whole file rather
 * than a hand-written row: a BOM, quoted commas inside a name, a blank
 * trailing line, "N/A" where a date should be, and columns casdey does not
 * care about sitting between the ones it does.
 *
 * Each case asserts two separate things, because they fail separately: that
 * guessMapping picks the right columns out of the header row, and that every
 * data row then normalises to the member casdey expects.
 */

type Fixture = {
  platform: string;
  dateFormat: DateFormat;
  country: string;
  csv: string;
  /** The columns guessMapping must find, by name. */
  expectMapping: Partial<Record<keyof ColumnMapping, string>>;
  /** How many rows are expected to survive, and what the first one looks like. */
  expectRows: number;
  expectFirst: Partial<RawMember>;
  /** Rows expected to be rejected, with the field each fails on. */
  expectRejected?: { row: number; field: string }[];
};

const FIXTURES: Fixture[] = [
  {
    platform: "Mindbody",
    // Mindbody's UK exports write day-first dates.
    dateFormat: "dmy",
    country: "GB",
    csv:
      "﻿Client ID,First Name,Last Name,Email,Mobile Phone,Last Visit,Visits,Membership\r\n" +
      "100234,Aoife,Byrne,AOIFE.BYRNE@example.com,07700 900123,14/02/2025,3,Off-Peak Monthly\r\n" +
      "100235,Tomás,Ó Súilleabháin,tomas@example.ie,+353 86 123 4567,02/11/2024,1,Full Monthly\r\n" +
      "100236,Ruth,Adeyemi,,,29/06/2024,7,Paused\r\n",
    expectMapping: {
      externalRef: "Client ID",
      firstName: "First Name",
      lastName: "Last Name",
      email: "Email",
      phone: "Mobile Phone",
      lastVisitAt: "Last Visit",
      visitCount: "Visits",
    },
    expectRows: 3,
    expectFirst: {
      externalRef: "100234",
      firstName: "Aoife",
      lastName: "Byrne",
      // Upper-cased in the export, because people type addresses into forms.
      email: "aoife.byrne@example.com",
      phone: "+447700900123",
      lastVisitAt: "2025-02-14",
      visitCount: 3,
    },
  },
  {
    platform: "Glofox",
    dateFormat: "iso",
    country: "IE",
    csv:
      "Member ID,Name,Email Address,Phone Number,Last Booking,Total Bookings,Status\n" +
      'GLX-8891,"Byrne, Aoife",aoife@example.ie,+353 87 111 2222,2025-01-09,4,Cancelled\n' +
      "GLX-8892,Dan Whelan,dan@example.ie,,2024-08-21,2,Cancelled\n" +
      "\n",
    expectMapping: {
      externalRef: "Member ID",
      fullName: "Name",
      email: "Email Address",
      phone: "Phone Number",
      lastVisitAt: "Last Booking",
      visitCount: "Total Bookings",
    },
    expectRows: 2,
    expectFirst: {
      externalRef: "GLX-8891",
      // One combined column, and the comma inside it survives quoting.
      firstName: "Byrne,",
      lastName: "Aoife",
      email: "aoife@example.ie",
      lastVisitAt: "2025-01-09",
      visitCount: 4,
    },
  },
  {
    platform: "TeamUp",
    dateFormat: "dmy",
    country: "GB",
    csv:
      "Customer,Email,Telephone,Last attended,Attendances,Registered on\n" +
      "Priya Raman,priya@example.co.uk,020 7946 0102,03/12/2024,5,11/04/2023\n" +
      "Sam Okafor,sam@example.co.uk,,N/A,0,02/02/2024\n",
    expectMapping: {
      fullName: "Customer",
      email: "Email",
      phone: "Telephone",
      lastVisitAt: "Last attended",
      visitCount: "Attendances",
    },
    expectRows: 1,
    expectFirst: {
      firstName: "Priya",
      lastName: "Raman",
      email: "priya@example.co.uk",
      phone: "+442079460102",
      lastVisitAt: "2024-12-03",
      visitCount: 5,
    },
    // A member who never attended has no date to lapse from. Rejected with a
    // reason rather than silently imported with a made-up one.
    expectRejected: [{ row: 3, field: "lastVisitAt" }],
  },
  {
    platform: "ABC Fitness",
    dateFormat: "mdy",
    country: "GB",
    csv:
      "Member Number,First Name,Last Name,Email,Home Phone,Last Check-In,Total Check-Ins\n" +
      "0099123,Grace,Mwangi,grace@example.com,07700 900456,11/28/2024,12\n",
    expectMapping: {
      externalRef: "Member Number",
      firstName: "First Name",
      lastName: "Last Name",
      email: "Email",
      phone: "Home Phone",
      lastVisitAt: "Last Check-In",
      visitCount: "Total Check-Ins",
    },
    expectRows: 1,
    expectFirst: {
      firstName: "Grace",
      lastName: "Mwangi",
      // US-style in the file, and the gym said Month first, so this is
      // 28 November and not an unreadable 11 day-28.
      lastVisitAt: "2024-11-28",
      visitCount: 12,
    },
  },
  {
    platform: "LegitFit",
    dateFormat: "iso",
    country: "IE",
    // LegitFit is the one that matters most (it is JD's platform and, with no
    // API and a trigger-only Zapier app, CSV is the only way in) and it is
    // also the one whose real export has not been seen. Modelled on its
    // client-list wording.
    csv:
      "Client Name,Client Email,Client Phone,Last Class,Classes Attended,Membership Status\n" +
      "Niamh Kelleher,niamh@example.ie,083 111 2233,2025-03-02,9,Expired\n" +
      "Eoin Mac Cárthaigh,eoin@example.ie,+353 85 999 8877,2024-10-18,1,Expired\n",
    expectMapping: {
      fullName: "Client Name",
      email: "Client Email",
      phone: "Client Phone",
      lastVisitAt: "Last Class",
      visitCount: "Classes Attended",
    },
    expectRows: 2,
    expectFirst: {
      firstName: "Niamh",
      lastName: "Kelleher",
      email: "niamh@example.ie",
      phone: "+353831112233",
      lastVisitAt: "2025-03-02",
      visitCount: 9,
    },
  },
];

function run(fixture: Fixture) {
  const parsed = Papa.parse<Record<string, string>>(fixture.csv, {
    header: true,
    skipEmptyLines: true,
  });
  const mapping = guessMapping(parsed.meta.fields ?? []);

  const rows: RawMember[] = [];
  const rejected: { row: number; field: string }[] = [];
  parsed.data.forEach((row, index) => {
    const result = normalizeRow(
      row,
      mapping as ColumnMapping,
      fixture.dateFormat,
      // Header is line 1, so the first data row is line 2.
      index + 2,
      fixture.country,
    );
    if (result.ok) rows.push(result.member);
    else rejected.push({ row: result.issue.row, field: result.issue.field });
  });

  return { mapping, rows, rejected };
}

describe.each(FIXTURES)("$platform export", (fixture) => {
  const { mapping, rows, rejected } = run(fixture);

  it("finds every column casdey needs in the header row", () => {
    for (const [field, header] of Object.entries(fixture.expectMapping)) {
      expect(
        mapping[field as keyof ColumnMapping],
        `${field} should map to "${header}"`,
      ).toBe(header);
    }
  });

  it("imports the rows it should and rejects the ones it should not", () => {
    expect(rows).toHaveLength(fixture.expectRows);
    expect(rejected).toEqual(fixture.expectRejected ?? []);
  });

  it("normalises the first member correctly", () => {
    expect(rows[0]).toMatchObject(fixture.expectFirst);
  });

  it("keeps every surviving row pointing at its own line in the file", () => {
    // "Row 0" in a 500-row export points at nothing, so a gym must always be
    // able to find the line a rejected or failing record came from.
    for (const member of rows) expect(member.sourceRow).toBeGreaterThan(1);
    expect(new Set(rows.map((m) => m.sourceRow)).size).toBe(rows.length);
  });
});

/**
 * The file-level quirks that only appear in exports people actually produce.
 * Every case here was probed against the real parser first; the two that
 * failed are the two that were then fixed.
 */
describe("real-export quirks", () => {
  const table =
    "Client Name,Client Email,Last Class,Classes Attended\n" +
    "Niamh Kelleher,niamh@example.ie,2025-03-02,9\n";

  function parse(text: string) {
    const skip = headerOffset(text);
    const body = skip ? text.split(/\r?\n/).slice(skip).join("\n") : text;
    const out = Papa.parse<Record<string, string>>(body, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
    });
    return { skip, fields: out.meta.fields ?? [], rows: out.data };
  }

  it("survives a report title and date range above the table", () => {
    // This broke outright: Papa took the title as the header, the file
    // collapsed into one column called "Client Attendance Report", and the gym
    // was asked to map columns that no longer existed.
    const withPreamble =
      "Client Attendance Report\n" +
      "Generated 05/09/2026 by Iron Works Gym\n" +
      "\n" +
      table;
    const { skip, fields, rows } = parse(withPreamble);
    expect(skip).toBe(3);
    expect(fields).toContain("Classes Attended");
    expect(rows).toHaveLength(1);
  });

  it("counts rows from the gym's own file, not from the table", () => {
    // A gym told "row 5" opens their file and looks at line 5. Skipping a
    // preamble must not quietly renumber what they are shown.
    const withPreamble = "Report\nGenerated today\n\n" + table;
    expect(0 + 2 + headerOffset(withPreamble)).toBe(5);
  });

  it("leaves an ordinary file alone", () => {
    expect(headerOffset(table)).toBe(0);
  });

  it("is not fooled by a title that happens to contain a comma", () => {
    expect(headerOffset('"Attendance, all clients"\n' + table)).toBe(1);
  });

  it("reads a semicolon-separated European Excel export", () => {
    const semi =
      "Client Name;Client Email;Last Class;Classes Attended\r\n" +
      "Niamh Kelleher;niamh@example.ie;2025-03-02;9\r\n";
    const { fields, rows } = parse(semi);
    expect(fields).toEqual([
      "Client Name",
      "Client Email",
      "Last Class",
      "Classes Attended",
    ]);
    expect(rows[0]["Classes Attended"]).toBe("9");
  });

  it("reads a tab-separated export", () => {
    const tsv =
      "Client Name\tClient Email\tLast Class\tClasses Attended\n" +
      "Niamh Kelleher\tniamh@example.ie\t2025-03-02\t9\n";
    expect(parse(tsv).fields).toContain("Classes Attended");
  });

  it("keeps a count written with a thousands separator", () => {
    const big =
      "Client Name,Client Email,Last Class,Classes Attended\n" +
      'Niamh Kelleher,niamh@example.ie,2025-03-02,"1,204"\n';
    const { rows } = parse(big);
    const result = normalizeRow(
      rows[0],
      {
        lastVisitAt: "Last Class",
        email: "Client Email",
        fullName: "Client Name",
        visitCount: "Classes Attended",
      },
      "iso",
      2,
      "IE",
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.member.visitCount).toBe(1204);
  });
});

describe("decodeCsv", () => {
  const line = "Client Name,Client Email\nNiamh,niamh@example.ie\n";

  it("reads plain UTF-8", () => {
    expect(decodeCsv(new TextEncoder().encode(line))).toBe(line);
  });

  it("strips a UTF-8 byte-order mark off the first header", () => {
    expect(
      decodeCsv(new TextEncoder().encode("\uFEFF" + line)).startsWith("Client Name"),
    ).toBe(true);
  });

  it("reads UTF-16, which Excel's Unicode Text export writes", () => {
    // This produced headers interleaved with NUL bytes: strict UTF-8 rejected
    // the file and the Windows-1252 fallback decoded it into mojibake, so the
    // gym was shown a column list of nonsense.
    const utf16 = new Uint8Array(Buffer.from("\uFEFF" + line, "utf16le"));
    const decoded = decodeCsv(utf16);
    expect(decoded.startsWith("Client Name")).toBe(true);
    expect(decoded).not.toContain("\u0000");
  });

  it("falls back to Windows-1252 so accented names survive", () => {
    // "Fran\u00e7ois" written in Windows-1252 is not valid UTF-8.
    const bytes = new Uint8Array([
      0x4e, 0x61, 0x6d, 0x65, 0x0a, 0x46, 0x72, 0x61, 0x6e, 0xe7, 0x6f, 0x69,
      0x73, 0x0a,
    ]);
    expect(decodeCsv(bytes)).toContain("Fran\u00e7ois");
  });
});
