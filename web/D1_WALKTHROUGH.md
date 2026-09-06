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
- Not seen yet, or not commented on: Members and a member's own page, the
  booking flow a member actually sees, Settings Booking, Sending and WhatsApp,
  sign up, password reset, `/waitlist`, `/privacy`, the processing terms.

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
| 24 | Billing period needs to be arbitrary; booking numbers need explaining; currency must follow the country | settings | M | open |
| 25 | Each service should collapse into its own dropdown | settings | M | open |
| 26 | Many offers, one per reason, deletable | offer | L | open |
| 27 | The free week never says it is Pro | billing | S | done |
| 28 | Filter and search on the audit log | settings | M | open |
| 29 | Sidebar stretches with the page instead of staying put | app chrome | S | done |
| 30 | Same filter and search on past imports | import | M | open |
| 31 | Direct integrations with gym platforms, not just CSV | product | XL | needs decision |
| 32 | Edit and remove past imports; re-imports must not duplicate members | import | M | part answered, part open |
| 33 | Custom reasons for leaving, and somewhere obvious to manage them | product | L | open |
| 34 | Picking a language leaves the template in English | campaigns | M | open |
| 35 | A real editor: bold, italic, and merge fields from a menu | campaigns | L | open |
| 36 | The gym should not be the one writing the message | campaigns | M | open |
| 37 | Cannot save a campaign; create, edit and remove them | campaigns | L | blocker done, rest open |
| 38 | Dashboard above the setup checklist, not below | overview | S | done |
| 39 | The offer has to actually work when a member uses it | product | XL | needs decision |
| 40 | How casdey knows somebody actually came back | product | XL | needs decision |

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
