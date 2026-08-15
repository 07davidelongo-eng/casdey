import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

/**
 * Encrypting the Google OAuth tokens before they touch the database.
 *
 * A refresh token is a long-lived key to a practice's calendar. Storing it in
 * plaintext means a single leaked database dump hands over write access to
 * every connected diary. So it is encrypted at rest with AES-256-GCM under a
 * key that lives only in the environment (CALENDAR_TOKEN_KEY), never in the DB.
 *
 * Not "server-only": the pure encrypt/decrypt pair takes the key as an
 * argument so it can be unit tested directly, the same reason
 * whatsapp/signature.ts stays importable. The env-reading wrappers below are
 * what the app actually calls.
 */

const IV_BYTES = 12; // GCM standard nonce length
const TAG_BYTES = 16; // GCM auth tag length
const KEY_BYTES = 32; // AES-256

/**
 * Encrypts a token with an explicit 32-byte key. Output is base64 of
 * iv || authTag || ciphertext, one self-contained string to store.
 */
export function encryptWithKey(plaintext: string, key: Buffer): string {
  if (key.length !== KEY_BYTES) {
    throw new Error(`calendar token key must be ${KEY_BYTES} bytes`);
  }
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

/** Reverses encryptWithKey. Throws if the data was tampered with (GCM tag). */
export function decryptWithKey(encoded: string, key: Buffer): string {
  if (key.length !== KEY_BYTES) {
    throw new Error(`calendar token key must be ${KEY_BYTES} bytes`);
  }
  const raw = Buffer.from(encoded, "base64");
  if (raw.length < IV_BYTES + TAG_BYTES) {
    throw new Error("calendar token ciphertext is too short");
  }
  const iv = raw.subarray(0, IV_BYTES);
  const tag = raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = raw.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

/**
 * The key from the environment. CALENDAR_TOKEN_KEY is 32 bytes, base64-encoded
 * (generate with `openssl rand -base64 32`). Read on each call rather than at
 * module load so a missing key is a clear error at the point of use, not an
 * import-time crash that takes the whole app down.
 */
export function calendarTokenKey(): Buffer {
  const raw = process.env.CALENDAR_TOKEN_KEY;
  if (!raw) {
    throw new Error(
      "CALENDAR_TOKEN_KEY is not set. Generate one with `openssl rand -base64 32`.",
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `CALENDAR_TOKEN_KEY must decode to ${KEY_BYTES} bytes (got ${key.length}).`,
    );
  }
  return key;
}

export function encryptToken(plaintext: string): string {
  return encryptWithKey(plaintext, calendarTokenKey());
}

export function decryptToken(encoded: string): string {
  return decryptWithKey(encoded, calendarTokenKey());
}

/** Whether calendar token encryption is configured on this install. */
export function isCalendarKeyConfigured(): boolean {
  try {
    calendarTokenKey();
    return true;
  } catch {
    return false;
  }
}
