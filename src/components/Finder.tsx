"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import LandCard from "./LandCard";
import { CloseIcon, FilterIcon } from "./Icons";
import { useCompare } from "@/lib/compare";
import { supabaseBrowser } from "@/lib/supabase";
import { FRONT_MIN, OPT, PHONE_RE, ZONES, cleanPhone, fmtShort, hoodLabel, parseMoney, tierName, zoneOf, type Tier } from "@/lib/site";
import { FILTER_KEYS, countLands, emptyFilters, searchLands, type FilterKey, type Filters, type SearchQuery, type Sort } from "@/lib/search";
import type { Land } from "@/lib/types";

const GROUPS: [FilterKey, string][] = [
  ["area", "المساحة"], ["pos", "موقع القطعة"], ["dir", "الاتجاه"], ["view", "الإطلالة"], ["front", "عرض الواجهة"],
  ["stage", "المرحلة البنائية"], ["legal", "الاستلام"], ["ownership", "تسلسل الملكية"], ["utilities", "المرافق"],
];
const toggleIn = (f: Filters, k: FilterKey, v: string): Filters => ({ ...f, [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v] });
const optionLabel = (k: FilterKey, v: string) => (k === "area" ? `${v} م²` : k === "front" ? `${v}م+` : v);

type Props = { initialTier: Tier; initialItems: Land[]; initialTotal: number };

export default function Finder({ initialTier, initialItems, initialTotal }: Props) {
  const [tier, setTier] = useState<Tier>(initialTier);
  const [zone, setZone] = useState("");
  const [hood, setHood] = useState("");
  const [budget, setBudget] = useState<number | null>(null);
  const [sort, setSort] = useState<Sort>("new");
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [items, setItems] = useState<Land[]>(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [areas, setAreas] = useState<string[]>([]);
  const [draft, setDraft] = useState<Filters | null>(null);
  const [draftCount, setDraftCount] = useState<number | null>(null);
  const [alertOpen, setAlertOpen] = useState(false);
  const compare = useCompare();
  const firstRun = useRef(true);
  const reqId = useRef(0);

  const query: SearchQuery = { tier, zone, hood, budget, filters, sort };
  const key = JSON.stringify(query);

  // New search whenever the query changes (the server already rendered the first one). Typing a budget waits a moment.
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    const id = ++reqId.current;
    setLoading(true);
    const t = setTimeout(async () => {
      const r = await searchLands(supabaseBrowser(), query, 0);
      if (id !== reqId.current) return;
      setFailed(!!r.error);
      setItems(r.items); setTotal(r.total); setPage(0); setLoading(false);
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    supabaseBrowser().rpc("land_areas", { p_tier: tier }).then(({ data }) => setAreas(((data ?? []) as number[]).map(String)));
  }, [tier]);

  async function loadMore() {
    const id = ++reqId.current;
    setLoading(true);
    const r = await searchLands(supabaseBrowser(), query, page + 1);
    if (id !== reqId.current) return;
    setFailed(!!r.error);
    setItems((cur) => [...cur, ...r.items.filter((x) => !cur.some((c) => c.id === x.id))]);
    setTotal(r.total); setPage(page + 1); setLoading(false);
  }

  // Live count on the filter sheet's apply button
  useEffect(() => {
    if (!draft) return;
    setDraftCount(null);
    let alive = true;
    const t = setTimeout(() => countLands(supabaseBrowser(), { ...query, filters: draft }).then((n) => alive && setDraftCount(n)), 200);
    return () => { alive = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, tier, zone, hood, budget]);

  useEffect(() => {
    document.body.style.overflow = draft || alertOpen ? "hidden" : "";
    if (!draft) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setDraft(null);
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [draft, alertOpen]);

  const zones = ZONES.filter((z) => z.tier === tier);
  const curZone = zone ? zoneOf(zone) : null;
  const filterCount = FILTER_KEYS.reduce((s, k) => s + filters[k].length, 0);
  const optionsFor = (k: FilterKey): string[] => (k === "area" ? areas : k === "front" ? FRONT_MIN.map(String) : [...OPT[k]]);

  const active: [FilterKey | "budget", string, string][] = [];
  if (budget) active.push(["budget", "", "لحد " + fmtShort(budget)]);
  FILTER_KEYS.forEach((k) => filters[k].forEach((v) => active.push([k, v, k === "front" ? `واجهة ${v}م+` : optionLabel(k, v)])));

  return (
    <>
      <div className="wrap">
        <div className="finder">
          <div className="seg" role="group" aria-label="الفئة">
            {(["mm", "mt"] as Tier[]).map((t) => (
              <button key={t} type="button" aria-pressed={tier === t}
                onClick={() => { setTier(t); setZone(""); setHood(""); setFilters((f) => ({ ...f, area: [] })); }}>
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
            <button type="button" className="fbtn" onClick={() => setDraft({ ...filters })}>
              <FilterIcon />فلاتر{filterCount > 0 && <i className="num">{filterCount}</i>}
            </button>
          </div>
        </div>
      </div>

      <section className="wrap">
        <div className="res-h">
          <h2 className="num">{total ? `${total.toLocaleString("en")} أرض ${tierName(tier)}` : loading ? "بندوّر..." : "مفيش أراضي بالمواصفات دي"}</h2>
          <select aria-label="ترتيب" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="new">الأحدث</option>
            <option value="price">الأقل سعرًا</option>
            <option value="area">الأكبر مساحة</option>
          </select>
        </div>
        {active.length > 0 && (
          <div className="active">
            {active.map(([k, v, t]) => (
              <button key={k + v} type="button" onClick={() => (k === "budget" ? setBudget(null) : setFilters(toggleIn(filters, k, v)))}>{t}</button>
            ))}
          </div>
        )}
        {failed && <div className="err" role="alert" style={{ marginBottom: 12 }}>النتايج ما اتحمّلتش، جرّب تاني.</div>}
        <div className={`grid${loading && page === 0 ? " dim" : ""}`}>
          {items.map((l) => (
            <LandCard key={l.id} land={l} inCompare={compare.has(l.code)} onCompare={() => compare.toggle(l.code)} />
          ))}
          {!items.length && !loading && (
            <div className="empty">
              <span>جرّب تشيل فلتر أو تزوّد الميزانية.</span>
              <button type="button" className="btn line" onClick={() => { setFilters(emptyFilters()); setBudget(null); }}>مسح الفلاتر</button>
            </div>
          )}
        </div>
        {items.length < total && (
          <div className="more">
            <button type="button" className="btn line" disabled={loading} onClick={loadMore}>
              {loading ? "لحظة..." : `اعرض أكتر (فاضل ${(total - items.length).toLocaleString("en")})`}
            </button>
          </div>
        )}
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
                        <button key={v} type="button" className={`opt${k === "area" ? " num" : ""}`} aria-pressed={draft[k].includes(v)} onClick={() => setDraft(toggleIn(draft, k, v))}>
                          {optionLabel(k, v)}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="sheet-f">
              <button type="button" className="btn line" onClick={() => setDraft(emptyFilters())}>مسح الكل</button>
              <button type="button" className="btn dark num" onClick={() => { setFilters(draft); setDraft(null); }}>
                {draftCount == null ? "اعرض النتايج" : `اعرض ${draftCount.toLocaleString("en")} أرض`}
              </button>
            </div>
          </div>
        </div>
      )}

      {alertOpen && <AlertForm criteria={{ tier, zone, hood, budget, ...filters }} onClose={() => setAlertOpen(false)} />}
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
    if (error) return setError(/too many/.test(error.message) ? "سجلت تنبيهات كتير النهارده من الرقم ده" : "التنبيه ما اتسجلش، جرّب تاني");
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
