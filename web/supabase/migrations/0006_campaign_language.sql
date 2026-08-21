-- Campaign language.
--
-- A gym serving EU members writes to them in their own language, not only
-- English. The language is chosen per campaign (it drives the AI draft and is
-- kept on the record), defaulting to the gym's country language. The body
-- itself already carries the final wording, so this is metadata, not the source
-- of truth for what gets sent.

alter table public.campaigns
  add column if not exists language text not null default 'en'
    check (language in ('en','nl','de','fr','es','pt','it'));

comment on column public.campaigns.language is
  'Language the campaign message is written in. Drives AI drafting and is kept for the record; the body holds the actual wording.';
