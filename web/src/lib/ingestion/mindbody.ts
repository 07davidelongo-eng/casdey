import type { MemberSource, RawMember } from "./types";

/**
 * Mindbody, the first gym-software integration casdey will do directly.
 *
 * It is not built. There are no API credentials for it, and Mindbody's API is
 * gated behind a partner application, so there is nothing to build against yet.
 * What exists here is the seam: it implements the same MemberSource contract
 * as the CSV adapter, so when credentials arrive the work is this file and
 * nothing else. Everything downstream, lapse, campaigns, the dashboard,
 * already speaks RawMember and will not need to change.
 *
 * It deliberately does not pretend to work. A stub that returns empty results
 * looks like a gym with no lapsed members, which is a worse lie than an
 * honest error.
 */

export class SourceNotConfiguredError extends Error {
  constructor(label: string) {
    super(`${label} is not connected yet.`);
    this.name = "SourceNotConfiguredError";
  }
}

export const mindbodySource: MemberSource = {
  id: "mindbody",
  label: "Mindbody",
  isConfigured() {
    return Boolean(
      process.env.MINDBODY_API_KEY && process.env.MINDBODY_API_BASE,
    );
  },
};

/**
 * When this is implemented it should page through Mindbody's members and
 * bookings, yielding batches rather than accumulating the whole gym in
 * memory. The returned shape is already fixed by RawMember.
 */
export async function* fetchMindbodyMembers(): AsyncGenerator<RawMember[]> {
  if (!mindbodySource.isConfigured()) {
    throw new SourceNotConfiguredError(mindbodySource.label);
  }
  throw new SourceNotConfiguredError(mindbodySource.label);
}
