// Single source of truth for Mizan UK marketing copy + pricing.
// UK market: Making Tax Digital (MTD) for Income Tax, Self Assessment, VAT.
// Edit here — every UK section reads from this file.

export const UK_BRAND = {
  name: "Mizan",
  arabic: "ميزان",
  region: "gb" as const,
  tagline: "Books balanced. Tax filed. Done.",
  promise:
    "AI-native bookkeeping, VAT and Making Tax Digital for UK freelancers and sole traders. We do the work — you get clean books and on-time HMRC filings.",
} as const;

export type UkTier = {
  id: string;
  name: string;
  forWho: string;
  price: string; // GBP amount, no symbol
  cadence: string;
  highlight?: boolean;
  features: string[];
};

export const UK_TIERS: UkTier[] = [
  {
    id: "solo",
    name: "Solo",
    forWho: "Sole traders under £50k — Self Assessment as usual",
    price: "39",
    cadence: "per month",
    features: [
      "Bookkeeping kept current",
      "Annual Self Assessment prepared & filed",
      "Deadline alerts — never miss HMRC again",
      "WhatsApp & email support",
    ],
  },
  {
    id: "mtd",
    name: "MTD",
    forWho: "Sole traders over £50k — MTD mandatory from April 2026",
    price: "79",
    cadence: "per month",
    highlight: true,
    features: [
      "Everything in Solo",
      "Quarterly MTD submissions to HMRC",
      "Final year-end declaration",
      "VAT return prepared & filed",
      "Bank feed auto-sync (Open Banking)",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    forWho: "VAT-registered with multiple income streams",
    price: "149",
    cadence: "per month",
    features: [
      "Everything in MTD",
      "Monthly bookkeeping + P&L statement",
      "Dedicated HMRC-registered reviewer",
      "Same-day WhatsApp replies",
      "Audit-ready records & cash-flow view",
    ],
  },
];

export const UK_SETUP = {
  name: "Switch & setup",
  price: "150",
  note: "We move you off spreadsheets, get you MTD-ready, and catch up your books — waived when you start on MTD or Growth.",
};

export const UK_PROBLEMS = [
  {
    stat: "£50k",
    label: "MTD threshold — 6 April 2026",
    body: "Self-employed people and landlords over £50k must keep digital records and report to HMRC every quarter. The threshold drops to £30k in 2027 and £20k in 2028.",
  },
  {
    stat: "4×",
    label: "Filings a year, not one",
    body: "Quarterly updates plus a final declaration replace the single annual return. Year-round accuracy is now mandatory — the January scramble is over.",
  },
  {
    stat: "£0",
    label: "Help on your spreadsheet",
    body: "You've done Self Assessment yourself for years. MTD changes the rules — and HMRC's points-based penalties stack up fast for missed deadlines.",
  },
];

export const UK_STEPS = [
  {
    n: "01",
    title: "Connect & forward",
    body: "Link your bank with Open Banking, forward invoices, or snap receipts. That's all we need from you.",
  },
  {
    n: "02",
    title: "We do the work",
    body: "Our system categorises every transaction, builds your books, and drafts your quarterly MTD updates and returns.",
  },
  {
    n: "03",
    title: "Reviewed & filed",
    body: "An HMRC-registered agent reviews and submits to HMRC. You get clean books, on-time filings, and a number you can trust.",
  },
];

export const UK_FAQS = [
  {
    q: "Is Mizan a registered tax agent?",
    a: "Mizan handles your bookkeeping and prepares your returns. Every HMRC filing is reviewed and submitted by an HMRC-registered tax agent we partner with — so you stay fully compliant.",
  },
  {
    q: "Do I actually have to comply with MTD?",
    a: "From 6 April 2026, self-employed people and landlords earning over £50,000 must keep digital records and send quarterly updates to HMRC. The threshold drops to £30,000 in 2027 and £20,000 in 2028, so most freelancers are pulled in within two years.",
  },
  {
    q: "What do I have to do each month?",
    a: "Almost nothing. Connect your bank once and forward invoices as they come. We handle categorisation, books, VAT, your quarterly MTD updates and the final declaration. You approve before anything is filed.",
  },
  {
    q: "How is this cheaper than an accountant?",
    a: "We automate the heavy lifting — categorisation, reconciliation, draft returns — so a small expert team can serve many clients. A fixed monthly fee, no surprise hourly bills, and proactive deadline alerts a traditional accountant rarely gives you.",
  },
  {
    q: "I'm behind on my books — can you help?",
    a: "That's the most common case. Our switch & setup gets you caught up, MTD-ready, and audit-ready, then keeps you that way every quarter.",
  },
];

export const UK_TRUST = {
  label: "Syncs with your UK bank",
  items: ["Monzo", "Starling", "HSBC", "Barclays", "Lloyds", "Tide"],
};

export const UK_SEO = {
  title: "Mizan UK — MTD & accounting, done for you",
  description:
    "AI bookkeeping plus quarterly Making Tax Digital submissions for UK freelancers and sole traders, reviewed by an HMRC-registered agent. Fixed monthly fee, no spreadsheets.",
  keywords: [
    "Making Tax Digital",
    "MTD for Income Tax",
    "MTD ITSA",
    "freelancer accountant UK",
    "sole trader bookkeeping",
    "Self Assessment",
    "quarterly tax returns UK",
  ],
};
