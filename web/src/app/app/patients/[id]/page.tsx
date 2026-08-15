import Link from "next/link";
import { notFound } from "next/navigation";

import { requirePractice } from "@/lib/dal";
import { isDormant, monthsSince, ruleFor } from "@/lib/dormancy";
import { PatientTimeline } from "@/components/app/patient-timeline";
import { PatientActions } from "./actions-ui";
import { WhatsAppConversationCard } from "./whatsapp-conversation";
import { Card, Pill, formatDate, patientName } from "@/components/app/ui";
import type {
  Patient,
  PatientEventType,
  WhatsAppConversation,
  WhatsAppMessage,
} from "@/lib/types";

type PatientEvent = {
  id: string;
  type: PatientEventType;
  occurred_at: string;
  meta: Record<string, unknown>;
};

const EVENT_LABEL: Record<PatientEventType, string> = {
  imported: "Added from an import",
  message_sent: "casdey sent a message",
  message_failed: "A message could not be delivered",
  replied: "Replied",
  rebooked: "Booked again",
  booked: "Booked online",
  opted_out: "Asked not to be contacted",
};

export default async function PatientPage(
  props: PageProps<"/app/patients/[id]">,
) {
  const { id } = await props.params;
  const { practice, session } = await requirePractice();

  const { data } = await session.supabase
    .from("patients")
    .select("*")
    .eq("id", id)
    .eq("practice_id", practice.id)
    .maybeSingle();

  if (!data) notFound();
  const patient = data as Patient;

  const { data: eventRows } = await session.supabase
    .from("patient_events")
    .select("id, type, occurred_at, meta")
    .eq("patient_id", patient.id)
    .order("occurred_at", { ascending: false })
    .limit(50);

  const events = (eventRows ?? []) as PatientEvent[];
  const away = monthsSince(patient.last_visit_at);
  const dormant = isDormant(patient, ruleFor(practice));

  const { data: conversationRow } = await session.supabase
    .from("whatsapp_conversations")
    .select("*")
    .eq("patient_id", patient.id)
    .eq("practice_id", practice.id)
    .maybeSingle();

  const conversation = conversationRow as WhatsAppConversation | null;

  let whatsappMessages: WhatsAppMessage[] = [];
  if (conversation) {
    const { data: messageRows } = await session.supabase
      .from("whatsapp_messages")
      .select("*")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true })
      .limit(100);
    whatsappMessages = (messageRows ?? []) as WhatsAppMessage[];
  }

  return (
    <div className="max-w-[46rem]">
      <Link
        href="/app/patients"
        className="text-[0.875rem] text-graphite underline underline-offset-4 hover:text-ink"
      >
        Back to patients
      </Link>

      <div className="mt-4 mb-6 flex flex-wrap items-center gap-3">
        <h1 className="display text-[1.75rem]">{patientName(patient)}</h1>
        {patient.status === "reactivated" ? (
          <Pill tone="rebooked">Rebooked</Pill>
        ) : patient.status === "opted_out" ? (
          <Pill>Opted out</Pill>
        ) : dormant ? (
          <Pill tone="teal">Gone quiet</Pill>
        ) : (
          <Pill>Active</Pill>
        )}
      </div>

      <Card>
        <PatientTimeline
          visitCount={patient.visit_count}
          monthsAway={away}
          rebooked={patient.status === "reactivated"}
        />

        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <Detail label="Email" value={patient.email ?? "none on file"} literal />
          <Detail label="Phone" value={patient.phone ?? "none on file"} literal />
          <Detail
            label="Last visit"
            value={formatDate(patient.last_visit_at)}
            literal
          />
          <Detail
            label="Visits on record"
            value={String(patient.visit_count)}
            literal
          />
        </dl>

        {!patient.consent_email && patient.email ? (
          <p className="notice notice-warn mt-5">
            This patient is marked as not contactable, so no campaign will
            include them.
          </p>
        ) : null}
      </Card>

      {conversation ? (
        <div className="mt-6">
          <WhatsAppConversationCard
            status={conversation.status}
            messages={whatsappMessages}
          />
        </div>
      ) : null}

      <div className="mt-6">
        <PatientActions
          patientId={patient.id}
          name={patientName(patient)}
          alreadyRebooked={patient.status === "reactivated"}
        />
      </div>

      <section className="mt-8">
        <h2 className="display mb-4 text-[1.25rem]">History</h2>
        {events.length === 0 ? (
          <Card>
            <p className="text-[0.9375rem] text-graphite">
              Nothing has happened yet.
            </p>
          </Card>
        ) : (
          <Card className="!p-0">
            <ul>
              {events.map((event, index) => (
                <li
                  key={event.id}
                  className={`flex flex-wrap items-baseline justify-between gap-2 px-6 py-3.5 ${
                    index > 0 ? "border-t border-ash/55" : ""
                  }`}
                >
                  <span className="text-[0.9375rem] text-graphite">
                    {EVENT_LABEL[event.type] ?? event.type}
                  </span>
                  <span className="literal text-[0.8125rem] text-stone">
                    {formatDate(event.occurred_at)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
}

function Detail({
  label,
  value,
  literal = false,
}: {
  label: string;
  value: string;
  literal?: boolean;
}) {
  return (
    <div>
      <dt className="label text-stone">{label}</dt>
      <dd
        className={`mt-1 text-[0.9375rem] text-ink ${literal ? "literal text-[0.875rem]" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}
