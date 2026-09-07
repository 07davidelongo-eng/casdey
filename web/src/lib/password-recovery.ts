/**
 * The one place that decides what counts as a password recovery.
 *
 * Setting a new password is allowed two ways, and they are not the same thing:
 *
 *   1. RECOVERY. The user clicked the link casdey emailed them, /auth/callback
 *      exchanged it for a session moments ago, and they do not know their old
 *      password, which is the whole reason they are here. Asking for it would
 *      make the flow useless.
 *   2. IN SESSION. The user is already signed in and wants to change it. Here
 *      the old password is exactly what must be proved, because a session on
 *      its own is not proof of the person: a borrowed laptop, a shared
 *      machine, or a stolen cookie all present as a valid session.
 *
 * Supabase returns an ordinary session for a recovery code with nothing on it
 * marking its origin, so case 1 is recorded by /auth/callback in a short-lived
 * HttpOnly cookie and read back here. Anything without that marker is case 2
 * and has to bring the current password.
 */

export const RECOVERY_COOKIE = "casdey-pw-recovery";

/** Where a recovery link lands, and the signal that a flow is a recovery. */
export const RESET_PATH = "/reset-password";

/**
 * How long the marker is good for. Long enough to read the page, choose a
 * password and fix a typo; short enough that a session left open on a shared
 * machine an hour later is back to needing the old password.
 */
export const RECOVERY_WINDOW_SECONDS = 15 * 60;

/** The shortest password casdey will store. Matches Supabase's own floor. */
export const MIN_PASSWORD_LENGTH = 8;
