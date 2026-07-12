"use client";

import { useState } from "react";

export function CopyLinkButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — the link is still visible/openable next to the button.
    }
  }

  return (
    <button type="button" onClick={copy} className="btn-ghost text-sm">
      {copied ? "Copied ✓" : "Copy share link"}
    </button>
  );
}
