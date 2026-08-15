import { requirePractice } from "@/lib/dal";
import { Button, ButtonLink, Card, CardTitle, Notice } from "@/components/app/ui";
import { calendarConnectionView } from "@/lib/calendar/provider";
import { isGoogleCalendarConfigured } from "@/lib/calendar/google";
import { isCalendarKeyConfigured } from "@/lib/calendar/tokens";
import { BookingSettingsForm } from "./form";

export const metadata = { title: "Booking" };

export default async function BookingSettingsPage(
  props: PageProps<"/app/settings/booking">,
) {
  const { practice, role } = await requirePractice();
  const params = await props.searchParams;

  const connection = await calendarConnectionView(practice.id);
  const configured = isGoogleCalendarConfigured() && isCalendarKeyConfigured();
  const isOwner = role === "owner";

  const error = typeof params.error === "string" ? params.error : null;
  const justConnected = params.connected === "1";
  const justDisconnected = params.disconnected === "1";

  return (
    <div className="max-w-[42rem] space-y-6">
      {role !== "owner" ? (
        <Notice tone="warn">
          Only the practice owner can change these. You can read them.
        </Notice>
      ) : null}

      {error ? <Notice tone="error">{error}</Notice> : null}
      {justConnected ? (
        <Notice tone="info">Google Calendar connected.</Notice>
      ) : null}
      {justDisconnected ? (
        <Notice tone="info">Google Calendar disconnected.</Notice>
      ) : null}

      <Card>
        <CardTitle>Google Calendar</CardTitle>
        <p className="mb-5 text-[0.875rem] text-stone">
          Connect a Google Calendar and casdey reads your free/busy so it never
          offers a slot you are already in, and writes each booking straight into
          that calendar. Booking still works without one; it just cannot see
          appointments made outside casdey.
        </p>

        {!configured ? (
          <Notice tone="warn">
            Calendar connection is not set up on this server yet.
          </Notice>
        ) : connection.connected ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-[0.9375rem] text-ink">
              Connected
              {connection.email ? (
                <>
                  {" "}
                  as <span className="literal">{connection.email}</span>
                </>
              ) : null}
              .
            </p>
            {isOwner ? (
              <form action="/api/calendar/google/disconnect" method="post">
                <Button type="submit" variant="danger">
                  Disconnect
                </Button>
              </form>
            ) : null}
          </div>
        ) : isOwner ? (
          <ButtonLink href="/api/calendar/google/connect" variant="quiet">
            Connect Google Calendar
          </ButtonLink>
        ) : (
          <p className="text-[0.9375rem] text-stone">Not connected.</p>
        )}
      </Card>

      <BookingSettingsForm practice={practice} readOnly={!isOwner} />
    </div>
  );
}
