"use client";

import { useEffect } from "react";

// Registers the minimal service worker that makes Mizan installable.
export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((e) => {
        console.warn("[pwa] service worker registration failed:", e);
      });
    }
  }, []);
  return null;
}
