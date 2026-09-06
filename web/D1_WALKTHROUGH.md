# D1 walkthrough: Davide's findings and the fixes

Track D1 in `SAAS_V1_PLAN.md` is Davide's own end to end walkthrough of the
product before V1 is published. This file is the record of it: what he found,
in his own words, and what was done about each item.

**Rule for this file: Davide's points are copied verbatim and never edited,
summarised, or "cleaned up".** His wording carries intent that a paraphrase
loses. Anything written by Claude goes under a clearly separated heading.

Status values: `open` (nothing done), `needs decision` (blocked on a Davide
answer, see the questions section), `done` (shipped and awaiting his re-check),
`accepted` (Davide has looked at the fix and is happy).

---

## Batch 1, 2026-09-06

Covered in this pass: the landing page (whole), part of Settings, the Offer
page. Verbatim below.

> Problem #1: When I log into one account, then I log out, and thne I sign in and click on the "continue with google" button, it automatically signs me in on that previous account... not a big deal, but this has to be fixed just in case a client has more than one email (like I do) and created the account with the wrong email by accident
>
> #2: I don't get the "Four screens, and your team touches one of them." in the landing page... it's not really understandable what it means
>
> #3: what the heck is the thing my cursor is on in the first screenshot attached
>
> #4: in the software, there should be a setting to switch between light mode (the current one) and dark mode
>
> #5: both in the billing setting and in the pricing page, the "profit or nothing" guarantee has to be highlighted more... like that's a real point of strength and marketing of the business
>
> #6: the q&a in the pricing page should have a dropdown for each question (and the whole block should be moved below the "Questions a gym owner actually asks."
>
> #7: in the copy of the website emphasize the value proposition of casdey, which is winning back ex members done automatically on your behalf without you having to worry about it because they will just get those people booked againg (here I phrased it very badly, but you get the point... improve the copy)...
>
> #8: this is connected to the previous point and it is that in the how it works section, it's not really clear to a normal person that casdey will automatically contact them, and even follow up (if this follow up feature isn't included, together with the personalized message EX-MEMBER per EX-MEMBER, then you shoukd ABSOLUTELY DO THEM NOW... casdey in fact is like an employee of theirs who reaches out to each one of them in a personalized way... so there should be the whole process of contacting with follow ups, and personalization... even on whatsapp, not just emails) and do whatever and get them on a calendar and all they'll have to do is import their list
>
> #9: I don't think I like having the text descriptions besides the titles both for the "Everything your gym software does starts with someone walking in." one and the "Built to protect your members' data from the first line of code."... like the text should be below, or organized in another way
>
> #10: in the landing page / website there should be definitely be added a Contact Us page that has our Instagram (@casdey.co) and emails
>
> #11: I think that the "what counts as lapsed" thing in the settings shoukd be more customisible and have the sbility not only to put months but even days... and also, I guess that the "came at most" thing should be like a box that can be checked on and off if the gym owner wants to have that (it shouldn't be mandatory to have that)
>
> #12: there has to be a thing to save my ass in case some gym owners lie with their numbers... like, if they put that their cost is €10, while in reality is €100, what casdey will appear to have done will be fake and unjust... this would be a problem especially for the guarantee thing
>
> #13: slightly connected to the prev point... why is there a "What a returning member is worth" thing in the Gym settings if there exists a dedicated section where the gym displays their service prices... in fact in that description you said "...What a recovered member is worth to you is a separate setting, and it is the one the revenue estimate and the guarantee actually use."... which doesn't make sense, also based on point #12 where I need to save my ass
>
> #14: in the service prices section, there shoud be a thing that lets the gym select between a una tantum and recurring (and what type of recurring, monthly, weekly, bimestral, trimestral, weekly, etc)... it would be good also to translate this into the overview of what they got back (like, besides the overall number, you could also put a "of which €X is recurring revenue" or things like that
>
> #15: also the slot shape in the booking thins doesn't make sense that much because it is fixed for everything while instead it should be tied to a selected service they offer (let's say they offer a yoga session and a gym session... of course, when they add the services, they will put on the switch for the slot shape just for the yoga session, which they will be able to modify on that same services page (maybe you should also rename it because there they will organize not only the pricing but the overall service they offer, suchh as the slot shape...)...besides that, of course there should be stuff like how many slots are available for that (like they can put a limit of 20 for example so that there won't be an overbooking or stuff like that)... also, to keep talking about the service page, make sure you add as many useful features and setting for each service that gets added as possible (so there should be a remake of that page)
>
> #16: make sure that on those pages where you need to save changes, whenever you try to change page and you have unsaved changes, there will be like a warning where they can either continue without saving or save
>
> #17: the import button on the second screenshot attached as you can see is basically attached to the text
>
> #18: in the offer page and the "Give them a reason to come back" thing, below the typeform like questions thing, there should be a button or something where they will be able to manually add their own offer to win customers back... also, this page's scope isn't really that clear... it should say that it's gonna help them craft an offer to geth those members back... also, I saw that it generalizes for every member... while each one of them may have a different reason... so maybe there should be a way to have more tailored solutions... also, when I try to save an offer with the "save this offer button" nothing happens like the button doesn't work... getting back to what I was saying, there should be a way so that the customers in the waitlist get tagged each with the reason they left (either from the starting point, os thanks to the outreach that casdey does where it goes to discover that (THIS IS REALLY IMPORTANT) and then they get a tailored and connected to an offer which gets created in this very page... so it has to be precise and follow everything that I just said.

---

## Status board

| # | One line | Area | Size | Status |
|---|----------|------|------|--------|
| 1 | Google sign in reuses the last account, no account chooser | auth | S | done |
| 2 | "Four screens, and your team touches one of them" is not understandable | landing | S | done |
| 3 | Stray vertical scrollbar on the Settings tab strip | app chrome | XS | done |
| 4 | Light/dark mode switch in the app | app | M | done |
| 5 | Profit or nothing guarantee needs far more weight | billing + pricing | S | done |
| 6 | Pricing Q&A needs per question dropdowns, moved below its heading | pricing | S | done |
| 7 | Site copy must lead with the value proposition | landing | M | done |
| 8 | How it works must show contact, follow up, personalisation, booking. Build the missing ones | landing + product | L | done |
| 9 | Side by side title and description reads badly in two sections | landing | S | done |
| 10 | Contact page with @casdey.co and the email addresses | site | S | done |
| 11 | Lapsed rules: days as well as months, "came at most" optional | settings | M | done |
| 12 | Guard against gyms overstating their numbers, guarantee exposure | product | L | needs decision |
| 13 | "What a returning member is worth" duplicates Service prices | settings | M | needs decision |
| 14 | Services: one off vs recurring, and recurring split in the overview | settings + overview | M | done |
| 15 | Slot shape belongs per service, plus capacity. Rebuild the page | settings + booking | L | done |
| 16 | Unsaved changes warning on navigation | app wide | M | done |
| 17 | Import button collides with the text in the campaigns empty state | app | XS | done |
| 18 | Offer page: manual offer, clearer scope, per member reasons and tailored offers, broken save button | offer | L | done |

Sizes are rough: XS is minutes, S under an hour, M a session's slice, L its own
piece of work with decisions inside it.

---

## Claude's notes, per item

Written by Claude, not Davide. Kept apart from the verbatim block above.

**#3 is diagnosed.** Not a casdey widget and not part of any design. The
Settings tab strip is `overflow-x-auto`, and CSS turns the other axis into
`auto` as soon as one axis is not `visible`. The active tab's `-mb-px` makes
the content 48px tall inside a 47px box, so Windows Chrome paints a real
vertical scrollbar for that one stray pixel. Confirmed live:
`scrollHeight 48 / clientHeight 47`, `offsetWidth 939 / clientWidth 924`. Fix
is `overflow-y-hidden` on that nav.

**#8 contains a build question, not just a copy question.** Davide's
instruction is that if per member personalisation and follow ups do not exist,
they get built now. Current state must be established before touching the copy,
because the landing page cannot describe either one until it is true.

**#12 and #13 are the same problem seen from two sides.** A gym types the
number that the guarantee refund is computed against. Today nothing checks it
against anything. #13 asks why that number exists at all when Service prices
already holds real prices.

**#18 has a bug inside a feature request.** The dead "Save this offer" button
is a defect to diagnose on its own, separately from the tagging and tailoring
work in the same point.

---

## Open questions for Davide

Raised by Claude. These block the items marked `needs decision`.

1. **#12, what should casdey do when it cannot trust a number?** Options are
   very different in weight: cap the guarantee refund at a sane ceiling, require
   evidence before a claim is paid, derive the value from Service prices instead
   of a typed figure, or review claims by hand while the customer count is small.
2. **#13, should the single "What a returning member is worth" field be deleted
   and the value derived from Service prices?** That is the change #12 points
   at, and it removes the field Davide is objecting to.

---

## Coverage

What the walkthrough has and has not reached, so the next pass knows where to
start.

- Seen: landing page, `/pricing`, Settings, Gym tab, Offer page, the campaigns
  empty state.
- Not seen yet: Overview, Members, Import, Campaigns beyond the empty state, the
  booking flow a member actually sees, Settings tabs for Service prices,
  Booking, Sending, WhatsApp, Billing, Data and privacy, sign up, password
  reset, `/waitlist`, `/privacy`, the processing terms.

---

## What is left, and why

**#8, the personalisation half, is the only buildable item still open, and it
has an infrastructure conflict Davide should decide on.**

Follow-ups shipped. Per-member merge fields already existed and now carry the
reason-specific offer too, so a message says the member's name, how long they
have been away, why they left where casdey knows it, and an offer written for
that reason. What Davide asked for beyond that is a message genuinely written
for each ex-member, which means an LLM call per member.

The cost is not the problem: Haiku is roughly a twentieth of a cent a message,
and `ANTHROPIC_API_KEY` is already in Vercel. The problem is where the call
would go.

- At send time, inside `drainQueue()`. That loop has a 50-second budget on
  Vercel Hobby's 60-second ceiling, and one cron run per day. Adding a
  one-to-two second call per message cuts a run from ~200 messages to ~30.
- At queue time, inside the approve action. A 200-member campaign becomes a
  200-second request, which no serverless request survives.
- In a background job, which is the right answer and needs a queue casdey does
  not have.

So it is genuinely blocked on the same Vercel Pro decision that is already
deferred (hourly crons, longer functions), rather than on the code. Worth
pairing with the Resend Pro trigger in `SAAS_V1_PLAN.md` G1a.

---

## #8 personalisation: built, and one thing to buy

Shipped after the section above was written, so that section's conclusion is
superseded. The throughput problem it describes is real but does not bite yet:
at Resend's free ceiling casdey can send about 25 product emails a day, and 25
personalised messages fit inside the send job's 50-second budget comfortably.
It becomes a problem on the same day Resend Pro lifts that ceiling, and Vercel
Pro solves it, so the two upgrades belong together at the first real customer.

**A separate thing was found while proving it works: the Anthropic account has
no credit balance.** A live call answers:

    400 invalid_request_error
    "Your credit balance is too low to access the Anthropic API."

The key in Vercel is valid and the request is well formed. There is simply no
money behind it. This is a prepaid top-up, not a subscription.

It affects more than personalisation: the WhatsApp AI reply loop (Track E1)
calls the same API with the same key, so it has never been able to answer a
member either. Nothing breaks loudly in either case, which is why it went
unnoticed. Personalisation falls back to the gym's template and the message
still goes out; the WhatsApp loop logs the failure and stays quiet.
