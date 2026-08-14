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
  | "opted_out";

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
  /** Joined in the V1/waitlist window, so keeps the lifetime upgrade discount. */
  early_adopter: boolean;
  /** Typical value of a recovered appointment, in minor units of the billing
   *  currency. Null until the practice sets it. Powers the revenue estimate and
   *  the profit-or-nothing guarantee. See src/lib/money.ts. */
  appointment_value_minor: number | null;
  processing_agreed_at: string | null;
  onboarded_at: string | null;
};

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
  source: string;
  created_at: string;
  updated_at: string;
};

export type Campaign = {
  id: string;
  practice_id: string;
  name: string;
  status: CampaignStatus;
  subject: string;
  body: string;
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

// Access and sending used to be gated on subscription_status directly. They are
// now decided by the plan model in ./plan.ts (trial / free / premium), because
// Free is a real state a paid-up account can rest in, not an absence of access.
