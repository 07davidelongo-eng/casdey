-- casdey writes each message for the one person it is going to.
--
-- From Davide's D1 walkthrough, point #8: casdey is meant to behave like a
-- member of staff who reaches out to each ex-member personally, and a template
-- with their first name dropped into it is a mail merge wearing a name badge.
--
-- Two columns, and the second one is the important one.
--
-- campaigns.personalise is the switch. Per campaign rather than per gym,
-- because a gym might want its careful win-back written individually and its
-- routine check-in sent as one clean template, and that is a reasonable thing
-- to want.
--
-- campaign_messages.personalised_body is what was actually written for that
-- member, saved at send time. It exists so the message a member received can
-- always be read back exactly, which a template plus a model cannot promise:
-- re-running the same prompt tomorrow produces different words. Without it,
-- "what did you send my member?" has no truthful answer, and on a plan that
-- refunds itself when the campaign does not work, that question will be asked.

alter table public.campaigns
  add column personalise boolean not null default false;

comment on column public.campaigns.personalise is
  'Write each message individually for the member it is going to, instead of sending one template to everyone. Falls back to the template per message if the model is unavailable. See src/lib/personalise.ts.';

alter table public.campaign_messages
  add column personalised_body text;

comment on column public.campaign_messages.personalised_body is
  'The body actually sent, when it was written for this member. Null means the campaign template was used, either because personalisation was off or because it failed and the send fell back. Kept because a model does not produce the same words twice, so this is the only record of what the member read.';
