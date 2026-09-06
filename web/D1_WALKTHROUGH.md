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
| 12 | Guard against gyms overstating their numbers, guarantee exposure | product | L | done |
| 13 | "What a returning member is worth" duplicates Service prices | settings | M | done |
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

- Seen, batch 1: landing page, `/pricing`, Settings Gym tab, Offer page, the
  campaigns empty state.
- Seen, batch 2: Overview, Import, Campaigns including creating one, Settings
  Services, Billing and Data and privacy, the Offer page again, the new
  Contact page, the landing page again.
- Seen, batch 3: Settings again (Gym, Services, Data and privacy), the Offer
  page again, Campaigns including trying to approve and test one, Import
  again, Overview again, Members.
- Not seen yet, or not commented on: a member's own page, the booking flow a
  member actually sees, the new Calendar page, Settings Booking, Sending and
  WhatsApp, sign up, password reset, `/waitlist`, `/privacy`, the processing
  terms.

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

---

## #12 and #13, answered

Davide's decision, 2026-09-06: derive the value from the Services page, and
delete the typed field. And, explicitly, **no average**. Each booking counts at
the price of the service it was actually for, and they add up: a member back on
a 50 euro membership plus a member back for one 20 euro class is 70 euros.

His reasoning is the part worth keeping, because it is what makes this
self-policing rather than merely tidier:

> they also have to know that it is these very services that gets displayed in
> the messages sent to the customers... so they shouldn't lie because they
> would be lying to their customers too

That is exactly right, and it is why service prices can carry a guarantee where
a private settings field never could. The number casdey is held to and the
number a member reads on the booking page are now the same number.

**What changed.** `gyms.booking_value_minor` is unread (deprecated in
migration 0027, not dropped, because production shares this database).
Recovered revenue, on both the dashboard and the guarantee, is the sum of
`bookings.value_minor`, each frozen at booking time from the service booked.
The guarantee ledger is one row per booking, so adding the rows up lands
exactly on the figure a claim is judged against.

**Two consequences worth knowing.**

A booking with no service picked is worth zero rather than being guessed at,
and the count of those is shown rather than quietly depressing the total.

A member marked returned by staff who never booked anything through casdey now
contributes nothing to the figure. That is the honest reading of "value each
booking at its own price", and it is a real change: gyms whose members reply by
email and get booked by hand will see a lower number than they might expect.
The fix is for those bookings to go through casdey, which is also what the
product is for.

The old guard against an unset value is kept and redefined: a gym that has
never priced a single service reads as zero for reasons that have nothing to do
with whether casdey worked, so a shortfall there routes to review rather than
to an automatic self-serve refund.

---

## Batch 2, 2026-09-06

Covered in this pass: Overview, Settings (Gym, Services, Billing, Data and
privacy), Import, Campaigns, the Offer page again, the Contact page, the
landing page again. Six screenshots came with it: the issue box bottom left,
the Billing plan card, Gym settings unscrolled, Gym settings scrolled, a Gmail
compose window as the editor reference, and the Overview dashboard. Verbatim
below.

> #19: There's that issue box appearing constantly on the bottom left.
>
> #20: On the billing page, the guarantee box you added should be put under the Pro prices... where it currently stands is not very right
>
> #21: on the contact page, DO NOT ABSOLUTELY SAY that there's 2 of us... wtf. Just treat casdey as an established company with a team, so they will be able to contact info@casdey.com and instagram, I wouldn't put the personal ones.
>
> #22: those titles in the landing page, like the "Everything your gym software does starts with someone walking in." and "Built to protect your members' data from the first line of code." and "Free for a week. Then free until you say otherwise." should be expanded to the whole page length without going on a new line in the middle out of nowhere.
>
> #23: when I try to save changes in the gym (WHICH BTW shouldn't be just "gym" because as we said casdey also helps studios, so change the naming to a more general one even on other copy you found across the software) page in the settings and I toggle off the "and they came at most" thing, when I save changes it automatically turns on back again... what the hell... also, if I press save changes after I already saved changes (so I literally click the button twice), a red thing appears saying "The visit ceiling has to be a whole number from 1 to 200." which doesn't make sense.
>
> #24: the "charged" dropdown in the servuces page should be more customizible... (because like what if a business has something that charges every 5 months?... so make it pretty customizble)... besides that, on the members can book this toggle, the 3 boxes where they have to input the numbers aren't very clear and understandable... like what do they mean? (I kinda got them, but they should be explained better... you don't have to remove them or change them but just explain them better)... oh and also, I don't know if it's because I set my gym inside Italy, but I hope that the price in "€" is not fixed for each country that gets selected (but instead I hope you are basing it based on what country the gym is in)
>
> #25: also in the services page, each service should be a dropdown... like if a gym has 20 services, they would have to scroll a lot to get to the desired service to edit it... so do that all the info opens once they open the dropdown of that service name
>
> #26: big fixes to be made in the offer page: so first of all, I'm not able to "build a different offer"... and btw this by itself is something wrong, because a gym should be able to have as many offers as they want... AND ALSO have the ability to insert each specific offer inside the "different reasons" thing for each type of customer (that the best way)... they should also be able to delete offers they have created
>
> #27: uhm... so as we agreed the free trial for the V1, just because they are early users, should give them acces to the free week of the Pro plan (WHICH SHOULD BE WRITTEN SOMEWHERE RIGHT? Like as you can see form the 2nd screenshot attached, it says that I'm on the free week plan... BUT OF WHAT? the Standard or Pro?... that should be specified)
>
> #28: in the "who did what" thing in the data and privacy, because the lists will inevitably get long, make it so there is like a little filter or search engine so that they can look what happened, when, and by who (in the future we will give the chance to onboard teams, so different emails for the same account)
>
> #29: another fix is that the sidebar basically expands together with the open page if it gets longer or shorter (like, on a page like gym settings, which is pretty long, I noticed that the stuff on the bottom left basically gets on the bottom of the opened page (look at the 3rd screenshot where you are NOT able to see it... while on the 4th you can as I scrolled down)... it should be fixed the whole time for each page
>
> #30: do the same thing as point #28 but for the "past imports" in the import page
>
> #31: I saw the mindbody thing in the import page and the fact that they don't have to manually import the CSV is fucking amazing... I would actually want to have as many platforms as possible to be connected to have this automation... but I also understand and think that it's not that simple and it would cost money to do so... so if it's actually something doeable for V1, then do it now... if not, it will be for V2
>
> #32: I think that in the import page, you should have the ability to edit or even remove the imports you did... and also, I hope that if like on the 2nd import there are still the names of some members that remained members (and were members on the previous imports), that they don't get counted as additional members... Like, if Mario Rossi was a member on the July import, and is still a member on the August import, that's still the same member and not an additional one (I hope you've made it like this, if not, fix it)
>
> #33: I think that also the reason why a member stopped coming should be customizable... like, leave the current ones as defaults... but also make the ability to create, edit and remove. Also, because this is a pretty important thing, you should probably make the spot where this is possible a little bit more noticeable (because I understood that you do that in the "Different reasons, different offers" section in the offer page...)
>
> #34: in the campaign page, when you add a campaign you have the ability to choose between languages... but if I select a language that is not english, the default message still remains in english... fix this.
>
> #35: also in the campaign creation thing, I saw that you put a legend to give directions for the "fill themselves" things... You know what? I want that message creation section to be like a nice sandbox that exists in A LOT OF SOFTWARES like all the email marketing ones, shopify, etc... where you have the ability to put bold, italic, and even to insert one of those "fill themselves" from like a doropdown menu or similar... you get what I'm saying... (like even Gmail has it 5th screenshot attached... make sure to include those "{{first_name}}" type of things so that the user won't have to write them himself but just select them and insert them in some way...)
>
> #36: also, something unclear in the campaign, is the fact that it looks like it's on the gym's behalf the fact that they have to write the message (themselves)... while instead that should be casdey's job... like what the hell, I thought it was casdey's job
>
> #37: make sure you can save a campaign and also create, edit and remove them, as always (right now with the CSV you gave me, I cannot save the draft because it says in a red warning: "Nobody matches right now. Either no member has gone quiet or cancelled, or none of them have an email address on file."... because of this I cannot finish the walkthrough as the setup isn't finished...)
>
> #38: the cool dashboard section you can see in the 6th screenshot attached, which is in the overview page, should be all above the setup thing... like th set up should be the one below everything
>
> #39: ONE VERY IMPORTANT THING which I'm not very sure how I can check it: when the special offer to get ex members back gets used, like... it has to work... like the gym needs a way to make the offer be working (like an online payment provider like Stripe... or a discount code... I don't know)
>
> #40: another important thing is like... how the fuck does casdey know when a guy returned or not...? is there like a trigger in the way he answers that the antrhopic api key built in AI analyses? or is it smarter to have gyms connect like a payment provider like stripe so that we know when he pays... (this connects to the previous #39 point).
>
> BTW THESE LAST 2 POINTS ARE UTTERLY AND ABSOLUTELY FUNDAMENTAL TO FIGURE OUT.
>
> I think that's it for batch 2 (and I think I went through almost everything...)...

---

## Batch 2 status board

| # | One line | Area | Size | Status |
|---|----------|------|------|--------|
| 19 | Red issue box bottom left of every screen | app chrome | S | done |
| 20 | Guarantee box belongs under the Pro prices | billing | S | done |
| 21 | Contact page must not say there are two of us | site | S | done |
| 22 | Landing titles break mid-phrase instead of filling the width | landing | S | done |
| 23 | Visit ceiling unticks itself, then invents a validation error | settings | M | done |
| 24 | Billing period needs to be arbitrary; booking numbers need explaining; currency must follow the country | settings | M | done |
| 25 | Each service should collapse into its own dropdown | settings | M | done |
| 26 | Many offers, one per reason, deletable | offer | L | done |
| 27 | The free week never says it is Pro | billing | S | done |
| 28 | Filter and search on the audit log | settings | M | done |
| 29 | Sidebar stretches with the page instead of staying put | app chrome | S | done |
| 30 | Same filter and search on past imports | import | M | done |
| 31 | Direct integrations with gym platforms, not just CSV | product | XL | researched, V2, page made honest |
| 32 | Edit and remove past imports; re-imports must not duplicate members | import | M | done |
| 33 | Custom reasons for leaving, and somewhere obvious to manage them | product | L | done |
| 34 | Picking a language leaves the template in English | campaigns | M | done |
| 35 | A real editor: bold, italic, and merge fields from a menu | campaigns | L | done, minus bold/italic (see note) |
| 36 | The gym should not be the one writing the message | campaigns | M | done |
| 37 | Cannot save a campaign; create, edit and remove them | campaigns | L | done |
| 38 | Dashboard above the setup checklist, not below | overview | S | done |
| 39 | The offer has to actually work when a member uses it | product | XL | done |
| 40 | How casdey knows somebody actually came back | product | XL | done |

---

## Claude's notes, batch 2

Written by Claude, not Davide.

**#19 was not cosmetic, and it was casdey's own.** The red box is Next.js's
development overlay, which never ships to production, but the issue it was
counting was real and was introduced by dark mode (#4): the no-flash script
stamps `data-theme` on `<html>` before React hydrates, React compares its
server markup against a DOM that has deliberately moved, and reports a
mismatch it cannot patch. The badge is gone because the mismatch is gone,
declared intentional on that one element with `suppressHydrationWarning`.

**#23 was one bug wearing two faces.** React resets a form once its action has
run, and a reset restores the browser's own defaults, not React's state. So
the ceiling checkbox was drawn from state, reset to the value the page had
mounted with, and the two stopped agreeing. Everything Davide saw follows from
that: the box ticked itself back on because ticked was what the page loaded
with, and the *next* save then reported a ceiling "from 1 to 200" because the
DOM said the ceiling was on while React state said off, which left the number
field disabled, and a disabled field is never submitted. So the form sent
"ceiling on, no number". The fix re-derives state on the form's own reset
event, and re-mounts the form when a save actually changes the rule.

**#37's blocker was the reason filter, not the CSV.** The sample list is fine:
16 members are lapsed, contactable and ready. Picking a reason from "Only
members who left because of" drops the lapsed branch entirely and looks only
for members recorded with that reason, and nobody on any list has a reason
recorded, because nothing sets one at import. So the audience was empty, and
the message blamed the import. The dropdown now carries counts and disables
what would match nobody, and the message names the real cause. The rest of
#37, editing and deleting campaigns, is still open.

---

## Answered without a change

Two of Davide's points were questions about whether something already worked.
Both did, so nothing was built. The evidence, so it does not have to be taken
on trust.

**#32, re-imports do not duplicate members.** `upsertMembers` splits every
import into three buckets and upserts each against one conflict key: the gym's
own member reference first (`gym_id, external_ref`), then email
(`gym_id, email`), then phone. Mario Rossi in the July file and in the August
file is one row, updated, not two members. The sample CSV carries a Member ID
column, so it matches on the reference. The upsert also writes only the columns
the import owns, so `status`, `contacted_at` and `returned_at` survive a
re-import: re-importing can never resurrect somebody who unsubscribed, or
forget that a member has already come back.

**#24, the currency is not fixed.** It comes from `currencyFor(gym.country)`,
overridden by `plan_currency` once billing sets one at checkout. Italy is euros
because Italy is euros, not because euros are hardcoded; a gym registered in
the UK reads pounds throughout, including its service prices.

---

## #39 and #40, the two Davide called fundamental

These are one question asked twice: what makes the offer real, and what proves
somebody came back. Nothing here is built. What follows is the state of the
code and a recommendation, and the decision is Davide's.

**Where it stands today.** A member is marked returned in exactly two places:
they book through casdey's own booking link, or a staff member marks them by
hand on the member page. Nothing else sets it, anywhere. The offer is text
inside a message and casdey does not know whether it was ever honoured.

**#39, three ways to make an offer real.**

1. *A code the gym honours.* casdey prints a unique code per member in the
   message and on the booking. The gym reads it at the desk and applies it in
   whatever till it already has. Works with every gym on day one, costs
   nothing, proves nothing on its own.
2. *The booking is the redemption.* casdey already writes the booking into the
   gym's calendar, and since #12 that booking carries the service and its
   price. The offer rides on the booking: the gym sees which offer brought the
   member, at the door, in the diary it already reads.
3. *casdey takes the payment.* Stripe Connect, the gym's own account, money
   never touching casdey. This is the only option that proves redemption
   outright, and it is also the heaviest: per-gym Stripe onboarding with
   identity checks at exactly the moment a gym is deciding whether to bother,
   a second payment setup beside the one they already have, and it puts casdey
   near a money flow while the business still has no Partita IVA.

   Recommendation: 1 and 2 for V1, 3 as a V2 decision made with a real
   customer rather than in advance.

**#40, and this is the part that matters.** casdey's honest answer today is
"somebody booked through casdey". That is narrow, and Davide's instinct that it
needs solving is right. Three candidates, and one of them is much better than
it looks:

1. *Read the reply with the AI.* This already exists for WhatsApp: the
   assistant hands off on booking intent. It cannot work for email, and the
   reason is structural, not technical: casdey deliberately sets reply-to to
   the gym, so a member's email reply goes to the gym's inbox and casdey never
   sees it. Making casdey read email replies would mean routing members' replies
   through casdey first, which is a real change to the promise that the gym
   owns the conversation.
2. *The next import.* The gym re-imports its list monthly. A member who was
   contacted, and whose last visit has since moved forward past the date casdey
   wrote to them, came back. No integration, works for every gym on the CSV
   path, and it is the gym's own system saying it, not casdey marking its own
   homework. For a guarantee that pays real money out, evidence from the
   customer's own records is worth more than anything casdey could assert.
3. *A payment provider.* Strongest signal, only for gyms that take payment
   through that one provider, and the same onboarding weight as #39's option 3.

   Recommendation: build 2. It is the cheapest of the three and the most
   credible, and it fits the CSV-first reality that E2 already forced on us
   (LegitFit has no API, so the import is the integration).

**One consequence to be explicit about.** Return and revenue would then come
from different places: a member could be counted as returned by the import
while contributing nothing to recovered revenue, because revenue is the sum of
bookings and they never booked through casdey. That is not a contradiction, it
is the #12 decision holding its line. It does mean the dashboard would need to
say both numbers honestly rather than implying one explains the other.

---

## Batch 2, what was built and the two judgement calls inside it

Written by Claude. Davide's instruction was to do what works and finish, so
these are decisions taken rather than questions asked. Both are reversible.

**#35, bold and italic were not built, and that is deliberate.** casdey sends
plain text on purpose: a plain note reads as a note from a gym, and it stays out
of the promotions tab that eats HTML marketing mail. Adding bold means sending
HTML email, which trades the deliverability the whole product depends on for
emphasis nobody has asked a gym for. The half of #35 that was unambiguously
right, inserting merge fields from a menu instead of typing braces by hand,
is built and is the half that was actually causing damage: a mistyped
{{first_name}} does not fail loudly, it sends "Hi {{first_name}}," to a real
member in the gym's name. If Davide still wants rich text, it is a decision
about what casdey sends and worth taking on its own.

**#31 was researched, and the answer is genuinely mixed rather than a flat no.**

- **Mindbody** publishes a real, documented API. Reaching production means
  Mindbody reviewing casdey as a partner, a card on file, metered per-call
  billing, and an activation code each studio turns on itself. Buildable, and a
  project rather than an afternoon.
- **TeamUp** hands a gym its own API credentials from its own settings, free,
  with nobody's approval. This one is genuinely easy.
- **LegitFit**, which is what the engaged lead runs, publishes no API at all,
  and its Zapier app is trigger-only, so it can report a booking made from now
  on and can never hand over the members who already lapsed. That is the whole
  list casdey needs.

So it was not built, for a reason that is about evidence rather than effort:
the exact request and response shapes cannot be verified without an account on
each platform, no gym is using casdey yet to test against, and the one engaged
lead's software has no API to connect to. Writing that code today would produce
something that compiles, passes its own tests, and fails on first contact with
a real API. What did ship is honesty: the import page now says where each
platform stands instead of showing one "coming soon" that was true for none of
them. TeamUp first, when a gym on TeamUp asks.

**#39 and #40, what was actually built.**

An offer is now claimable. Every member has a code derived from their booking
token, available in a message as {{offer_code}}, shown on their page so the
desk can check it, written into the calendar entry so it is visible at the door,
and frozen onto the booking along with the exact wording they were promised.
Derived rather than stored, and hashed rather than sliced, because an offer code
is read aloud at a front desk and must not be reversible into a link that books
on that member's behalf.

A return is now detected from the gym's own data. Any member casdey wrote to
whose last visit has since moved past the date casdey wrote came back, and the
next import is where casdey finds out. Same-day visits are excluded: somebody
already in the building when the message went out was not brought back by it,
and a guarantee that counts them is one casdey cannot defend.

The consequence flagged earlier still holds and is now real: a member can be
counted as returned by the import while adding nothing to recovered revenue,
because revenue is the sum of bookings and they never booked through casdey.
That is the #12 decision holding its line, not a contradiction.

---

## Batch 3, 2026-09-06

Covered in this pass: Settings (Gym, Services, Data and privacy), the Offer
page, Campaigns including trying to send one, Import, Overview, Members. Two
screenshots came with it: Gym settings showing the cramped "Check in after"
description, and the campaign list. Verbatim below.

> #41: it looks like you didn't change the "charged" thing which I asked you to make customizable. The way you made it is absolutely confusing... I think you should leave some default selections, and put a customizible one on the bottom of the dropdown which then opens a thing where they can input whatever they like.
>
> #42: In the gym section, once you save changes, like in any other page, a message with changes saved should appear because it currently doesn't (the "Saved." message)
>
> #43: In the who did what thing, inside the box to filter out, you wrote "search what happened, or who"... but you also need to add "Search what, who or when happened" (or maybe rephrase it how you want it)
>
> #44: The check in after description should be expanded to the whole length of the box (look 1st screen)... like it's too packed up with a lot of white space on its right which can easily be filled
>
> #45: Make it so that before deleting stuff like a service, or even the reason why the left, or a campaign, or any of this stuff, they get the classic message asking if they are sure to delete permanently the thing
>
> #46: On the offer page there need to be some changes... first of all the description right under the title "Give them a reason to come back" should expand to the whole page without leaving that empy space on the right (same problem I flagged in some previous points)... then I think I got what you're doing here with the actual featiure... so you're just giving the ability to have JUST 1 general offer... and if they want they can have specific ones in the different reasons section...
> So, first of all I think that they should have the ability to have more offers created... then you didn't really listen to what I said in the 2nd batch, but I wanted the reasons to be created, edited, and even deleted (!!!!!!). You should put the why member leav thing to add my own reasons within the "differente reasons..." section... not separate. So, like, um, just repeating what I said, the... make it yours like the offer should be multiple like offers they can have. And, like, based on what you created, if you think that having more than one cannot be done, then maybe what you could do is, for example, to have some switches where they can, like, turn on a general offer or turn off another offer, or maybe you should even give them the ability to test them out so, like, you are going to use fifty percent this offer, number one, twenty percent this other one, thirty percent the third special offer. And then besides that, as I said, the different recent thing should have, of course, uh, the default reasons, which can be deleted by themselves, which can be edited, which can be, you know, modified, uh, which can also be deleted. And you should also have the ability to add some to add some. And, also, inside those boxes field, you should have also the ability to, like, select some of the general offers that you made in case you want to use those. And and, also, when you create the general offers, maybe you should also give, like, a switch or a toggle that, um, instead of making it a general offer, you are going to assign it directly to one of these, uh, recent categories for why they left. So either during the creation, you can assign it to one of these categories, or when you go to these sections, you can assign some general offers. So, yeah, um, you didn't really get what I said, but, uh, please take to the letter what what I said here, basically. Oh, and, also, you should have, like, a drop down thing for the office just like there is in the service page. So even here, you should have, like, a drop down, uh, where you, you know, can have a look at the offers and collapse them or expand them to have a more insightful look.
>
> #47: Even here, as set before in the previous batch of points I gave you, like, when I go to the campaigns thing and I try to create a campaign, um, basically First of all, I think that you should be able to save the campaign. And in a second moment, have the ability to, like, um, approve it. So instead of, like, having to approve it straight away, uh, I think there should be, like, a save for later button or something like that. Besides that, as I said before, when it create a campaign, it still gives me the feeling that the... you know, it... the the the message is not personalized as I asked you, like, where the fuck is the personalization that I asked? Because it's basically a fixed message, and you're just changing the the first name and stuff. Like, maybe... like, I don't know. Just figure this out. Maybe you can use the draft to, like, have a model around which the personalization can work. But I also understand that an an AI API key has to be in place probably to do something like this. So maybe if you think that this is not a good idea, like, my suggestion of having personalized message, such as the ones I'm doing with my current outreach, like, in the cloud code routine sessions, then just tell me, and we will stick with this messages that are fixed in that only the first name, the gym, the offer, and whatever changes. And, yeah, besides that, I would also add the fact that when I try to have the the three samples, it says that nobody is queued for this campaign yet. And then when I clicked to send me a test, it says that we could not prepare a test send try again. So like the campaign, it's still looking pretty bad, I would say. Oh, and by the way, I just clicked into another page, and I got back to the campaign page. And it's giving me, like, the list of their campaigns, which in this case, there's just one. And it says that the status is draft not sent. But if I try to click on that card, like, oh, okay. So if I click on the name, it works. So, um, maybe you should do, like, a separate button for this because I see that the kind of saving thing, you try to do it, but it needs to be more more like evident. Okay? So when I get back to the campaign page, as as as I was saying, you should probably have, like, um, I don't know, a button or something like this where they can access it again, uh, or maybe just... I don't know. Because I got I got it in a second moment that you had to click the name of the campaign to access the campaign. So maybe you either write it somewhere or you highlight the name or you put a button, just figure it out. Now for the import page, so one quick thing is that the past imports thing should be put, like, above the... where else it can come from section. And, of course, in the past imports, you should like, um, have a cap of, for example, ten that shows up, and then you have, like, an arrow that lets you see the other ones, like the previous ones. just think about those Google searches that you do and you scroll down, and then it says go to the second page or something like that. Okay. I I want something like this. And also do it for the thing that is in the settings. The the who did what thing because, like, the list is very, very long. So you should also cap this to around ten in terms of numbers for the list. Now getting back to the input page. So I saw the effort that you tried to do with the... where else it can come from, and it's... okay. It is explanatory. Like, it explains. It looks to AI, I would say, like the the actual copy, the actual script of the text, uh, of the description under the title. But inside, like, the box and thing, it it is fine. It is it looks good. It gives, like, decent, uh, instructions. And, um, what I would like you to do is that for each software that you mentioned, you should, like, direct the, um, the client to a page or to something that, like, explains them how to do it or whatever. Okay? Because I saw that right now, uh, there is not a real integration. Okay? Uh, because I saw that you are living that in, like, request. So maybe you should say it like that for like that for some of this that they are coming... I don't know. Not coming soon, but, like, they need a request or something like that. But in the meantime, like, they are can do what is said. Okay? So, yeah, this is also something for the... where else it can come from section. And make sure to add as many important softwares as possible, like, even those that you mentioned in the landing page because I saw that there is, like, some softwares mentioned in the landing page that you didn't put here. So you should mention also those, I think, in the where else it can come from. And... yeah. So I saw that basically you didn't want to create integrations, which is very unfortunate because I wanted them. But if you really cannot put those integrations, which, again, I want them, then just do what I told you just now above.
>
> #48: Even here, I run up with the same problem like in the campaign and even overview section like... because I wanna get rid of the... of that, uh, setup thing. Okay? Because I want to see what happens when the setup finishes. And and by the way, I'm gonna tell you now... so the first part of point forty eight is that after the setup finishes, I would like there to be, like, some graphs or some cool stuff And, like, to get some inspiration, just think about what Shopify does. Like, I want it like they do. So put... so go and put some useful graphs and infographics or whatever, uh, like Shopify does in the overview or in the dashboard thing. Okay? Uh, and I think that it would be nice to have them once the setup is finished, I guess. And so getting back to the campaign thing, like, um, it couldn't let me send. Like, when I click yes, start sending. It basically says in a red box message that we could not build the send queue. Try again. So I ran with... through the same problems. Like, I cannot send this fucking campaign.
>
> #49: And then you mentioned that in the members, you had a offer code row, which I am not seeing anywhere. So, like, uh, where the fuck is it? Like, I don't know. What what who... what is it?
>
> #50: This is going to be a cool feature edition, and I think that in the sidebar menu, I would like to have, like, a calendar thing, which is basically, um, like, I think that you either have, like, a built in calendar by Kasde or you can even, like, have a integration of your own Google Calendar in that page. Like, you basically see the same thing that you would see in your own Google Calendar. Yeah. Like, I think that it would be a cool thing to have
>
> I guess this is the end of the batch three of the changes to make and do the same stuff that I ask you with the with the previous one. Okay? So, like, the message with the list and what I need to check, etcetera.

---

## Batch 3 status board

| # | One line | Area | Size | Status |
|---|----------|------|------|--------|
| 41 | The "charged" control is confusing; defaults plus a custom option | settings | M | done |
| 42 | No "Saved." message on gym settings | settings | S | done |
| 43 | Audit search box should say it searches when, too | settings | XS | done |
| 44 | "Check in after" description cramped into a narrow column | settings | XS | done |
| 45 | Ask before deleting anything, permanently | app wide | M | done |
| 46 | Offer page: full-width lede, many offers, reasons folded in and fully editable, offers pickable per reason, collapsible | offer | XL | done |
| 47 | Save for later; personalisation; samples and test send both failing; a way into a draft; imports above integrations; ten a page; integrations with real links | campaigns + import | XL | done |
| 48 | Charts on the overview; and the campaign could not send at all | overview + campaigns | L | done |
| 49 | The offer code is nowhere to be found | members | XS | done |
| 50 | A calendar in the sidebar | app | L | done |

---

## Claude's notes, batch 3

Written by Claude, not Davide.

**Three of these were one bug of mine each, and they are the real content of
this batch.**

**The campaign could not send, be tested, or be sampled (#47, #48).** All three
were the same line. Approving a campaign upserts into `campaign_messages`
`ON CONFLICT (campaign_id, member_id)`, and the unique index on that table has
been `(campaign_id, member_id, step)` since follow-ups shipped in batch 1.
Postgres does not treat a partial conflict target as a narrower match, it
answers 42P10 and refuses the statement, so every approve and every test send
failed, and the samples then found an empty queue and said so. Proved against
the live index before and after fixing: the old target is rejected, the new one
is accepted, in a transaction that was rolled back.

**Saved offers and custom reasons never appeared (#46).** Migrations 0029 and
0031 created their tables, enabled row level security, added a select policy,
and granted the roles nothing at all. RLS decides which rows a role may see;
the grant decides whether it may touch the table in the first place, and
without it Postgres refuses before a policy is ever consulted. Every other
table in the schema is granted in 0002, which is why nothing else showed it.
So two features that shipped last session looked, from the outside, exactly
like features that had never been built. Fixed in 0032.

That is also the honest answer to "you didn't really listen": the offer library
and the custom reasons were built and were unreachable. What was genuinely not
done as asked is that casdey's six reasons were left immutable, and #46 is
right that they should not have been. They are now rows the gym owns.

**The "Saved." message (#42)** was a regression from batch 2's own fix. Keying
the settings form on its persisted values re-mounted it whenever a save changed
anything, and a re-mount takes `useActionState`'s result with it. The form now
adjusts its own state when new props arrive, which is React's answer to derived
state going stale, and the action's result survives.

---

## #47, the personalisation question, answered

Davide asked where the personalisation he asked for actually is, and offered to
drop the idea if it is not workable. It is workable, it is built, and it is not
running. Those are three separate things and the answer is the third.

`personalise()` sends the gym's own draft plus that member's facts to Claude and
gets a message written for them, with guardrails: the offer must survive word
for word or the result is rejected, and every failure falls back to the gym's
template so a campaign still sends. That is all in
`src/lib/personalise.ts` and it runs on every send when the box is ticked,
which it is by default.

**The Anthropic account it calls has no credit balance.** Every call returns 400
and every message falls back to the template, which is exactly the "it is just
swapping the first name" that Davide is seeing. It is a prepaid top-up, not a
subscription, and it was flagged at the end of batch 1 as still open.

What changed here is that the fallback is no longer silent. Asking for three
samples now says whether casdey could not reach the writer or was never
configured to, rather than labelling three identical messages "your template,
unchanged" and leaving the gym to guess why.

So: nothing to decide, and nothing to rebuild. Top up the Anthropic account and
the personalisation Davide asked for starts happening on the next send.

---

## #46, what was built and the one thing deliberately left out

Reasons are now rows the gym owns, casdey's six included, seeded once per gym
and then theirs: rename, reword, delete, add. The keys never change during
seeding, which is what makes it safe for members recorded months ago. Deleting
a reason leaves those members tagged with it and falls back to casdey's general
wording, so a settings change never rewrites a member's history and a raw key
can never reach an inbox.

Reasons and their offers are one section now rather than two cards, each reason
collapsing like a service, and each carrying either one of the gym's saved
offers or its own wording. An offer can be pointed at a reason from either
side: from the reason, or from the offer itself.

**Weighted split testing was not built** (the "50% this one, 20% that one"
idea). It was offered as a fallback in case multiple offers were impossible,
and they were not: a gym can hold as many offers as it likes and switch between
them. Splitting traffic is only worth having when the result can be read back,
and the number that would decide a winner is recovered revenue per offer, which
needs sends that have actually gone out. It belongs after the first real
campaign, not before it.
