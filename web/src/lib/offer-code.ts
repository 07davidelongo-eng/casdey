/**
 * The code that turns an offer from a sentence into something a gym can honour.
 *
 * Until now an offer was text inside a message and nothing more. A member read
 * "come back for a free week", walked in, and the person at the desk had no way
 * to tell a genuine casdey offer from someone chancing it, no way to know which
 * offer had been promised, and no record afterwards that it had been used. The
 * gym was asked to trust a stranger's word about what it had agreed to give
 * away.
 *
 * A code fixes all three at once, and it needs no integration with anything:
 * the member quotes it, the gym checks it, and the booking carries it.
 *
 * Derived, not stored. Every member already has a booking_token, unique per
 * member and never reused, so the code is a function of it: no column to keep
 * in step, no chance of two members sharing a code, and the same member always
 * quotes the same code no matter how many campaigns they are in. The token
 * itself stays secret, which is why the code is a hash of it and not a slice:
 * an offer code is read aloud at a front desk, and it must not be possible to
 * work backwards from one to a link that books on that member's behalf.
 */

import { createHash } from "node:crypto";

/**
 * Crockford's alphabet: no I, L, O or U. A code that gets read down a phone or
 * copied off a screen must not turn a 1 into an I, and dropping U means the
 * alphabet cannot spell anything a gym would rather not print.
 */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

const LENGTH = 6;

/**
 * A short, spoken-aloud-safe code for this member's offer.
 *
 * 32^6 is a billion, which is not a security boundary and is not meant to be:
 * the code proves which offer was promised to whom, and the gym is looking at
 * a member standing in front of it. Guessing one is worth a free class.
 */
export function offerCode(bookingToken: string): string {
  const digest = createHash("sha256")
    .update(`casdey:offer:${bookingToken}`)
    .digest();

  let out = "";
  for (let i = 0; i < LENGTH; i += 1) {
    out += ALPHABET[digest[i] % ALPHABET.length];
  }
  // Grouped, because six unbroken characters get misread and misheard.
  return `${out.slice(0, 3)}-${out.slice(3)}`;
}

/**
 * Whether what somebody typed at the desk is this member's code.
 *
 * Forgiving on the things humans do to codes and strict on the rest: case,
 * spaces and the dash are noise, everything else is not.
 */
export function offerCodeMatches(bookingToken: string, entered: string): boolean {
  return normaliseCode(entered) === normaliseCode(offerCode(bookingToken));
}

export function normaliseCode(value: string): string {
  return value.toUpperCase().replace(/[^0-9A-Z]/g, "");
}
