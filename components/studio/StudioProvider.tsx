"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { buildSeed, makeTxn } from "@/lib/demo/seed";
import { statementFor } from "@/lib/demo/statement";
import { buildReports, type Reports } from "@/lib/demo/reports";
import { splitVat } from "@/lib/demo/categorize";
import { accountByCode } from "@/lib/demo/coa";
import type { Region, Transaction } from "@/lib/demo/types";

export interface ImportSummary {
  imported: number;
  posted: number;
  review: number;
}

interface StudioState {
  region: Region;
  setRegion: (r: Region) => void;
  transactions: Transaction[];
  reports: Reports;

  importing: boolean;
  imported: boolean;
  progress: { done: number; total: number };
  flashId: string | null;
  importSummary: ImportSummary | null;
  importStatement: () => void;
  dismissSummary: () => void;

  approve: (id: string) => void;
  reassign: (id: string, accountCode: string) => void;
}

const StudioContext = createContext<StudioState | null>(null);

const IMPORT_STEP_MS = 280;

export function StudioProvider({ children }: { children: React.ReactNode }) {
  const [region, setRegionState] = useState<Region>("ae");
  const [transactions, setTransactions] = useState<Transaction[]>(() => buildSeed("ae"));
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [flashId, setFlashId] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const runningRef = useRef(false);

  const setRegion = useCallback((r: Region) => {
    setRegionState(r);
    setTransactions(buildSeed(r));
    setImported(false);
    setImporting(false);
    setProgress({ done: 0, total: 0 });
    setFlashId(null);
    setImportSummary(null);
    runningRef.current = false;
  }, []);

  const importStatement = useCallback(() => {
    if (runningRef.current || imported) return;
    runningRef.current = true;
    const lines = statementFor(region);
    setImporting(true);
    setImportSummary(null);
    setProgress({ done: 0, total: lines.length });

    let posted = 0;
    let review = 0;

    lines.forEach((line, i) => {
      setTimeout(() => {
        const txn = makeTxn(line, region, "import");
        if (txn.status === "posted") posted += 1;
        else review += 1;
        setTransactions((prev) => [txn, ...prev]);
        setFlashId(txn.id);
        setProgress({ done: i + 1, total: lines.length });

        if (i === lines.length - 1) {
          setTimeout(() => {
            setImporting(false);
            setImported(true);
            setFlashId(null);
            setImportSummary({ imported: lines.length, posted, review });
            runningRef.current = false;
          }, 450);
        }
      }, IMPORT_STEP_MS * (i + 1));
    });
  }, [region, imported]);

  const dismissSummary = useCallback(() => setImportSummary(null), []);

  const approve = useCallback((id: string) => {
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, status: "posted", confidence: 1 } : t,
      ),
    );
  }, []);

  const reassign = useCallback(
    (id: string, accountCode: string) => {
      setTransactions((prev) =>
        prev.map((t) => {
          if (t.id !== id) return t;
          const acct = accountByCode(region, accountCode);
          const { net, vat } = splitVat(t.amount, t.vatRate);
          return {
            ...t,
            accountCode,
            category: acct?.name ?? t.category,
            net,
            vatAmount: vat,
            status: "posted",
            confidence: 1,
            reason: "re-assigned by reviewer",
          };
        }),
      );
    },
    [region],
  );

  const reports = useMemo(() => buildReports(transactions, region), [transactions, region]);

  const value: StudioState = {
    region,
    setRegion,
    transactions,
    reports,
    importing,
    imported,
    progress,
    flashId,
    importSummary,
    importStatement,
    dismissSummary,
    approve,
    reassign,
  };

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}

export function useStudio(): StudioState {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error("useStudio must be used within StudioProvider");
  return ctx;
}
