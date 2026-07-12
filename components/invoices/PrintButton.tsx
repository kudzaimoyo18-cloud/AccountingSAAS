"use client";

export function PrintButton({ label = "Download PDF" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="btn-primary text-sm print:hidden">
      {label}
    </button>
  );
}
