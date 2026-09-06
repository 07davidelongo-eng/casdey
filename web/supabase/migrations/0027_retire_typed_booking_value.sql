-- gyms.booking_value_minor is retired: casdey no longer asks a gym to type
-- what a recovered member is worth.
--
-- From Davide's D1 walkthrough, points #12 and #13, which turned out to be one
-- problem seen from two sides.
--
-- #13 was the obvious half: the gym already tells casdey what everything
-- costs, on the Services page, so asking again for a single "typical value" was
-- asking the same question twice and getting two answers that could disagree.
--
-- #12 was the dangerous half. That typed number was what the profit-or-nothing
-- guarantee measured itself against, and nothing checked it. A gym typing 500
-- against a 50 euro membership made casdey liable for a shortfall against a
-- figure casdey had no way to verify, and one typing 10 made a working product
-- look useless. A promise about money cannot be judged against a number one
-- side of the deal invented.
--
-- Service prices fix both at once, and they are self-policing in a way a
-- private settings field never was: they are the same prices members read on
-- the booking page. A gym inflating them to flatter its casdey dashboard is
-- quoting those prices to its own customers.
--
-- The column is left in place rather than dropped. Local development and
-- production share this database, so dropping it would break the deployed app
-- the moment this ran. Nothing reads it any more.

comment on column public.gyms.booking_value_minor is
  'DEPRECATED and unread since 0027. Recovered revenue is now the sum of bookings.value_minor, each frozen from the price of the service booked. See src/lib/revenue.ts. Safe to drop once no deployed build references it.';
