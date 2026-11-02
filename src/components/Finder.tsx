"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import LandCard from "./LandCard";
import { CloseIcon, FilterIcon } from "./Icons";
import { useCompare } from "@/lib/compare";
import { supabaseBrowser } from "@/lib/supabase";
import { FRONT_MIN, OPT, PHONE_RE, ZONES, cleanPhone, fmtShort, hoodLabel, parseMoney, tierName, zoneOf, type Tier } from "@/lib/site";
import type { Land } from "@/lib/types";

type Key = "area" | "pos" | "dir" | "view" | "front" | "stage" | "legal" | "ownership" | "utilities";
type Filters = Record<Key, Set<string>>;
const KEYS: Key[] = ["area", "pos", "dir", "view", "front", "stage", "legal", "ownership", "utilities"];
const GROUPS: [Key, string][] = [
  ["area", "المساحة"], ["pos", "موقع القطعة"], ["dir", "الاتجاه"], ["view", "الإطلالة"], ["front", "عرض الواجهة"],
  ["stage", "المرحلة البنائية"], ["legal", "الاستلام"], ["ownership", "تسلسل الملكية"], ["utilities", "المرافق"],
];
const empty = (): Filters => Object.fromEntries(KEYS.map((k) => [k, new Set<string>()])) as Filters;
const clone = (f: Filters): Filters => Object.fromEntries(KEYS.map((k) => [k, new Set(f[k])])) as Filters;
type Sort = "new" | "price" | "area";

type Base = { tier: Tier; zone: string; hood: string; budget: number | null };

function matches(l: Land, b: Base, f: Filters) {
  if (l.tier !== b.tier) return false;
  if (b.zone && l.zone !== b.zone) return false;
  if (b.hood && l.hood !== b.hood) return false;
  if (b.budget && l.price > b.budget) return false;
  if (f.area.size && !f.area.has(String(l.area))) return false;
  for (const k of ["pos", "dir", "view", "stage", "legal", "ownership", "utilities"] as const) {
    if (f[k].size && !f[k].has(l[k] ?? "")) return false;
  }
  if (f.front.size && !(l.front_m && [...f.front].some((v) => l.front_m! >= Number(v)))) return false;
  return true;
}

export default function Finder({ lands }: { lands: Land[] }) {
  // Open on the tier that has lands, so the first view is never empty when the other one isn't.
  const [tier, setTier] = useState<Tier>(() => (lands.some((l) => l.tier === "mm") || !lands.length ? "mm" : "mt"));
  const [zone, setZone] = useState("");
  const [hood, setHood] = useState("");
  const [budget, setBudget] = useState<number | null>(null);
  const [sort, setSort] = useState<Sort>("new");
  const [filters, setFilters] = useState<Filters>(empty);
  const [draft, setDraft] = useState<Filters | null>(null);
  const [alertOpen, setAlertOpen] = useState(false);
  const compare = useCompare();

  const base: Base = { tier, zone, hood, budget };
  const items = useMemo(() => {
    const r = lands.filter((l) => matches(l, base, filters));
    if (sort === "price") r.sort((a, b) => a.price - b.price);
    else if (sort === "area") r.sort((a, b) => b.area - a.area);
    else r.sort((a, b) => (b.approved_at ?? b.created_at).localeCompare(a.approved_at ?? a.created_at));
    return r;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lands, tier, zone, hood, budget, sort, filters]);

  const zones = ZONES.filter((z) => z.tier === tier);
  const curZone = zone ? zoneOf(zone) : null;
  const areas = [...new Set(lands.filter((l) => l.tier === tier).map((l) => l.area))].sort((a, b) => a - b).map(String);
  const filterCount = KEYS.reduce((s, k) => s + filters[k].size, 0);

  useEffect(() => {
    document.body.style.overflow = draft ? "hidden" : "";
    if (!draft) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setDraft(null);
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [draft]);

  const optionsFor = (k: Key): string[] => (k === "area" ? areas : k === "front" ? FRONT_MIN.map(String) : [...OPT[k]]);
  const optionLabel = (k: Key, v: string) => (k === "area" ? `${v} م²` : k === "front" ? `${v}م+` : v);

  const active: [Key | "budget", string, string][] = [];
  if (budget) active.push(["budget", "", "لحد " + fmtShort(budget)]);
  KEYS.forEach((k) => filters[k].forEach((v) => active.push([k, v, k === "front" ? `واجهة ${v}م+` : optionLabel(k, v)])));

  const removeActive = (k: Key | "budget", v: string) => {
    if (k === "budget") return setBudget(null);
    const next = clone(filters);
    next[k].delete(v);
    setFilters(next);
  };

  return (
    <>
      <div className="wrap">
        <div className="finder">
          <div className="seg" role="group" aria-label="الفئة">
            {(["mm", "mt"] as Tier[]).map((t) => (
              <button key={t} type="button" aria-pressed={tier === t}
                onClick={() => { setTier(t); setZone(""); setHood(""); setFilters((f) => { const n = clone(f); n.area.clear(); return n; }); }}>
                {tierName(t)}<small>{t === "mm" ? "455 و214 فدان والتوسعات" : "735 فدان والأحياء"}</small>
              </button>
            ))}
          </div>
          <div>
            <div className="lbl">المنطقة</div>
            <div className="scroll">
              <button type="button" className="pill" aria-pressed={!zone} onClick={() => { setZone(""); setHood(""); }}>كل المناطق</button>
              {zones.map((z) => (
                <button key={z.id} type="button" className="pill" aria-pressed={zone === z.id} onClick={() => { setZone(z.id); setHood(""); }}>{z.short}</button>
              ))}
            </div>
          </div>
          {curZone && curZone.hoods.length > 0 && (
            <div>
              <div className="lbl">المجاورة</div>
              <div className="scroll">
                <button type="button" className="pill" aria-pressed={!hood} onClick={() => setHood("")}>الكل</button>
                {curZone.hoods.map((h) => (
                  <button key={h} type="button" className="pill" aria-pressed={hood === h} onClick={() => setHood(h)}>{hoodLabel(h)}</button>
                ))}
              </div>
            </div>
          )}
          <div className="row2">
            <div>
              <div className="lbl">ميزانيتك لحد</div>
              <label className="money" htmlFor="budget">
                <input id="budget" className="num" inputMode="numeric" placeholder="اكتب المبلغ" autoComplete="off"
                  value={budget ? budget.toLocaleString("en") : ""} onChange={(e) => setBudget(parseMoney(e.target.value))} />
                <span>جنيه</span>
              </label>
            </div>
            <button type="button" className="fbtn" onClick={() => setDraft(clone(filters))}>
              <FilterIcon />فلاتر{filterCount > 0 && <i className="num">{filterCount}</i>}
            </button>
          </div>
        </div>
      </div>

      <section className="wrap">
        <div className="res-h">
          <h2>{items.length ? `${items.length} أرض ${tierName(tier)}` : "مفيش أراضي بالمواصفات دي"}</h2>
          <select aria-label="ترتيب" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="new">الأحدث</option>
            <option value="price">الأقل سعرًا</option>
            <option value="area">الأكبر مساحة</option>
          </select>
        </div>
        {active.length > 0 && (
          <div className="active">
            {active.map(([k, v, t]) => <button key={k + v} type="button" onClick={() => removeActive(k, v)}>{t}</button>)}
          </div>
        )}
        <div className="grid">
          {items.map((l) => (
            <LandCard key={l.id} land={l} inCompare={compare.has(l.code)} onCompare={() => compare.toggle(l.code)} />
          ))}
          {!items.length && (
            <div className="empty">
              <span>جرّب تشيل فلتر أو تزوّد الميزانية.</span>
              <button type="button" className="btn line" onClick={() => { setFilters(empty()); setBudget(null); }}>مسح الفلاتر</button>
            </div>
          )}
        </div>
        <div className="alert">
          <div><b>مش لاقي الأرض اللي في دماغك؟</b><span>سيب اسمك ورقمك، وأول ما تنزل أرض بالمواصفات دي هنبعتهالك على واتساب.</span></div>
          <button type="button" className="btn gold" onClick={() => setAlertOpen(true)}>فعّل التنبيه</button>
        </div>
      </section>

      {compare.codes.length >= 2 && (
        <div className="tray"><Link className="btn dark" href={`/compare?c=${compare.codes.join(",")}`}>قارن {compare.codes.length} أراضي</Link></div>
      )}

      {draft && (
        <div className="sheet-bg" onClick={(e) => e.target === e.currentTarget && setDraft(null)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="fTitle">
            <div className="sheet-h"><h2 id="fTitle">الفلاتر</h2><button type="button" className="x" aria-label="إغلاق" onClick={() => setDraft(null)}><CloseIcon /></button></div>
            <div className="sheet-b">
              {GROUPS.map(([k, title]) => {
                const opts = optionsFor(k);
                if (!opts.length) return null;
                return (
                  <div className="grp" key={k}>
                    <h3>{title}</h3>
                    <div className="opts">
                      {opts.map((v) => (
                        <button key={v} type="button" className={`opt${k === "area" ? " num" : ""}`} aria-pressed={draft[k].has(v)}
                          onClick={() => { const n = clone(draft); n[k].has(v) ? n[k].delete(v) : n[k].add(v); setDraft(n); }}>
                          {optionLabel(k, v)}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="sheet-f">
              <button type="button" className="btn line" onClick={() => setDraft(empty())}>مسح الكل</button>
              <button type="button" className="btn dark" onClick={() => { setFilters(draft); setDraft(null); }}>
                اعرض {lands.filter((l) => matches(l, base, draft)).length} أرض
              </button>
            </div>
          </div>
        </div>
      )}

      {alertOpen && <AlertForm criteria={{ tier, zone, hood, budget, ...Object.fromEntries(KEYS.map((k) => [k, [...filters[k]]])) }} onClose={() => setAlertOpen(false)} />}
    </>
  );
}

function AlertForm({ criteria, onClose }: { criteria: Record<string, unknown>; onClose: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (name.trim().length < 2) return setError("اكتب اسمك");
    if (!PHONE_RE.test(phone)) return setError("رقم الموبايل لازم يكون 11 رقم ويبدأ بـ 01");
    setBusy(true);
    const { error } = await supabaseBrowser().from("land_alerts").insert({ name: name.trim(), phone, criteria });
    setBusy(false);
    if (error) return setError("التنبيه ما اتسجلش، جرّب تاني");
    setDone(true);
  }

  return (
    <div className="sheet-bg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form className="sheet" role="dialog" aria-modal="true" aria-labelledby="aTitle" onSubmit={submit} noValidate>
        <div className="sheet-h"><h2 id="aTitle">فعّل التنبيه</h2><button type="button" className="x" aria-label="إغلاق" onClick={onClose}><CloseIcon /></button></div>
        <div className="sheet-b" style={{ display: "grid", gap: 12, paddingTop: 14 }}>
          {done ? (
            <div className="done">تمام، هنبعتلك على واتساب أول ما تنزل أرض بالمواصفات دي.</div>
          ) : (
            <>
              <label className="field" htmlFor="alName">الاسم<input id="alName" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>
              <label className="field" htmlFor="alPhone">رقم الموبايل (واتساب)
                <input id="alPhone" className="num ltr" inputMode="tel" placeholder="01xxxxxxxxx" value={phone} onChange={(e) => setPhone(cleanPhone(e.target.value))} autoComplete="tel" />
              </label>
              {error && <div className="err" role="alert">{error}</div>}
            </>
          )}
        </div>
        <div className="sheet-f">
          {done ? <button type="button" className="btn dark" onClick={onClose}>تمام</button>
            : <button type="submit" className="btn dark" disabled={busy}>{busy ? "بنسجل..." : "سجّل التنبيه"}</button>}
        </div>
      </form>
    </div>
  );
}
