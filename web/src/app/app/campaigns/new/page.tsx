import { requireGym } from "@/lib/dal";
import { ruleFor } from "@/lib/lapse";
import { buildAudience } from "@/lib/campaigns";
import { bookingUrl, emailProvider } from "@/lib/messaging";
import { languageForCountry } from "@/lib/languages";
import { PageHeader, Notice, ButtonLink } from "@/components/app/ui";
import { CampaignForm } from "./form";

export const metadata = { title: "New campaign" };

export default async function NewCampaignPage() {
  const { gym } = await requireGym();

  const emailAudience = await buildAudience(gym.id, ruleFor(gym));
  const provider = emailProvider();

  return (
    <div className="max-w-[44rem]">
      <PageHeader
        eyebrow="New campaign"
        title="Write to the ones who stopped coming"
        lede={`${emailAudience.length} match your rule right now: no visit for ${gym.lapsed_after_months} months, at most ${gym.max_visits} on record.`}
      />

      {emailAudience.length === 0 ? (
        <Notice tone="warn">
          <span>
            Nobody matches yet, so there is nothing to send. Import your member
            list, or widen the window in settings.
          </span>
          <ButtonLink href="/app/import" variant="quiet">
            Import
          </ButtonLink>
        </Notice>
      ) : (
        <>
          {!provider.canSetReplyTo ? (
            <div className="mb-6">
              <Notice tone="warn">
                Replies will come to casdey rather than straight to you, because
                gym-branded sending is not switched on for this
                environment. Your address is written into the message so nobody
                is left without a way to reach you.
              </Notice>
            </div>
          ) : null}

          <CampaignForm
            gymName={gym.name}
            replyTo={gym.reply_to_email ?? gym.contact_email}
            emailAudienceCount={emailAudience.length}
            dailyCap={gym.daily_send_cap}
            emailSample={emailAudience[0] ?? null}
            sampleBookingUrl={
              gym.booking_enabled && emailAudience[0]
                ? bookingUrl(emailAudience[0].booking_token)
                : null
            }
            defaultLanguage={languageForCountry(gym.country)}
          />
        </>
      )}
    </div>
  );
}
