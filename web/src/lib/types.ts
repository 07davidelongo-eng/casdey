import type { CancellationReason } from "./cancellation";

/**
 * Domain types shared across the app. These mirror the columns in
 * supabase/migrations/0002_saas.sql. When you change one, change both.
 */

export type SubscriptionStatus =
  | "none"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete";

/** The two paid tiers (Track F). Free is the absence of a subscription, and
 *  the trial is a time-boxed Pro, so neither is a plan_tier value. */
export type PlanTier = "standard" | "pro";

export type MemberStatus = "active" | "contacted" | "returned" | "opted_out";

export type CampaignStatus =
  | "draft"
  | "sending"
  | "sent"
  | "paused"
  | "cancelled";

export type MessageStatus =
  | "queued"
  | "sent"
  | "failed"
  | "suppressed"
  | "cancelled";

export type MemberEventType =
  | "imported"
  | "message_sent"
  | "message_failed"
  | "replied"
  | "returned"
  | "return_undone"
  | "booked"
  | "opted_out"
  | "cancelled";

/** win_back: audience is lapsed/cancelled members. at_risk: audience is
 *  still-active members trending toward lapse. See src/lib/lapse.ts. */
export type CampaignKind = "win_back" | "at_risk";

export type BookingStatus = "booked" | "cancelled" | "completed" | "no_show";

export type CalendarProvider = "google";

export type CalendarConnectionStatus = "active" | "revoked";

/** A campaign's contact method. WhatsApp was revived for V1 (Track E1) after an
 *  engaged outreach lead asked for it; email is still the default. */
export type Channel = "email" | "whatsapp";

export type WhatsAppConversationStatus =
  | "active"
  | "booking_requested"
  | "opted_out"
  | "closed";

/** One WhatsApp thread per member. Mirrors supabase/migrations/
 *  0014_whatsapp_channel_gym.sql. */
export type WhatsAppConversation = {
  id: string;
  created_at: string;
  updated_at: string;
  gym_id: string;
  member_id: string;
  phone: string;
  status: WhatsAppConversationStatus;
  ai_turns_count: number;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
};

export type WhatsAppMessage = {
  id: string;
  created_at: string;
  conversation_id: string;
  gym_id: string;
  direction: "in" | "out";
  body: string;
  provider_message_id: string | null;
  ai_generated: boolean;
};

export type Gym = {
  id: string;
  created_at: string;
  name: string;
  country: string;
  timezone: string;
  contact_email: string;
  sender_name: string | null;
  reply_to_email: string | null;
  lapsed_after_months: number;
  max_visits: number;
  /** Days of no visit before a still-active member counts as at-risk.
   *  Always shorter than lapsed_after_months. See src/lib/lapse.ts. */
  at_risk_after_days: number;
  daily_send_cap: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: SubscriptionStatus;
  /** Which paid tier a subscribed gym is on (Track F). Null for Free / trial.
   *  Written by the Stripe webhook from the subscription price. */
  plan_tier: PlanTier | null;
  plan_currency: "gbp" | "eur" | null;
  plan_interval: "month" | "year" | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  /** When the first real (non-trial) Premium payment landed. Null until then.
   *  The guarantee clock can only start on or after this date. See
   *  src/lib/guarantee.ts. */
  premium_started_at: string | null;
  /** Joined in the V1/waitlist window, so keeps the lifetime upgrade discount. */
  early_adopter: boolean;
  /** Typical value of a recovered booking, in minor units of the billing
   *  currency. Null until the gym sets it. Powers the revenue estimate and
   *  the profit-or-nothing guarantee. See src/lib/money.ts. */
  booking_value_minor: number | null;
  processing_agreed_at: string | null;
  onboarded_at: string | null;
  /** Master switch for self-serve booking. Off until the gym sets its
   *  hours. When off, no booking link is emitted. See src/lib/calendar/. */
  booking_enabled: boolean;
  /** Length of one offered slot, in minutes. */
  booking_slot_minutes: number;
  /** Gap kept clear after each booked slot, in minutes. */
  booking_buffer_minutes: number;
  /** Minimum notice before a bookable slot, in hours. */
  booking_min_notice_hours: number;
  /** How far ahead slots are offered, in days. */
  booking_horizon_days: number;
  /** Per-weekday open windows in the gym timezone. See BookingHours. */
  booking_hours: BookingHours;
  /** Per-gym opt-in to the shared casdey WhatsApp sender (Track E1). Off by
   *  default: the number is shared across every gym. See src/lib/whatsapp/. */
  whatsapp_enabled: boolean;
  /** Twilio Content SID of the Meta-approved template used for WhatsApp first
   *  contact. Null blocks WhatsApp campaigns for this gym until it is set. */
  whatsapp_template_name: string | null;
};

/** Weekday key -> list of [start, end] "HH:MM" open windows, gym-local. */
export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type BookingHours = Partial<Record<Weekday, [string, string][]>>;

export type Member = {
  id: string;
  gym_id: string;
  external_ref: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  last_visit_at: string | null;
  visit_count: number;
  status: MemberStatus;
  contacted_at: string | null;
  returned_at: string | null;
  /** Set by staff when a member formally cancels. Orthogonal to status,
   *  see src/lib/cancellation.ts. */
  cancellation_reason: CancellationReason | null;
  cancelled_at: string | null;
  consent_email: boolean;
  /** The gym asserts it may WhatsApp this member. False suppresses them from
   *  every WhatsApp campaign, regardless of consent_email. See Track E1. */
  consent_whatsapp: boolean;
  source: string;
  /** True only for the one synthetic per-gym member behind "send
   *  yourself a test" (src/lib/self-test.ts). Never a real person. */
  is_test: boolean;
  /** Opaque token behind this member's booking link (/book/<token>). */
  booking_token: string;
  created_at: string;
  updated_at: string;
};

export type Campaign = {
  id: string;
  gym_id: string;
  name: string;
  status: CampaignStatus;
  kind: CampaignKind;
  channel: Channel;
  /** Null for a WhatsApp campaign (no freeform first-contact copy). */
  subject: string | null;
  body: string | null;
  /** Frozen Twilio Content SID for a WhatsApp campaign; null for email. */
  whatsapp_template_name: string | null;
  language: string;
  audience: AudienceSnapshot;
  approved_at: string | null;
  approved_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

/**
 * The lapse rule frozen at the moment a campaign was built, so its audience
 * stays reproducible even if the gym later widens or narrows its window.
 */
export type AudienceSnapshot = {
  kind: CampaignKind;
  lapsedAfterMonths: number;
  maxVisits: number;
  /** Only present for kind: 'at_risk'. */
  atRiskAfterDays?: number;
  /** Only present when a win-back campaign was scoped to one reason. */
  reasonFilter?: CancellationReason;
  builtAt: string;
  memberCount: number;
};

export type Service = {
  id: string;
  gym_id: string;
  name: string;
  price_minor: number;
  position: number;
  created_at: string;
  updated_at: string;
};

export type ImportRun = {
  id: string;
  gym_id: string;
  source: "csv" | "mindbody";
  filename: string | null;
  status: "completed" | "failed";
  row_count: number;
  imported_count: number;
  updated_count: number;
  skipped_count: number;
  report: { issues?: ImportIssue[] };
  created_at: string;
};

export type ImportIssue = {
  row: number;
  field: string;
  reason: string;
};

/** One successfully paid Stripe invoice. Written only by the invoice.paid
 *  webhook handler. See src/lib/guarantee.ts. */
export type SubscriptionPayment = {
  id: string;
  gym_id: string;
  stripe_invoice_id: string;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  amount_minor: number;
  currency: "gbp" | "eur";
  paid_at: string;
  refunded_minor: number;
  created_at: string;
};

export type GuaranteeClaimStatus = "processing" | "refunded" | "failed";

/** A profit-or-nothing guarantee claim. At most one per gym. */
export type GuaranteeClaim = {
  id: string;
  gym_id: string;
  window_start: string;
  window_end: string;
  revenue_recovered_minor: number;
  paid_minor: number;
  refunded_minor: number;
  stripe_refund_ids: string[];
  status: GuaranteeClaimStatus;
  created_at: string;
};

// Access and sending used to be gated on subscription_status directly. They are
// now decided by the plan model in ./plan.ts (trial / free / premium), because
// Free is a real state a paid-up account can rest in, not an absence of access.

/**
 * A gym's connected external calendar (Google for V1). The encrypted
 * token columns never leave the server; pages only ever read the non-secret
 * fields. See src/lib/calendar/.
 */
export type CalendarConnection = {
  id: string;
  gym_id: string;
  provider: CalendarProvider;
  google_calendar_id: string;
  access_token_enc: string | null;
  refresh_token_enc: string | null;
  token_expires_at: string | null;
  connected_email: string | null;
  status: CalendarConnectionStatus;
  created_at: string;
  updated_at: string;
};

/**
 * A casdey-owned booking. The source of truth for who booked and when,
 * optionally mirrored into the gym's Google Calendar (google_event_id).
 * A booking flips its member to returned, which the dashboard and the
 * guarantee already count. See src/lib/calendar/.
 */
export type Booking = {
  id: string;
  gym_id: string;
  member_id: string;
  service_id: string | null;
  start_at: string;
  end_at: string;
  status: BookingStatus;
  google_event_id: string | null;
  /** Snapshotted at booking, minor units. Never rewritten by later price edits. */
  value_minor: number | null;
  /** The gym's buffer at booking time, snapshotted so the DB-level overlap
   *  guard (bookings_no_overlap) stays immutable. See 0015. */
  buffer_minutes: number;
  /** end_at + buffer_minutes, maintained by a trigger; the upper bound of the
   *  overlap-guard range. See 0015. */
  guard_end_at: string;
  created_via: "self_serve" | "staff";
  booking_token: string;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};
