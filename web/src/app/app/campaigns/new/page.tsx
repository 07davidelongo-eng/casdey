import { requirePractice } from "@/lib/dal";
import { ruleFor } from "@/lib/dormancy";
import { buildAudience } from "@/lib/campaigns";
import { bookingUrl, emailProvider } from "@/lib/messaging";
import { languageForCountry } from "@/lib/languages";
import { PageHeader, Notice, ButtonLink } from "@/components/app/ui";
import { CampaignForm } from "./form";

export const metadata = { title: "New campaign" };

export default async function NewCampaignPage() {
  const { practice } = await requirePractice();

  // Both channels' counts are computed up front (rather than fetched again
  // when the practice flips the channel selector) so switching channels in
  // the form is instant: no round trip needed, just two numbers already on
  // the page. Audience lists this size make two queries an easy trade.
  const [emailAudience, whatsappAudience] = await Promise.all([
    buildAudience(practice.id, ruleFor(practice), "email"),
    buildAudience(practice.id, ruleFor(practice), "whatsapp"),
  ]);
  const provider = emailProvider();

  return (
    <div className="max-w-[44rem]">
      <PageHeader
        eyebrow="New campaign"
        title="Write to the ones who stopped coming"
        lede={`${emailAudience.length} by email and ${whatsappAudience.length} by WhatsApp match your rule right now: no visit for ${practice.dormant_after_months} months, at most ${practice.max_visits} on record.`}
      />

      {emailAudience.length === 0 && whatsappAudience.length === 0 ? (
        <Notice tone="warn">
          <span>
            Nobody matches yet, so there is nothing to send. Import your patient
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
                practice-branded sending is not switched on for this
                environment. Your address is written into the message so nobody
                is left without a way to reach you.
              </Notice>
            </div>
          ) : null}

          <CampaignForm
            practiceName={practice.name}
            replyTo={practice.reply_to_email ?? practice.contact_email}
            emailAudienceCount={emailAudience.length}
            whatsappAudienceCount={whatsappAudience.length}
            dailyCap={practice.daily_send_cap}
            emailSample={emailAudience[0] ?? null}
            sampleBookingUrl={
              practice.booking_enabled && emailAudience[0]
                ? bookingUrl(emailAudience[0].booking_token)
                : null
            }
            defaultLanguage={languageForCountry(practice.country)}
            whatsappEnabled={practice.whatsapp_enabled}
            whatsappTemplateName={practice.whatsapp_template_name}
          />
        </>
      )}
    </div>
  );
}
