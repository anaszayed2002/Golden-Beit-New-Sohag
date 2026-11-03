"use client";

import { useEffect, useRef, useState } from "react";

type Props = { id: string; options: readonly string[]; value: string[]; onChange: (v: string[]) => void; placeholder?: string };

// Dropdown list where several items can be ticked; the picks show as removable chips under it.
export default function MultiSelect({ id, options, value, onChange, placeholder = "اختار" }: Props) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("touchstart", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  return (
    <div className="ms" ref={box}>
      <button type="button" id={id} className="ms-btn" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>{value.length ? `${value.length} اختيار` : placeholder}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && (
        <div className="ms-panel" role="listbox" aria-multiselectable="true">
          {options.map((o) => (
            <label key={o} className="ms-opt">
              <input type="checkbox" checked={value.includes(o)} onChange={() => toggle(o)} />
              <span>{o}</span>
            </label>
          ))}
          <button type="button" className="btn dark sm ms-done" onClick={() => setOpen(false)}>تم</button>
        </div>
      )}
      {value.length > 0 && (
        <div className="ms-chips">
          {value.map((v) => <button key={v} type="button" onClick={() => toggle(v)} aria-label={`شيل ${v}`}>{v}</button>)}
        </div>
      )}
    </div>
  );
}
