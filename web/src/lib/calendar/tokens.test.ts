import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";

import { decryptWithKey, encryptWithKey } from "./tokens";

const key = randomBytes(32);

describe("token encryption", () => {
  it("round-trips a token", () => {
    const secret = "1//0gRefreshTokenValue-abc_DEF.123";
    expect(decryptWithKey(encryptWithKey(secret, key), key)).toBe(secret);
  });

  it("produces a different ciphertext each time (random iv)", () => {
    const a = encryptWithKey("same", key);
    const b = encryptWithKey("same", key);
    expect(a).not.toBe(b);
    expect(decryptWithKey(a, key)).toBe("same");
    expect(decryptWithKey(b, key)).toBe("same");
  });

  it("rejects a wrong key", () => {
    const enc = encryptWithKey("secret", key);
    expect(() => decryptWithKey(enc, randomBytes(32))).toThrow();
  });

  it("rejects tampered ciphertext (GCM auth tag)", () => {
    const enc = encryptWithKey("secret", key);
    const raw = Buffer.from(enc, "base64");
    raw[raw.length - 1] ^= 0xff; // flip a byte of the ciphertext
    expect(() => decryptWithKey(raw.toString("base64"), key)).toThrow();
  });

  it("rejects a key of the wrong length", () => {
    expect(() => encryptWithKey("x", randomBytes(16))).toThrow();
  });

  it("rejects truncated ciphertext", () => {
    expect(() => decryptWithKey("YQ==", key)).toThrow();
  });

  it("handles unicode", () => {
    const secret = "café — token 🔑";
    expect(decryptWithKey(encryptWithKey(secret, key), key)).toBe(secret);
  });
});
