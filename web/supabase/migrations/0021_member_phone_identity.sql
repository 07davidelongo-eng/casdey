-- Members identified by phone number.
--
-- Until now a row with a phone number but no email address and no member
-- reference was thrown away at import, on the reasoning that there was "no way
-- to contact them". That stopped being true when WhatsApp came back as the Pro
-- channel: a member with a number and no email is exactly who that channel
-- exists to reach, and dropping them at the door meant Pro could never write to
-- the people it was sold on.
--
-- Storing them needs a conflict target, or a repeat import would insert the
-- same member every month.
--
-- Plain unique index, not partial and not on an expression, for the same two
-- reasons the email and external_ref indexes give in 0002: Postgres treats
-- NULLs as distinct, so any number of members may have no phone at all, and
-- ON CONFLICT can only infer an index from a bare column list. Phone numbers
-- are normalised to E.164 by the application at parse time (see
-- normalizePhoneForCountry), so a plain index is enough.
--
-- Any gym that already stores two members on one number would block this
-- index, so the duplicates are cleared first: the older row keeps the number
-- and the later ones have it removed rather than being deleted. Nobody loses a
-- member record, and the affected members simply have no phone until the gym
-- re-imports a corrected file. Expected to affect nothing today; written to be
-- safe rather than to be optimistic.

update public.members m
set phone = null
where m.phone is not null
  and exists (
    select 1
    from public.members earlier
    where earlier.gym_id = m.gym_id
      and earlier.phone = m.phone
      and (earlier.created_at, earlier.id) < (m.created_at, m.id)
  );

create unique index if not exists members_gym_phone_key
  on public.members (gym_id, phone);
