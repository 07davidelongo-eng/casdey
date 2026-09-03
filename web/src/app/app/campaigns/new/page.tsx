import { requireGym } from "@/lib/dal";
import { atRiskRuleFor, ruleFor } from "@/lib/lapse";
import {
  buildAtRiskAudience,
  buildAudience,
  buildWhatsAppAudience,
} from "@/lib/campaigns";
import { bookingUrl, emailProvider } from "@/lib/messaging";
import { languageForCountry } from "@/lib/languages";
import { supabaseAdmin } from "@/lib/supabase";
import { PageHeader, Notice, ButtonLink } from "@/components/app/ui";
import { CampaignForm } from "./form";

export const metadata = { title: "New campaign" };

export default async function NewCampaignPage() {
  const { gym } = await requireGym();

  const [winBackAudience, atRiskAudience, whatsAppAudience] = await Promise.all([
    buildAudience(gym.id, ruleFor(gym)),
    buildAtRiskAudience(gym.id, atRiskRuleFor(gym)),
    buildWhatsAppAudience(gym.id, ruleFor(gym)),
  ]);
  const provider = emailProvider();

  // The lean AudienceMember shape doesn't carry cancellation_reason (see
  // src/lib/campaigns.ts), so it's fetched separately for the one sample
  // member the preview renders against.
  const winBackSampleId = winBackAudience[0]?.id ?? null;
  const { data: winBackSampleRow } = winBackSampleId
    ? await supabaseAdmin()
        .from("members")
        .select("cancellation_reason")
        .eq("id", winBackSampleId)
        .maybeSingle()
    : { data: null };

  const nothingToShow =
    winBackAudience.length === 0 &&
    atRiskAudience.length === 0 &&
    whatsAppAudience.length === 0;

  return (
    <div className="max-w-[44rem]">
      <PageHeader
        eyebrow="New campaign"
        title="Write to the ones who stopped coming"
        lede={`${winBackAudience.length} to win back, ${atRiskAudience.length} worth checking in with early: no visit for ${gym.lapsed_after_months} months / ${gym.at_risk_after_days} days, at most ${gym.max_visits} on record.`}
      />

      {nothingToShow ? (
        <Notice tone="warn">
          <span>
            Nobody matches yet, so there is nothing to send. Import your member
            list, or widen the windows in settings.
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
            winBackAudienceCount={winBackAudience.length}
            atRiskAudienceCount={atRiskAudience.length}
            whatsAppAudienceCount={whatsAppAudience.length}
            whatsAppEnabled={gym.whatsapp_enabled}
            whatsAppTemplateSet={Boolean(gym.whatsapp_template_name)}
            dailyCap={gym.daily_send_cap}
            winBackSample={
              winBackAudience[0]
                ? {
                    first_name: winBackAudience[0].first_name,
                    last_visit_at: winBackAudience[0].last_visit_at,
                    cancellation_reason: winBackSampleRow?.cancellation_reason ?? null,
                  }
                : null
            }
            atRiskSample={
              atRiskAudience[0]
                ? {
                    first_name: atRiskAudience[0].first_name,
                    last_visit_at: atRiskAudience[0].last_visit_at,
                    cancellation_reason: null,
                  }
                : null
            }
            winBackSampleBookingUrl={
              gym.booking_enabled && winBackAudience[0]
                ? bookingUrl(winBackAudience[0].booking_token)
                : null
            }
            atRiskSampleBookingUrl={
              gym.booking_enabled && atRiskAudience[0]
                ? bookingUrl(atRiskAudience[0].booking_token)
                : null
            }
            defaultLanguage={languageForCountry(gym.country)}
          />
        </>
      )}
    </div>
  );
}
