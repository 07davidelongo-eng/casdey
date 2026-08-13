import type { PatientSource, RawPatient } from "./types";

/**
 * Dentally, the first practice-software integration casdey will do directly.
 *
 * It is not built. There are no API credentials for it, and Dentally's API is
 * gated behind a partner application, so there is nothing to build against yet.
 * What exists here is the seam: it implements the same PatientSource contract
 * as the CSV adapter, so when credentials arrive the work is this file and
 * nothing else. Everything downstream, dormancy, campaigns, the dashboard,
 * already speaks RawPatient and will not need to change.
 *
 * It deliberately does not pretend to work. A stub that returns empty results
 * looks like a practice with no dormant patients, which is a worse lie than an
 * honest error.
 */

export class SourceNotConfiguredError extends Error {
  constructor(label: string) {
    super(`${label} is not connected yet.`);
    this.name = "SourceNotConfiguredError";
  }
}

export const dentallySource: PatientSource = {
  id: "dentally",
  label: "Dentally",
  isConfigured() {
    return Boolean(
      process.env.DENTALLY_API_KEY && process.env.DENTALLY_API_BASE,
    );
  },
};

/**
 * When this is implemented it should page through Dentally's patients and
 * appointments, yielding batches rather than accumulating the whole practice in
 * memory. The returned shape is already fixed by RawPatient.
 */
export async function* fetchDentallyPatients(): AsyncGenerator<RawPatient[]> {
  if (!dentallySource.isConfigured()) {
    throw new SourceNotConfiguredError(dentallySource.label);
  }
  throw new SourceNotConfiguredError(dentallySource.label);
}
