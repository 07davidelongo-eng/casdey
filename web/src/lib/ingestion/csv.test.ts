import { describe, expect, it } from "vitest";

import { guessMapping, normalizePhoneForCountry, normalizeRow, parseDate } from "./csv";
import type { ColumnMapping } from "./types";

describe("parseDate", () => {
  it("reads ISO dates", () => {
    expect(parseDate("2024-03-05", "iso")).toBe("2024-03-05");
    expect(parseDate("2024-3-5", "iso")).toBe("2024-03-05");
  });

  it("reads ISO dates whatever the gym picked, because they are unambiguous", () => {
    // Found by importing a normal-looking export: ISO used to be gated behind
    // the "Year first" choice, so a file of 2024-11-12 dates reported EVERY row
    // as "could not read as a date" under the default Day first, with nothing
    // on screen pointing at the setting. The day/month toggle exists to resolve
    // 03/04/2024; a four-digit year leaves it nothing to resolve.
    expect(parseDate("2024-11-12", "dmy")).toBe("2024-11-12");
    expect(parseDate("2024-11-12", "mdy")).toBe("2024-11-12");
    expect(parseDate("2024-3-5", "dmy")).toBe("2024-03-05");
  });

  it("still refuses a non-ISO value when the gym said Year first", () => {
    expect(parseDate("05/03/2024", "iso")).toBeNull();
  });

  it("keeps the ambiguous forms answering to the setting", () => {
    // The whole point of the toggle: these two must not collapse together.
    expect(parseDate("03/04/2024", "dmy")).toBe("2024-04-03");
    expect(parseDate("03/04/2024", "mdy")).toBe("2024-03-04");
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
  externalRef: "Member ID",
  firstName: "First Name",
  lastName: "Surname",
  email: "Email",
  phone: "Mobile",
  lastVisitAt: "Last Visit",
  visitCount: "Visits",
};

function row(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    "Member ID": "P-100",
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
  it("builds a member from a well-formed row", () => {
    const result = normalizeRow(row(), MAPPING, "dmy", 2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.member).toEqual({
      externalRef: "P-100",
      firstName: "Jane",
      lastName: "Okafor",
      email: "jane.okafor@example.com",
      phone: "07700 900123",
      lastVisitAt: "2023-03-05",
      sourceRow: 2,
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

  it("keeps a row with no email when it has a member reference", () => {
    const result = normalizeRow(row({ Email: "" }), MAPPING, "dmy", 4);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.member.email).toBeNull();
  });

  it("skips a row with neither an email nor a reference", () => {
    const result = normalizeRow(
      row({ Email: "", "Member ID": "" }),
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
    expect(result.member.visitCount).toBe(1);
  });

  it("never records zero visits for someone who has a last visit date", () => {
    const result = normalizeRow(row({ Visits: "0" }), MAPPING, "dmy", 2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.member.visitCount).toBe(1);
  });

  it("splits a single name column when there are no separate ones", () => {
    const mapping: ColumnMapping = {
      fullName: "Member",
      email: "Email",
      lastVisitAt: "Last Visit",
    };
    const result = normalizeRow(
      { Member: "Ana Maria Silva", Email: "a@b.co", "Last Visit": "2023-03-05" },
      mapping,
      "iso",
      2,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.member.firstName).toBe("Ana Maria");
    expect(result.member.lastName).toBe("Silva");
  });
});

describe("guessMapping", () => {
  it("recognises the columns a Mindbody-style export uses", () => {
    const guess = guessMapping([
      "Member ID",
      "First Name",
      "Surname",
      "Email",
      "Mobile",
      "Last Visit Date",
      "Visits",
    ]);

    expect(guess.externalRef).toBe("Member ID");
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

  it("recognises snake_case headers, a common generic CSV export style", () => {
    const guess = guessMapping([
      "first_name",
      "last_name",
      "email",
      "phone",
      "last_visit_at",
      "visit_count",
      "member_id",
    ]);

    expect(guess.firstName).toBe("first_name");
    expect(guess.lastName).toBe("last_name");
    expect(guess.email).toBe("email");
    expect(guess.lastVisitAt).toBe("last_visit_at");
    expect(guess.visitCount).toBe("visit_count");
    expect(guess.externalRef).toBe("member_id");
  });

  // The four platforms casdey's target gyms actually run. Header names taken
  // from real member exports; the last-visit column is the one that must always
  // land, since it is the only required field.

  it("recognises a Mindbody client export ('Client ID', 'Last Visit')", () => {
    const guess = guessMapping([
      "Client ID",
      "First Name",
      "Last Name",
      "Email",
      "Mobile Phone",
      "Last Visit",
      "Visits",
    ]);

    expect(guess.externalRef).toBe("Client ID");
    expect(guess.firstName).toBe("First Name");
    expect(guess.lastName).toBe("Last Name");
    expect(guess.email).toBe("Email");
    expect(guess.phone).toBe("Mobile Phone");
    expect(guess.lastVisitAt).toBe("Last Visit");
    expect(guess.visitCount).toBe("Visits");
  });

  it("recognises a Glofox members export ('Last Booking', 'Total Visits')", () => {
    const guess = guessMapping([
      "Member ID",
      "First Name",
      "Last Name",
      "Email",
      "Phone Number",
      "Last Booking",
      "Total Visits",
    ]);

    expect(guess.externalRef).toBe("Member ID");
    expect(guess.email).toBe("Email");
    expect(guess.phone).toBe("Phone Number");
    expect(guess.lastVisitAt).toBe("Last Booking");
    expect(guess.visitCount).toBe("Total Visits");
  });

  it("recognises a TeamUp customers export ('Customer', 'Last attended')", () => {
    const guess = guessMapping([
      "Customer",
      "Email",
      "Phone",
      "Last attended",
      "Membership",
    ]);

    expect(guess.fullName).toBe("Customer");
    expect(guess.email).toBe("Email");
    expect(guess.phone).toBe("Phone");
    expect(guess.lastVisitAt).toBe("Last attended");
  });

  it("recognises an ABC Fitness export ('Last Check-In', 'Total Check-Ins')", () => {
    const guess = guessMapping([
      "Member ID",
      "First Name",
      "Last Name",
      "Email Address",
      "Cell Phone",
      "Last Check-In",
      "Total Check-Ins",
    ]);

    expect(guess.externalRef).toBe("Member ID");
    expect(guess.email).toBe("Email Address");
    expect(guess.phone).toBe("Cell Phone");
    expect(guess.lastVisitAt).toBe("Last Check-In");
    expect(guess.visitCount).toBe("Total Check-Ins");
  });
});

describe("normalizePhoneForCountry", () => {
  it("reads a UK local-format mobile number to E.164", () => {
    expect(normalizePhoneForCountry("07700 900123", "GB")).toBe("+447700900123");
  });

  it("reads local formats for the rest of casdey's target countries", () => {
    expect(normalizePhoneForCountry("085 123 4567", "IE")).toBe("+353851234567");
    expect(normalizePhoneForCountry("06 12345678", "NL")).toBe("+31612345678");
    expect(normalizePhoneForCountry("0151 23456789", "DE")).toBe("+4915123456789");
  });

  it("leaves an already-E.164 number alone", () => {
    expect(normalizePhoneForCountry("+447700900123", "GB")).toBe("+447700900123");
  });

  it("falls back to the raw value when it cannot be read as a phone number", () => {
    expect(normalizePhoneForCountry("not a phone", "GB")).toBe("not a phone");
  });

  it("leaves an empty string alone", () => {
    expect(normalizePhoneForCountry("", "GB")).toBe("");
  });
});

describe("normalizeRow phone handling", () => {
  const mapping: ColumnMapping = {
    lastVisitAt: "last_visit_at",
    email: "email",
    phone: "phone",
  };

  it("normalizes phone to E.164 when a country is given", () => {
    const result = normalizeRow(
      { last_visit_at: "2024-03-05", email: "a@example.com", phone: "07700 900123" },
      mapping,
      "iso",
      2,
      "GB",
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.member.phone).toBe("+447700900123");
  });

  it("keeps the raw phone string when no country is given (the client preview path)", () => {
    const result = normalizeRow(
      { last_visit_at: "2024-03-05", email: "a@example.com", phone: "07700 900123" },
      mapping,
      "iso",
      2,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.member.phone).toBe("07700 900123");
  });
});
