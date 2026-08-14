import { requirePractice } from "@/lib/dal";
import { ruleFor } from "@/lib/dormancy";
import { buildAudience } from "@/lib/campaigns";
import { emailProvider } from "@/lib/messaging";
import { languageForCountry } from "@/lib/languages";
import { PageHeader, Notice, ButtonLink } from "@/components/app/ui";
import { CampaignForm } from "./form";

export const metadata = { title: "New campaign" };

export default async function NewCampaignPage() {
  const { practice } = await requirePractice();

  const audience = await buildAudience(practice.id, ruleFor(practice));
  const provider = emailProvider();

  return (
    <div className="max-w-[44rem]">
      <PageHeader
        eyebrow="New campaign"
        title="Write to the ones who stopped coming"
        lede={`${audience.length} ${
          audience.length === 1 ? "patient matches" : "patients match"
        } your rule right now: no visit for ${practice.dormant_after_months} months, at most ${practice.max_visits} on record, and an email address on file.`}
      />

      {audience.length === 0 ? (
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
            audienceCount={audience.length}
            dailyCap={practice.daily_send_cap}
            sample={audience[0] ?? null}
            defaultLanguage={languageForCountry(practice.country)}
          />
        </>
      )}
    </div>
  );
}
