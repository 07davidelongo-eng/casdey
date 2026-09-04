/**
 * `server-only` is a build-time guard: importing it from a client bundle is a
 * hard error, which is exactly what we want in the app. Under vitest there is
 * no such bundle and the package throws on import, so modules carrying the
 * guard (src/lib/stripe.ts) could not be unit-tested at all. This stub stands
 * in for it, and only inside the test runner — see vitest.config.ts.
 */
export {};
