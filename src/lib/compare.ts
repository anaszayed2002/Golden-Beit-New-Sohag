"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "gb-compare";
const EVENT = "gb-compare-change";
export const COMPARE_MAX = 3;

function read(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, COMPARE_MAX) : [];
  } catch {
    return [];
  }
}

// Compare picks live in this browser only, shared across pages through localStorage.
export function useCompare() {
  const [codes, setCodes] = useState<string[]>([]);

  useEffect(() => {
    setCodes(read());
    const sync = () => setCodes(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const toggle = useCallback((code: string) => {
    const cur = read();
    let next = cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code];
    if (next.length > COMPARE_MAX) next = next.slice(next.length - COMPARE_MAX);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
    setCodes(next);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { codes, toggle, has: (code: string) => codes.includes(code) };
}
