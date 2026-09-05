import { describe, expect, it } from "vitest";

import { dedupeByConflictKey } from "./upsert";
import type { RawMember } from "./types";

/**
 * Two rows in one file that share an email address.
 *
 * Found by importing an eight-row file and reading the summary: 8 rows read,
 * 5 added, 0 updated, 2 skipped. Seven. The eighth was a member whose address
 * had been typed into a different member's email column, and the importer
 * collapsed the pair silently, keeping the later row. The real member was gone
 * from casdey entirely, the survivor was left holding her address, and the next
 * campaign would have opened "Hi Oisín," in Niamh's inbox.
 *
 * Two rows sharing an email in one file are usually two people, not two
 * versions of one: a couple on a joint membership, a family, a front-desk
 * placeholder address, or a typo. So the collision is reported rather than
 * resolved quietly.
 */
function member(over: Partial<RawMember> = {}): RawMember {
  return {
    externalRef: null,
    firstName: "Jane",
    lastName: "Okafor",
    email: "jane@example.com",
    phone: null,
    lastVisitAt: "2024-03-05",
    visitCount: 1,
    sourceRow: 2,
    ...over,
  };
}

const byEmail = (p: RawMember) => (p.email ?? "").toLowerCase();

describe("dedupeByConflictKey", () => {
  it("keeps both members when their keys differ", () => {
    const a = member({ email: "a@example.com", sourceRow: 2 });
    const b = member({ email: "b@example.com", sourceRow: 3 });

    const { kept, collisions } = dedupeByConflictKey([a, b], byEmail);

    expect(kept).toEqual([a, b]);
    expect(collisions).toEqual([]);
  });

  it("keeps the first of two rows sharing an address, and reports the second", () => {
    const niamh = member({
      firstName: "Niamh",
      email: "niamh.kelly@example.com",
      visitCount: 3,
      sourceRow: 6,
    });
    // Same address, different person: the typo that deleted Niamh.
    const oisin = member({
      firstName: "Oisín",
      email: "NIAMH.KELLY@EXAMPLE.COM",
      visitCount: 1,
      sourceRow: 7,
    });

    const { kept, collisions } = dedupeByConflictKey([niamh, oisin], byEmail);

    expect(kept).toEqual([niamh]);
    expect(collisions).toEqual([oisin]);
  });

  it("reports every later collision, not just the first", () => {
    const rows = [
      member({ sourceRow: 2 }),
      member({ sourceRow: 3 }),
      member({ sourceRow: 4 }),
    ];

    const { kept, collisions } = dedupeByConflictKey(rows, byEmail);

    expect(kept).toHaveLength(1);
    expect(collisions.map((c) => c.sourceRow)).toEqual([3, 4]);
  });

  it("accounts for every row it was given, so the import counts add up", () => {
    const rows = [
      member({ email: "a@example.com" }),
      member({ email: "a@example.com" }),
      member({ email: "b@example.com" }),
    ];

    const { kept, collisions } = dedupeByConflictKey(rows, byEmail);

    expect(kept.length + collisions.length).toBe(rows.length);
  });

  it("collides on phone for members identified that way", () => {
    const byPhone = (p: RawMember) => p.phone ?? "";
    const first = member({ email: null, phone: "+353871234567", sourceRow: 2 });
    const second = member({ email: null, phone: "+353871234567", sourceRow: 3 });

    const { kept, collisions } = dedupeByConflictKey([first, second], byPhone);

    expect(kept).toEqual([first]);
    expect(collisions).toEqual([second]);
  });
});
