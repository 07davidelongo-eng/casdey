/**
 * Where a `?next=` parameter is allowed to send someone.
 *
 * The value arrives from a URL, so it is attacker-controlled. Without this a
 * link like /login?next=https://example.com turns casdey's own login page into
 * a credible phishing hop. Only same-site absolute paths pass.
 */

const FALLBACK = "/app";

export function safeNextPath(value: unknown, fallback = FALLBACK): string {
  if (typeof value !== "string" || value.length === 0) return fallback;

  // Must be an absolute path on this site. "//evil.com" and "/\evil.com" are
  // both protocol-relative URLs in browsers, so a single leading slash is not
  // enough of a check.
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;

  // Backslashes normalise to forward slashes in some browsers, which would
  // sneak a protocol-relative URL past the check above. Control characters can
  // smuggle a line break into a header. Checked by code point rather than a
  // regex so there is no doubt about what is being matched: hyphens, dots and
  // the rest of the printable range stay legal.
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (char === "\\" || code < 0x20 || code === 0x7f) return fallback;
  }

  return value;
}
