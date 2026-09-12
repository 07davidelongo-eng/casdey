# casdey HQ

The one page that says what casdey sells, what it costs to run, and what it earns.
Everything else lives in the repo. Keep this short.

Last updated: 12 September 2026 · Sole founder: Davide · No legal entity yet (no P.IVA)

---

## 1. The offer

A gym imports its member list. casdey finds everyone who stopped coming, writes to each
one individually in the gym's name, follows up when they go quiet, answers the replies,
and books them back in. The gym's only job is the import.

What a new gym gets, in order:

1. A first week of Pro for €1. Card at signup, everything casdey does for seven days.
2. Then Pro simply continues, unless the gym cancels during the week, which costs
   nothing and leaves them on the Free plan: import and see who lapsed, forever, free.
3. A lifetime 20% discount on either paid tier, kept for as long as they stay.
4. Profit or nothing, Pro only. One 30-day window. If casdey recovers less than it
   charged, the gym refunds itself in one click. No review, no argument. Once per gym, ever.

---

## 2. Prices

| Plan | Free | Standard | Pro |
| --- | --- | --- | --- |
| Monthly | €0 | €99 | €289 |
| Yearly, 2 months free | — | €990 | €2,890 |
| With the 20% early discount | — | €79.20 | €231.20 |
| Members held | 50 | 200 | 2,000 |
| Email win-back | no | yes | yes |
| WhatsApp channel | no | no | yes |
| Profit-or-nothing guarantee | no | no | yes |

GBP is kept for the UK at its own round numbers, £89 and £249, not a live conversion.
Prices exclude VAT.

---

## 3. What casdey costs to run

Fixed cost today: 20 dollars a month. That is the whole bill.

| Software | What it does | Cost now | Cost when it matters |
| --- | --- | --- | --- |
| Resend | All email, product and cold outreach | $20/mo Pro | 10 domains, so about 8 gyms with their own sending identity |
| Vercel | Hosts casdey.com and the app | $0 Hobby | $20/mo Pro, for hourly sending. Hobby caps cron at once a day |
| Supabase | Database and auth | $0 Free | about $25/mo Pro when the free tier bites |
| Anthropic | Writes each message, and WhatsApp replies | prepaid, $5 loaded | about $0.002 per message |
| Twilio | WhatsApp channel, Pro only | prepaid, $18.85 | per message, varies by country |
| Stripe | Takes the money | no fixed fee | about 1.5% + €0.25 per EU card charge |
| Zoho Mail | casdey's own mailboxes | $0 | — |
| GitHub | Code | $0 | — |
| GoDaddy | The domain | annual | check the renewal price |

EUR figures assume 1 dollar is about 0.92 euro.

---

## 4. What one gym actually costs

Per paying gym per month, on a 200-member list with two follow-ups, so about 600 messages.

| Line | Standard | Pro |
| --- | --- | --- |
| Revenue, with the 20% discount | €79.20 | €231.20 |
| Stripe fee | about €1.44 | about €3.72 |
| Anthropic | about €1.10 | about €1.10 |
| Resend | €0, inside the $20 flat | €0 |
| Twilio WhatsApp | — | about €13 if heavily used |
| Gross margin | about €76 | about €213 |
| Margin | about 96% | about 92% |

The only variable cost that moves meaningfully is WhatsApp, priced per message by
country, and Pro only.

---

## 5. Break-even

One Standard gym covers everything, roughly four times over.

- Fixed cost today, about €18 a month. Break-even is one gym on any paid tier.
- After Vercel Pro and Supabase Pro, about €60 a month. Still one gym.

Infrastructure is not the constraint. Customers are.

---

## 6. Where it stands, 12 September 2026

- casdey.com is published. The product is live and open to anyone.
- V1 is complete. Every gate closed, including a live card checkout end to end.
- V1.1 is live: the first week is sold for €1, and Pro starts on day 7 unless cancelled.
- Paying customers: 0. Real signups: 1, BodyActive Skibbereen, not yet imported.
  The waitlist's 3 rows were test signups and have been removed.
- Built: import, lapse detection, campaigns, per-member writing, follow-ups, replies,
  booking into Google Calendar, the guarantee, three tiers, per-gym sending domains.
- Outreach live at 100 first-touch emails a day plus every due follow-up, and a weekly
  subject-line A/B test.
- Strongest signal so far: 5 of the 6 genuine replies came from CrossFit and community boxes.

---

## 7. Open

| What | Who |
| --- | --- |
| A real gym CSV export, LegitFit first, to test import against | Davide |
| WhatsApp needs a Meta-approved sender per gym, manual until casdey has a legal entity | per gym |
| Vercel Pro, for hourly sending rather than once a day | when a gym is sending |
| Direct integrations, Mindbody and TeamUp | later |
| Partita IVA, likely required already for recurring revenue. Parked until money comes in | Davide |

Next milestone: the first paying gym. Everything above is sized for it.

---

*This document is generated. Edit `casdey-hq.md` in the casdey repo and run
`npm run doc:push` from `web/`. Edits made here are overwritten by the next push.*
