// Single source of truth for marketing copy + pricing.
// Edit here — every section reads from this file.

export const BRAND = {
  name: "Mizan",
  arabic: "ميزان",
  tagline: "Upload the paperwork. The books do themselves.",
  promise:
    "AI bookkeeping and accounting software for UAE free-zone companies. Upload invoices, receipts and statements — Mizan drafts your double-entry books, you approve every line, and your VAT and corporate-tax figures are always ready.",
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
    forWho: "Freelancers & quiet free-zone companies",
    priceAed: "349",
    cadence: "per month",
    features: [
      "AI reads your invoices & receipts into draft books",
      "Double-entry ledger — you approve every line",
      "P&L and VAT position, always current",
      "Filing-ready accounts pack (Excel / PDF)",
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
      "Full statements — balance sheet & trial balance",
      "Corporate-tax estimate (9% over AED 375k)",
      "Bank statement import & auto-categorisation",
      "AI assistant that watches your books",
      "WhatsApp support, same-day replies",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    forWho: "Busier books & audit-minded founders",
    priceAed: "2,900",
    cadence: "per month",
    features: [
      "Everything in Growth",
      "Invite your accountant or tax agent (read-only)",
      "Period close with VAT & corporate-tax snapshot",
      "Priority support & onboarding done with you",
      "Audit-ready records, export any time",
    ],
  },
];

export const SETUP = {
  name: "One-time setup",
  priceAed: "1,500",
  note: "We set up your chart of accounts and opening books with you — waived for founding members and anyone starting on Growth or Pro.",
};

export const PROBLEMS = [
  {
    stat: "9%",
    label: "Corporate tax since June 2023",
    body: "Every free-zone company now has to register, keep proper books, and file — or face penalties from the FTA.",
  },
  {
    stat: "AED 10k+",
    label: "Penalties for late or wrong filings",
    body: "Missed deadlines, bad records, and misfiled returns add up fast. Most founders find out too late.",
  },
  {
    stat: "0",
    label: "In-house accountants at most SMEs",
    body: "So the books live in a spreadsheet nobody updates — and every VAT quarter turns into a panic.",
  },
];

export const STEPS = [
  {
    n: "01",
    title: "Upload your paperwork",
    body: "Drop in invoices, receipts, or bank statements. PDFs, photos, CSVs — whatever you have.",
  },
  {
    n: "02",
    title: "AI drafts, you approve",
    body: "Mizan reads each document into draft ledger lines — date, amount, category, VAT split. You check and approve every line. Nothing enters your books without you.",
  },
  {
    n: "03",
    title: "Your accounts build themselves",
    body: "Every approved line posts to real double-entry books. P&L, balance sheet, VAT position and corporate-tax estimate — live, filing-ready, exportable for your tax agent.",
  },
];

export const FAQS = [
  {
    q: "Is Mizan an accountant or a licensed tax agent?",
    a: "No — Mizan is software. It keeps your books and produces filing-ready figures, but it doesn't provide tax advice and doesn't file returns. When it's time to file, you export the accounts pack or invite your tax agent to view your books directly.",
  },
  {
    q: "Can I trust AI with my books?",
    a: "The AI only drafts. Every line it extracts is marked as a draft with a confidence score, and nothing posts to your books until you approve it. Your ledger stays balanced by construction — debits always equal credits.",
  },
  {
    q: "I'm in a free zone — do I really need this?",
    a: "Yes. Since June 2023, almost all UAE companies, including free-zone entities, must register for corporate tax, keep proper books, and file returns. Free-zone tax incentives only hold if you stay compliant.",
  },
  {
    q: "What do I have to do each month?",
    a: "Upload your paperwork as it comes and spend a few minutes approving the drafted lines. That's it — your P&L, VAT position and corporate-tax estimate stay current on their own.",
  },
  {
    q: "How is this cheaper than a traditional accountant?",
    a: "The AI does the data entry and categorisation that an accountant would bill hours for. You pay a fixed monthly subscription for software — and only pay a professional when you actually need advice or a filing.",
  },
  {
    q: "Is my financial data safe?",
    a: "Your data lives in an isolated, access-controlled database — each company's books are separated by row-level security and encrypted in transit. We never sell your data. See our Privacy Policy for the full picture.",
  },
];
