-- Flag the one remaining casdey-owned test gym as internal.
--
-- 0035 added gyms.is_internal and flagged the four gyms that carried a Stripe
-- subscription (three test-mode stress-test subs plus Davide's own
-- C1-walkthrough account), because those were the rows inflating the "paying
-- customers" count on /admin.
--
-- It missed "Bridge Street Gym" — the test@casdey.com fixture from
-- SAAS_HANDOFF.md's "Local testing" section. It has no subscription, so it was
-- never a paying-count problem, but it does carry fixture data: 12 members,
-- three of them "returned", a cancelled campaign, and one booked £120 booking.
-- That £120 was showing up as real recovered revenue in the new "Product
-- reach" section, and its members/campaigns were padding every all-gym count.
--
-- After this, the only gym with is_internal = false is "BodyActive
-- Skibbereen", casdey's first genuine signup (bodyactiveskibb@gmail.com,
-- 2026-09-07). Everything casdey did for testing now lives behind the flag,
-- where /admin's "Test & dev" section reports it separately from the business.

update public.gyms
set is_internal = true
where id = '6323cffc-16d4-42ca-b2a1-cf2f7916cba0'  -- Bridge Street Gym
  and is_internal is distinct from true;
