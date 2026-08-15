import { Card, CardTitle, Pill, formatDate } from "@/components/app/ui";
import type { WhatsAppConversationStatus, WhatsAppMessage } from "@/lib/types";

/**
 * The hand-off surface for roadmap #2. Read-only: booking itself is still
 * recorded with the existing "Mark as rebooked" action right below this on
 * the patient page (see ./actions-ui.tsx), same as it always was. This card
 * only tells the practice a conversation happened and, when the AI flagged
 * booking intent, makes that impossible to miss.
 */
export function WhatsAppConversationCard({
  status,
  messages,
}: {
  status: WhatsAppConversationStatus;
  messages: WhatsAppMessage[];
}) {
  return (
    <Card>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <CardTitle>WhatsApp conversation</CardTitle>
        <StatusPill status={status} />
      </div>

      {status === "booking_requested" ? (
        <p className="notice notice-info mt-2 mb-4">
          This patient told casdey&apos;s assistant they want to come in. Get
          in touch to arrange a time, then mark them as rebooked below.
        </p>
      ) : (
        <p className="mt-1 mb-4 text-[0.875rem] text-stone">
          {status === "opted_out"
            ? "This patient asked not to be contacted over WhatsApp again."
            : status === "closed"
              ? "The assistant stopped replying automatically after a long exchange. Read it through and follow up yourself if it needs one."
              : "The conversation so far."}
        </p>
      )}

      {messages.length === 0 ? (
        <p className="text-[0.9375rem] text-graphite">No messages yet.</p>
      ) : (
        <ul className="space-y-3">
          {messages.map((message) => (
            <li
              key={message.id}
              className={`max-w-[85%] rounded-[12px] px-4 py-2.5 text-[0.9375rem] leading-relaxed ${
                message.direction === "out"
                  ? "ml-auto bg-teal/10 text-ink"
                  : "bg-paper text-graphite"
              }`}
            >
              <p className="whitespace-pre-wrap">{message.body}</p>
              <p className="literal mt-1 text-[0.6875rem] text-stone">
                {formatDate(message.created_at)}
                {message.ai_generated ? " · assistant" : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function StatusPill({ status }: { status: WhatsAppConversationStatus }) {
  if (status === "booking_requested") return <Pill tone="rebooked">Wants to book</Pill>;
  if (status === "opted_out") return <Pill>Opted out</Pill>;
  if (status === "closed") return <Pill>Closed</Pill>;
  return <Pill tone="teal">Active</Pill>;
}
