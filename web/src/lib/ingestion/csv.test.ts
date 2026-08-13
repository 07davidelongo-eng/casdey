import { describe, expect, it } from "vitest";

import { guessMapping, normalizeRow, parseDate } from "./csv";
import type { ColumnMapping } from "./types";

describe("parseDate", () => {
  it("reads ISO dates", () => {
    expect(parseDate("2024-03-05", "iso")).toBe("2024-03-05");
    expect(parseDate("2024-3-5", "iso")).toBe("2024-03-05");
  });

  it("strips the time an export tacks on", () => {
    expect(parseDate("2024-03-05T14:30:00Z", "iso")).toBe("2024-03-05");
    expect(parseDate("2024-03-05 09:15:00", "iso")).toBe("2024-03-05");
    expect(parseDate("05/03/2024 09:15", "dmy")).toBe("2024-03-05");
  });

  it("reads the same string differently per format, which is the whole point", () => {
    expect(parseDate("03/04/2024", "dmy")).toBe("2024-04-03");
    expect(parseDate("03/04/2024", "mdy")).toBe("2024-03-04");
  });

  it("accepts dots and dashes as separators", () => {
    expect(parseDate("05.03.2024", "dmy")).toBe("2024-03-05");
    expect(parseDate("05-03-2024", "dmy")).toBe("2024-03-05");
  });

  it("reads a two-digit year as the recent past, never the future", () => {
    const thisYear = new Date().getFullYear();
    const parsed = parseDate("05/03/99", "dmy");
    expect(parsed).toBe("1999-03-05");
    expect(Number(parsed!.slice(0, 4))).toBeLessThanOrEqual(thisYear);
  });

  it("rejects impossible dates rather than rolling them over", () => {
    // Date's own constructor would happily turn this into 1 March.
    expect(parseDate("2023-02-29", "iso")).toBeNull();
    expect(parseDate("2024-02-29", "iso")).toBe("2024-02-29");
    expect(parseDate("32/01/2024", "dmy")).toBeNull();
    // Month 13 read as mdy. The same string read as dmy is a valid 1 January.
    expect(parseDate("13/01/2024", "mdy")).toBeNull();
    expect(parseDate("13/01/2024", "dmy")).toBe("2024-01-13");
  });

  it("rejects anything that is not a date", () => {
    expect(parseDate("", "iso")).toBeNull();
    expect(parseDate("n/a", "dmy")).toBeNull();
    expect(parseDate("05/03/2024", "iso")).toBeNull();
  });
});

const MAPPING: ColumnMapping = {
  externalRef: "Patient ID",
  firstName: "First Name",
  lastName: "Surname",
  email: "Email",
  phone: "Mobile",
  lastVisitAt: "Last Visit",
  visitCount: "Visits",
};

function row(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    "Patient ID": "P-100",
    "First Name": "Jane",
    Surname: "Okafor",
    Email: "Jane.Okafor@Example.com",
    Mobile: "07700 900123",
    "Last Visit": "05/03/2023",
    Visits: "2",
    ...overrides,
  };
}

describe("normalizeRow", () => {
  it("builds a patient from a well-formed row", () => {
    const result = normalizeRow(row(), MAPPING, "dmy", 2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.patient).toEqual({
      externalRef: "P-100",
      firstName: "Jane",
      lastName: "Okafor",
      email: "jane.okafor@example.com",
      phone: "07700 900123",
      lastVisitAt: "2023-03-05",
      visitCount: 2,
    });
  });

  it("skips a row with an unreadable date instead of guessing", () => {
    const result = normalizeRow(row({ "Last Visit": "last year" }), MAPPING, "dmy", 7);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issue.row).toBe(7);
    expect(result.issue.field).toBe("lastVisitAt");
  });

  it("skips a visit dated in the future", () => {
    const future = new Date(Date.now() + 40 * 86_400_000);
    const formatted = `${String(future.getDate()).padStart(2, "0")}/${String(
      future.getMonth() + 1,
    ).padStart(2, "0")}/${future.getFullYear()}`;

    const result = normalizeRow(row({ "Last Visit": formatted }), MAPPING, "dmy", 3);
    expect(result.ok).toBe(false);
  });

  it("keeps a row with no email when it has a patient reference", () => {
    const result = normalizeRow(row({ Email: "" }), MAPPING, "dmy", 4);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.patient.email).toBeNull();
  });

  it("skips a row with neither an email nor a reference", () => {
    const result = normalizeRow(
      row({ Email: "", "Patient ID": "" }),
      MAPPING,
      "dmy",
      5,
    );
    expect(result.ok).toBe(false);
  });

  it("rejects a malformed email rather than importing it and failing at send", () => {
    const result = normalizeRow(row({ Email: "jane at example.com" }), MAPPING, "dmy", 6);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issue.field).toBe("email");
  });

  it("defaults to one visit when the file does not carry a count", () => {
    const { visitCount, ...mapping } = MAPPING;
    void visitCount;
    const result = normalizeRow(row(), mapping, "dmy", 2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.patient.visitCount).toBe(1);
  });

  it("never records zero visits for someone who has a last visit date", () => {
    const result = normalizeRow(row({ Visits: "0" }), MAPPING, "dmy", 2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.patient.visitCount).toBe(1);
  });

  it("splits a single name column when there are no separate ones", () => {
    const mapping: ColumnMapping = {
      fullName: "Patient",
      email: "Email",
      lastVisitAt: "Last Visit",
    };
    const result = normalizeRow(
      { Patient: "Ana Maria Silva", Email: "a@b.co", "Last Visit": "2023-03-05" },
      mapping,
      "iso",
      2,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.patient.firstName).toBe("Ana Maria");
    expect(result.patient.lastName).toBe("Silva");
  });
});

describe("guessMapping", () => {
  it("recognises the columns a Dentally-style export uses", () => {
    const guess = guessMapping([
      "Patient ID",
      "First Name",
      "Surname",
      "Email",
      "Mobile",
      "Last Visit Date",
      "Visits",
    ]);

    expect(guess.externalRef).toBe("Patient ID");
    expect(guess.firstName).toBe("First Name");
    expect(guess.lastName).toBe("Surname");
    expect(guess.email).toBe("Email");
    expect(guess.lastVisitAt).toBe("Last Visit Date");
  });

  it("prefers two name columns over one combined column", () => {
    const guess = guessMapping(["Name", "First Name", "Surname", "Email", "Last Seen"]);
    expect(guess.fullName).toBeUndefined();
    expect(guess.firstName).toBe("First Name");
  });

  it("leaves fields it cannot place alone rather than picking something wrong", () => {
    const guess = guessMapping(["col_a", "col_b", "col_c"]);
    expect(guess.email).toBeUndefined();
    expect(guess.lastVisitAt).toBeUndefined();
  });
});
