// Region configuration: drives currency, VAT, tax engine, labels, and the
// seeded client company. Switching region in the Studio swaps all of this live.

import type { Region } from "./types";

export interface RegionConfig {
  id: Region;
  flag: string;
  label: string; // "UAE" / "UK"
  locale: string;
  currency: string; // ISO code for Intl
  currencySymbol: string;

  vatRate: number;
  vatLabel: string; // "VAT (5%)"
  vatReturnName: string; // "VAT return"
  vatPeriod: string; // "this quarter"

  // Profit tax shown as "set aside" on the dashboard.
  taxName: string; // "Corporate Tax" / "Income Tax (MTD)"
  taxRate: number;
  taxFreeThreshold: number; // annual 0% band
  taxNote: string;
  filingAuthority: string; // "FTA · EmaraTax" / "HMRC · MTD ITSA"
  nextDeadline: { label: string; date: string };

  client: {
    name: string;
    handle: string; // short, for avatars
    entity: string; // "FZ-LLC" / "Ltd"
    sector: string;
    sinceNet: number; // opening retained cash, for balance sheet feel
  };
}

export const REGIONS: Record<Region, RegionConfig> = {
  ae: {
    id: "ae",
    flag: "🇦🇪",
    label: "UAE",
    locale: "en-AE",
    currency: "AED",
    currencySymbol: "AED",
    vatRate: 0.05,
    vatLabel: "VAT (5%)",
    vatReturnName: "VAT return",
    vatPeriod: "this quarter",
    taxName: "Corporate Tax",
    taxRate: 0.09,
    taxFreeThreshold: 375000,
    taxNote: "0% on the first AED 375,000 of profit, 9% above (FTA).",
    filingAuthority: "FTA · EmaraTax",
    nextDeadline: { label: "VAT return — Q2", date: "2026-07-28" },
    client: {
      name: "Crescent Trading FZ-LLC",
      handle: "CT",
      entity: "FZ-LLC",
      sector: "Import & distribution · Dubai",
      sinceNet: 142000,
    },
  },
  gb: {
    id: "gb",
    flag: "🇬🇧",
    label: "UK",
    locale: "en-GB",
    currency: "GBP",
    currencySymbol: "£",
    vatRate: 0.2,
    vatLabel: "VAT (20%)",
    vatReturnName: "VAT return",
    vatPeriod: "this quarter",
    taxName: "Income Tax (MTD)",
    taxRate: 0.2,
    taxFreeThreshold: 12570,
    taxNote: "Estimate after the £12,570 personal allowance — basic-rate set-aside.",
    filingAuthority: "HMRC · MTD ITSA",
    nextDeadline: { label: "Quarterly update — Q1", date: "2026-08-07" },
    client: {
      name: "Northwind Trading Ltd",
      handle: "NW",
      entity: "Ltd",
      sector: "E-commerce & wholesale · Manchester",
      sinceNet: 38500,
    },
  },
};

// The accounting firm running the demo — sells the white-label / partner angle.
export const FIRM = {
  name: "Meridian & Co",
  tagline: "Accountants",
};
