/**
 * The support widget's answers, written once and curated by hand.
 *
 * Deliberately not AI-backed: the same standing-cost reasoning that retired the
 * AI campaign drafting (see CLAUDE.md) applies to a support bot, and a fixed
 * set of good answers to the questions a practice actually asks beats a
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
  /** Words a practice might search that are not already in the question. */
  keywords: string[];
};

export const SUPPORT_TOPICS: SupportTopic[] = [
  {
    id: "import",
    question: "How do I bring my patient list in?",
    answer: [
      "Go to Import and upload a CSV exported from your practice software. You map your columns to casdey's fields once, and it remembers the mapping for next time.",
      "Re-importing the same list later updates the existing patients rather than duplicating them, as long as the patient reference or email lines up.",
    ],
    keywords: ["csv", "upload", "spreadsheet", "dentally", "list", "patients"],
  },
  {
    id: "dormant",
    question: "What counts as a patient who has gone quiet?",
    answer: [
      "By default: no visit for 12 months, and at most 2 visits on record. Those are the patients who came once or twice and never rebooked.",
      "Change either number in Settings. casdey works dormancy out fresh every time from your list, so widening or narrowing the window never leaves a stale flag behind.",
    ],
    keywords: ["dormant", "quiet", "inactive", "window", "months", "visits"],
  },
  {
    id: "build-campaign",
    question: "How do I send a campaign?",
    answer: [
      "Build a campaign from the Campaigns tab or the Overview page. You start from the template, edit every word, and see exactly what one real patient will receive.",
      "Nothing sends when you save. A campaign only goes out after you approve it on its own screen, and even then it is spread over several days so your sender reputation stays healthy. You can pause or cancel the rest at any point.",
    ],
    keywords: ["campaign", "send", "email", "approve", "draft", "message"],
  },
  {
    id: "self-test",
    question: "Can I see the email before patients do?",
    answer: [
      "Yes. Open a campaign and use Send me a test. It sends the exact message a patient would get to your own inbox, with a working reply and unsubscribe link, so you can walk through their side first.",
      "The test only goes to you, never to a patient, and it does not count against your daily send limit.",
    ],
    keywords: ["test", "preview", "myself", "try", "yourself"],
  },
  {
    id: "plans",
    question: "What is the difference between Free and Premium?",
    answer: [
      "Your free week is Premium: everything works, and no card is taken. When it ends your account rests on the Free plan, which still imports your list and shows who has gone quiet.",
      "Sending campaigns is the Premium feature. Upgrade from Settings then Billing when you are ready to start writing to patients.",
    ],
    keywords: ["plan", "free", "premium", "trial", "upgrade", "price", "billing"],
  },
  {
    id: "guarantee",
    question: "How does the profit-or-nothing guarantee work?",
    answer: [
      "For your first month on Premium, casdey tracks the revenue you recover against what you paid. If the recovered revenue does not beat the cost, you can claim a full refund of that month from Settings then Billing.",
      "The estimate uses what you tell casdey a returning patient is worth. Set that in Settings so the figure reflects your own prices.",
    ],
    keywords: ["guarantee", "refund", "money back", "profit", "worth it"],
  },
  {
    id: "revenue",
    question: "How does casdey estimate the money I have recovered?",
    answer: [
      "It multiplies the number of patients you have marked as rebooked by what you say a returning patient is typically worth. Set that value in Settings under what a returning patient is worth.",
      "It is an estimate to show the value on your dashboard, not a figure casdey has billed anyone.",
    ],
    keywords: ["revenue", "recovered", "value", "estimate", "money", "prices"],
  },
  {
    id: "rebooked",
    question: "A patient booked again. How do I record it?",
    answer: [
      "Open that patient and mark them as rebooked. casdey sends the message, but the booking lands in your own diary, which casdey cannot see, so this step is yours.",
      "Marking it is what feeds the rebooked count and the recovered-revenue estimate on your Overview.",
    ],
    keywords: ["rebooked", "reactivated", "booked", "returned", "mark", "reply"],
  },
  {
    id: "unsubscribe",
    question: "What happens when a patient unsubscribes?",
    answer: [
      "Every email carries a one-click way out. When a patient uses it they are added to your do-not-contact list for good, and anything still queued for them stops at once.",
      "That suppression survives a re-import on purpose, so uploading your list again months later can never quietly put them back into a campaign.",
    ],
    keywords: ["unsubscribe", "opt out", "stop", "suppress", "do not contact"],
  },
  {
    id: "data",
    question: "Where is my patient data, and can I get it back?",
    answer: [
      "It is stored in Ireland, in the EU, encrypted, and never shared or used to train anything. Your practice is the controller and casdey is the processor.",
      "Download everything as a CSV any time from Settings then Data and privacy, where you can also erase it all. Deletion is immediate and cannot be undone.",
    ],
    keywords: ["data", "gdpr", "export", "delete", "privacy", "ireland", "download"],
  },
];
