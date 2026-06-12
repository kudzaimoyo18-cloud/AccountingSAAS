// Single source of truth for marketing copy + pricing.
// Edit here — every section reads from this file.

export const BRAND = {
  name: "Mizan",
  arabic: "ميزان",
  tagline: "Books balanced. Taxes filed. Done.",
  promise:
    "AI-native accounting, VAT and corporate tax for UAE free-zone companies. We do the work — you get clean books and on-time filings.",
} as const;

export type Tier = {
  id: string;
  name: string;
  forWho: string;
  priceAed: string;
  cadence: string;
  highlight?: boolean;
  features: string[];
};

export const TIERS: Tier[] = [
  {
    id: "starter",
    name: "Starter",
    forWho: "Freelancers & dormant free-zone companies",
    priceAed: "349",
    cadence: "per month",
    features: [
      "Bookkeeping kept current",
      "Quarterly VAT return prepared & filed",
      "Annual corporate tax return",
      "Deadline alerts — never miss a filing",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    forWho: "Active SMEs under AED 3M revenue",
    priceAed: "999",
    cadence: "per month",
    highlight: true,
    features: [
      "Everything in Starter",
      "Monthly bookkeeping + P&L statement",
      "Corporate tax planning & filing",
      "Bank & invoice auto-sync",
      "WhatsApp support, same-day replies",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    forWho: "Multi-entity & AED 3M+ revenue",
    priceAed: "2,900",
    cadence: "per month",
    features: [
      "Everything in Growth",
      "Dedicated reviewer (licensed FTA agent)",
      "Management reports & cash-flow view",
      "Multi-entity consolidation",
      "Priority filing & audit-ready records",
    ],
  },
];

export const SETUP = {
  name: "One-time setup",
  priceAed: "1,500",
  note: "Corporate tax registration, FTA setup, and opening books — waived when you start on Growth or Pro.",
};

export const PROBLEMS = [
  {
    stat: "9%",
    label: "Corporate tax since June 2023",
    body: "Every free-zone company now has to register, keep books, and file — or face penalties from the FTA.",
  },
  {
    stat: "AED 10k+",
    label: "Penalties for late or wrong filings",
    body: "Missed deadlines, bad records, and misfiled returns add up fast. Most founders find out too late.",
  },
  {
    stat: "0",
    label: "In-house accountants at most SMEs",
    body: "You run the business on spreadsheets and WhatsApp threads with an accountant who replies in three days.",
  },
];

export const STEPS = [
  {
    n: "01",
    title: "Connect & forward",
    body: "Link your bank feed, forward invoices, or snap receipts. That's all we need from you.",
  },
  {
    n: "02",
    title: "We do the work",
    body: "Our system categorises every transaction, builds your books, and drafts your VAT and corporate tax returns.",
  },
  {
    n: "03",
    title: "Reviewed & filed",
    body: "A licensed FTA tax agent reviews and submits. You get clean books, filed returns, and a number you can trust.",
  },
];

export const FAQS = [
  {
    q: "Is Mizan a licensed tax agent?",
    a: "Mizan handles your accounting and prepares your returns. Every regulated filing is reviewed and submitted by a licensed FTA-registered tax agent we partner with — so you stay fully compliant.",
  },
  {
    q: "I'm in a free zone — do I really need this?",
    a: "Yes. Since June 2023, almost all UAE companies, including free-zone entities, must register for corporate tax, keep proper books, and file returns. Free-zone tax incentives only hold if you stay compliant.",
  },
  {
    q: "What do I have to do each month?",
    a: "Almost nothing. Connect your bank once and forward invoices as they come. We handle categorisation, books, VAT, and corporate tax. You approve before anything is filed.",
  },
  {
    q: "How is this cheaper than a traditional accountant?",
    a: "We automate the heavy lifting — categorisation, reconciliation, draft returns — so a small expert team can serve many companies. You get faster service at a fixed monthly fee, with no surprise hourly bills.",
  },
  {
    q: "What if I'm behind on my books or registration?",
    a: "That's the most common case. Our one-time setup gets you registered, caught up, and audit-ready, then keeps you that way.",
  },
];
