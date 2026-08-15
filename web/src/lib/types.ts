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

export type PatientStatus = "active" | "contacted" | "reactivated" | "opted_out";

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

export type PatientEventType =
  | "imported"
  | "message_sent"
  | "message_failed"
  | "replied"
  | "rebooked"
  | "booked"
  | "opted_out";

export type AppointmentStatus = "booked" | "cancelled" | "completed" | "no_show";

export type CalendarProvider = "google";

export type CalendarConnectionStatus = "active" | "revoked";

/** A campaign's contact method. Email is a single templated send; WhatsApp is
 *  a real back-and-forth held by src/lib/whatsapp/ai-agent.ts. */
export type Channel = "email" | "whatsapp";

export type WhatsAppConversationStatus =
  | "active"
  | "booking_requested"
  | "opted_out"
  | "closed";

export type WhatsAppMessageDirection = "in" | "out";

export type Practice = {
  id: string;
  created_at: string;
  name: string;
  country: string;
  timezone: string;
  contact_email: string;
  sender_name: string | null;
  reply_to_email: string | null;
  dormant_after_months: number;
  max_visits: number;
  daily_send_cap: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: SubscriptionStatus;
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
  /** Typical value of a recovered appointment, in minor units of the billing
   *  currency. Null until the practice sets it. Powers the revenue estimate and
   *  the profit-or-nothing guarantee. See src/lib/money.ts. */
  appointment_value_minor: number | null;
  processing_agreed_at: string | null;
  onboarded_at: string | null;
  /** Per-practice opt-in to the shared casdey WhatsApp sender. Off by
   *  default: the number is shared across every practice. */
  whatsapp_enabled: boolean;
  /** Name of the Meta-approved template used for cold first contact. Null
   *  blocks WhatsApp campaigns for this practice. See src/lib/whatsapp/. */
  whatsapp_template_name: string | null;
  /** Master switch for self-serve booking. Off until the practice sets its
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
  /** Per-weekday open windows in the practice timezone. See BookingHours. */
  booking_hours: BookingHours;
};

/** Weekday key -> list of [start, end] "HH:MM" open windows, practice-local. */
export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type BookingHours = Partial<Record<Weekday, [string, string][]>>;

export type Patient = {
  id: string;
  practice_id: string;
  external_ref: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  last_visit_at: string | null;
  visit_count: number;
  status: PatientStatus;
  contacted_at: string | null;
  reactivated_at: string | null;
  consent_email: boolean;
  /** The practice asserts it may WhatsApp this patient. Mirrors
   *  consent_email but independent of it. */
  consent_whatsapp: boolean;
  source: string;
  /** True only for the one synthetic per-practice patient behind "send
   *  yourself a test" (src/lib/self-test.ts). Never a real person. */
  is_test: boolean;
  /** Opaque token behind this patient's booking link (/book/<token>). */
  booking_token: string;
  created_at: string;
  updated_at: string;
};

export type Campaign = {
  id: string;
  practice_id: string;
  name: string;
  status: CampaignStatus;
  channel: Channel;
  /** Email only. Null for a WhatsApp campaign. */
  subject: string | null;
  /** Email only. Null for a WhatsApp campaign. */
  body: string | null;
  /** WhatsApp only. A snapshot of practices.whatsapp_template_name taken at
   *  creation, so a campaign's record of what it sent can't drift if the
   *  practice's template config changes later. Null for an email campaign. */
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
 * The dormancy rule frozen at the moment a campaign was built, so its audience
 * stays reproducible even if the practice later widens or narrows its window.
 */
export type AudienceSnapshot = {
  dormantAfterMonths: number;
  maxVisits: number;
  builtAt: string;
  patientCount: number;
};

export type PracticeService = {
  id: string;
  practice_id: string;
  name: string;
  price_minor: number;
  position: number;
  created_at: string;
  updated_at: string;
};

export type ImportRun = {
  id: string;
  practice_id: string;
  source: "csv" | "dentally";
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
  practice_id: string;
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

/** A profit-or-nothing guarantee claim. At most one per practice. */
export type GuaranteeClaim = {
  id: string;
  practice_id: string;
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

/** One WhatsApp conversation thread with a patient. Unlike email's
 *  campaign_messages (one row per send), this is a running thread the AI
 *  agent (src/lib/whatsapp/ai-agent.ts) replies within. */
export type WhatsAppConversation = {
  id: string;
  practice_id: string;
  patient_id: string;
  phone: string;
  status: WhatsAppConversationStatus;
  ai_turns_count: number;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  created_at: string;
  updated_at: string;
};

/** One inbound or outbound message in a WhatsApp conversation. */
export type WhatsAppMessage = {
  id: string;
  conversation_id: string;
  practice_id: string;
  direction: WhatsAppMessageDirection;
  body: string;
  provider_message_id: string | null;
  ai_generated: boolean;
  created_at: string;
};

/**
 * A practice's connected external calendar (Google for V1). The encrypted
 * token columns never leave the server; pages only ever read the non-secret
 * fields. See src/lib/calendar/.
 */
export type CalendarConnection = {
  id: string;
  practice_id: string;
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
 * optionally mirrored into the practice's Google Calendar (google_event_id).
 * A booking flips its patient to reactivated, which the dashboard and the
 * guarantee already count. See src/lib/calendar/.
 */
export type Appointment = {
  id: string;
  practice_id: string;
  patient_id: string;
  service_id: string | null;
  start_at: string;
  end_at: string;
  status: AppointmentStatus;
  google_event_id: string | null;
  /** Snapshotted at booking, minor units. Never rewritten by later price edits. */
  value_minor: number | null;
  created_via: "self_serve" | "staff";
  booking_token: string;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};
