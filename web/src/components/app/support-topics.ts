/**
 * The support widget's answers, written once and curated by hand.
 *
 * Deliberately not AI-backed: the same standing-cost reasoning that retired the
 * AI campaign drafting (see CLAUDE.md) applies to a support bot, and a fixed
 * set of good answers to the questions a gym actually asks beats a
 * plausible-sounding generated one. Keep these accurate to the product: if a
 * feature changes, the answer changes with it.
 *
 * Copy rules from the brand guide apply here too: plain verbs, sentence case,
 * active voice, and never an em dash.
 */

export type SupportTopic = {
  id: string;
  question: string;
  /** Short paragraphs. Rendered as-is, one <p> per entry. */
  answer: string[];
  /** Words a gym might search that are not already in the question. */
  keywords: string[];
};

export const SUPPORT_TOPICS: SupportTopic[] = [
  {
    id: "import",
    question: "How do I bring my member list in?",
    answer: [
      "Go to Import and upload a CSV exported from your gym software. You map your columns to casdey's fields once, and it remembers the mapping for next time.",
      "Re-importing the same list later updates the existing members rather than duplicating them, as long as the member reference or email lines up.",
    ],
    keywords: ["csv", "upload", "spreadsheet", "import", "list", "members"],
  },
  {
    id: "lapsed",
    question: "What counts as a member who has gone quiet?",
    answer: [
      "By default: no visit for 12 months, and at most 2 visits on record. Those are the members who came once or twice and never returned.",
      "Change either number in Settings. casdey works lapse out fresh every time from your list, so widening or narrowing the window never leaves a stale flag behind.",
    ],
    keywords: ["lapsed", "quiet", "inactive", "window", "months", "visits"],
  },
  {
    id: "build-campaign",
    question: "How do I send a campaign?",
    answer: [
      "Build a campaign from the Campaigns tab or the Overview page. You start from the template, edit every word, and see exactly what one real member will receive.",
      "Nothing sends when you save. A campaign only goes out after you approve it on its own screen, and even then it is spread over several days so your sender reputation stays healthy. You can pause or cancel the rest at any point.",
    ],
    keywords: ["campaign", "send", "email", "approve", "draft", "message"],
  },
  {
    id: "self-test",
    question: "Can I see the email before members do?",
    answer: [
      "Yes. Open a campaign and use Send me a test. It sends the exact message a member would get to your own inbox, with a working reply and unsubscribe link, so you can walk through their side first.",
      "The test only goes to you, never to a member, and it does not count against your daily send limit.",
    ],
    keywords: ["test", "preview", "myself", "try", "yourself"],
  },
  {
    id: "booking",
    question: "How does booking work, and do I need to connect a calendar?",
    answer: [
      "When booking is on, each member gets a link in their message to pick a time themselves, and casdey books it in. Turn it on in Settings then Booking.",
      "Connecting a Google Calendar is optional but worth it: casdey reads your free and busy times so it never offers a slot you are already in, and writes each booking into that calendar. Without one, booking still works, it just cannot see appointments made outside casdey.",
      "If a connected calendar ever disconnects, casdey stops offering times until you reconnect, so it can never book over something already in your diary.",
    ],
    keywords: ["booking", "calendar", "google", "slots", "book", "diary", "availability", "connect", "appointment"],
  },
  {
    id: "plans",
    question: "What are the plans — Free, Standard, Pro?",
    answer: [
      "Your free week is the full Pro experience: everything works, no card taken. When it ends your account rests on the Free plan.",
      "Free finds who has gone quiet and shows the true count, but holds up to 50 members, reveals only the first few by name, and cannot send.",
      "Standard sends email win-back and at-risk campaigns and holds up to 200 members. Pro adds the WhatsApp channel, the profit-or-nothing guarantee, and up to 2,000 members.",
      "Early adopters keep 20% off either paid plan for life. Choose a plan from Settings then Billing.",
    ],
    keywords: ["plan", "free", "standard", "pro", "premium", "trial", "upgrade", "price", "billing", "limit", "cap", "whatsapp"],
  },
  {
    id: "guarantee",
    question: "How does the profit-or-nothing guarantee work?",
    answer: [
      "The guarantee is a Pro-plan feature. For your first month on Pro, casdey tracks the revenue you recover against what you paid. If the recovered revenue does not beat the cost, you can claim a full refund of that month from Settings then Billing.",
      "The estimate uses what you tell casdey a returning member is worth. Set that in Settings so the figure reflects your own prices.",
    ],
    keywords: ["guarantee", "refund", "money back", "profit", "worth it", "pro"],
  },
  {
    id: "revenue",
    question: "How does casdey estimate the money I have recovered?",
    answer: [
      "It multiplies the number of members you have marked as returned by what you say a returning member is typically worth. Set that value in Settings under what a returning member is worth.",
      "It is an estimate to show the value on your dashboard, not a figure casdey has billed anyone.",
    ],
    keywords: ["revenue", "recovered", "value", "estimate", "money", "prices"],
  },
  {
    id: "returned",
    question: "A member booked again. How do I record it?",
    answer: [
      "Open that member and mark them as returned. casdey sends the message, but the booking lands in your own diary, which casdey cannot see, so this step is yours.",
      "Marking it is what feeds the returned count and the recovered-revenue estimate on your Overview.",
    ],
    keywords: ["returned", "rebooked", "came back", "booked", "mark", "reply"],
  },
  {
    id: "unsubscribe",
    question: "What happens when a member unsubscribes?",
    answer: [
      "Every email carries a one-click way out. When a member uses it they are added to your do-not-contact list for good, and anything still queued for them stops at once.",
      "That suppression survives a re-import on purpose, so uploading your list again months later can never quietly put them back into a campaign.",
    ],
    keywords: ["unsubscribe", "opt out", "stop", "suppress", "do not contact"],
  },
  {
    id: "data",
    question: "Where is my member data, and can I get it back?",
    answer: [
      "It is stored in Ireland, in the EU, encrypted, and never shared or used to train anything. Your gym is the controller and casdey is the processor.",
      "Download everything as a CSV any time from Settings then Data and privacy, where you can also erase it all. Deletion is immediate and cannot be undone.",
    ],
    keywords: ["data", "gdpr", "export", "delete", "privacy", "ireland", "download"],
  },
];
