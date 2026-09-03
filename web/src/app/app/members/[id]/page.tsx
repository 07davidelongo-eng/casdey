import Link from "next/link";
import { notFound } from "next/navigation";

import { requireGym } from "@/lib/dal";
import { isLapsed, monthsSince, ruleFor } from "@/lib/lapse";
import { MemberTimeline } from "@/components/app/member-timeline";
import { MemberActions } from "./actions-ui";
import { WhatsAppConversationCard } from "./whatsapp-conversation";
import { Card, Pill, formatDate, memberName } from "@/components/app/ui";
import type {
  Member,
  MemberEventType,
  WhatsAppConversationStatus,
  WhatsAppMessage,
} from "@/lib/types";

type MemberEvent = {
  id: string;
  type: MemberEventType;
  occurred_at: string;
  meta: Record<string, unknown>;
};

const EVENT_LABEL: Record<MemberEventType, string> = {
  imported: "Added from an import",
  message_sent: "casdey sent a message",
  message_failed: "A message could not be delivered",
  replied: "Replied",
  returned: "Booked again",
  return_undone: "Return undone",
  booked: "Booked online",
  opted_out: "Asked not to be contacted",
  cancelled: "Marked as cancelled",
};

export default async function MemberPage(
  props: PageProps<"/app/members/[id]">,
) {
  const { id } = await props.params;
  const { gym, session } = await requireGym();

  const { data } = await session.supabase
    .from("members")
    .select("*")
    .eq("id", id)
    .eq("gym_id", gym.id)
    .maybeSingle();

  if (!data) notFound();
  const member = data as Member;

  const { data: eventRows } = await session.supabase
    .from("member_events")
    .select("id, type, occurred_at, meta")
    .eq("member_id", member.id)
    .order("occurred_at", { ascending: false })
    .limit(50);

  const events = (eventRows ?? []) as MemberEvent[];
  const away = monthsSince(member.last_visit_at);
  const lapsed = isLapsed(member, ruleFor(gym));

  // The WhatsApp thread, if this member has ever been contacted that way. RLS
  // scopes both reads to the gym (see 0014_whatsapp_channel_gym.sql).
  const { data: conversationRow } = await session.supabase
    .from("whatsapp_conversations")
    .select("id, status")
    .eq("member_id", member.id)
    .maybeSingle();

  const { data: waMessageRows } = conversationRow
    ? await session.supabase
        .from("whatsapp_messages")
        .select("id, created_at, conversation_id, gym_id, direction, body, provider_message_id, ai_generated")
        .eq("conversation_id", conversationRow.id)
        .order("created_at", { ascending: true })
        .limit(100)
    : { data: null };

  return (
    <div className="max-w-[46rem]">
      <Link
        href="/app/members"
        className="text-[0.875rem] text-graphite underline underline-offset-4 hover:text-ink"
      >
        Back to members
      </Link>

      <div className="mt-4 mb-6 flex flex-wrap items-center gap-3">
        <h1 className="display text-[1.75rem]">{memberName(member)}</h1>
        {member.status === "returned" ? (
          <Pill tone="returned">Returned</Pill>
        ) : member.status === "opted_out" ? (
          <Pill>Opted out</Pill>
        ) : lapsed ? (
          <Pill tone="teal">Gone quiet</Pill>
        ) : (
          <Pill>Active</Pill>
        )}
      </div>

      <Card>
        <MemberTimeline
          visitCount={member.visit_count}
          monthsAway={away}
          returned={member.status === "returned"}
        />

        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <Detail label="Email" value={member.email ?? "none on file"} literal />
          <Detail label="Phone" value={member.phone ?? "none on file"} literal />
          <Detail
            label="Last visit"
            value={formatDate(member.last_visit_at)}
            literal
          />
          <Detail
            label="Visits on record"
            value={String(member.visit_count)}
            literal
          />
        </dl>

        {!member.consent_email && member.email ? (
          <p className="notice notice-warn mt-5">
            This member is marked as not contactable, so no campaign will
            include them.
          </p>
        ) : null}
      </Card>

      {conversationRow ? (
        <div className="mt-6">
          <WhatsAppConversationCard
            status={conversationRow.status as WhatsAppConversationStatus}
            messages={(waMessageRows ?? []) as WhatsAppMessage[]}
          />
        </div>
      ) : null}

      <div className="mt-6">
        <MemberActions
          memberId={member.id}
          name={memberName(member)}
          alreadyReturned={member.status === "returned"}
          cancellationReason={member.cancellation_reason}
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
