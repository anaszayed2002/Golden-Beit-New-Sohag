"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import LandCard from "./LandCard";
import { CloseIcon, FilterIcon } from "./Icons";
import { useCompare } from "@/lib/compare";
import { supabaseBrowser } from "@/lib/supabase";
import { OPT, PHONE_RE, ZONES, cleanPhone, decimalOnly, digitsOnly, fmtDate, fmtShort, hoodLabel, parseMoney, tierName, zoneOf, type Tier } from "@/lib/site";
import {
  FILTER_KEYS, RANGE_KEYS, SORTS, countLands, emptyFilters, emptyRanges, searchLands,
  type FilterKey, type Filters, type Range, type RangeKey, type Ranges, type SearchQuery, type Sort,
} from "@/lib/search";
import type { Land } from "@/lib/types";

// Sheet layout: every field the seller fills has a filter (plot number and contact details excepted).
type Group = { title: string; ranges?: RangeKey[]; chips?: FilterKey[] };
const GROUPS: Group[] = [
  { title: "السعر", ranges: ["price", "paid", "over_amount", "inst_value", "inst_left", "transfer_fee", "inst_last"] },
  { title: "القطعة", ranges: ["area", "front_m"], chips: ["area", "pos", "views", "services"] },
  { title: "الحالة", ranges: ["delivery_date", "grace_until"], chips: ["legal", "stage", "build_reached", "floors", "basement", "ownership"] },
];
const CHIP_TITLE: Record<FilterKey, string> = {
  area: "المساحات المعروضة", pos: "الواجهة", views: "الإطلالة", services: "خدمات قريبة", legal: "الحالة", stage: "المرحلة البنائية",
  build_reached: "قيد البناء: وصل لحد", floors: "عدد الأدوار", basement: "البدروم", ownership: "تسلسل الملكية",
};
// How each from/to filter is labelled, typed and shown
const RANGE_INFO: Record<RangeKey, { title: string; unit: string; kind: "money" | "decimal" | "int" | "date" }> = {
  price: { title: "السعر الكلي", unit: "جنيه", kind: "money" },
  paid: { title: "المدفوع", unit: "جنيه", kind: "money" },
  over_amount: { title: "الأوفر", unit: "جنيه", kind: "money" },
  inst_value: { title: "قيمة القسط", unit: "جنيه", kind: "money" },
  inst_left: { title: "الأقساط المتبقية", unit: "قسط", kind: "int" },
  transfer_fee: { title: "قيمة التنازل", unit: "جنيه", kind: "money" },
  inst_last: { title: "موعد آخر قسط", unit: "", kind: "date" },
  area: { title: "المساحة", unit: "م²", kind: "decimal" },
  front_m: { title: "عرض الواجهة", unit: "م", kind: "decimal" },
  delivery_date: { title: "موعد الاستلام", unit: "", kind: "date" },
  grace_until: { title: "آخر موعد لمهلة البناء", unit: "", kind: "date" },
};

type Sheet = { filters: Filters; ranges: Ranges };

const optionsFor = (k: FilterKey, areas: string[]): string[] => (k === "area" ? areas : k === "basement" ? ["فيه بدروم"] : [...OPT[k]]);
const toggleIn = (f: Filters, k: FilterKey, v: string): Filters => ({ ...f, [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v] });
const chipLabel = (k: FilterKey, v: string) => (k === "area" ? `${v} م²` : k === "views" ? `على ${v}` : k === "services" ? `قريبة من ${v}` : v);
const isSet = (v: Range["min"]) => v != null && v !== "";
function fmtRangeValue(k: RangeKey, v: number | string) {
  const i = RANGE_INFO[k];
  return i.kind === "money" ? fmtShort(Number(v)) : i.kind === "date" ? fmtDate(String(v)) : `${v} ${i.unit}`;
}
function rangeLabel(k: RangeKey, r: Range) {
  const t = RANGE_INFO[k].title;
  if (isSet(r.min) && isSet(r.max)) return `${t} من ${fmtRangeValue(k, r.min!)} لـ ${fmtRangeValue(k, r.max!)}`;
  if (isSet(r.min)) return `${t} من ${fmtRangeValue(k, r.min!)}`;
  return `${t} لحد ${fmtRangeValue(k, r.max!)}`;
}
const setRange = (rs: Ranges, k: RangeKey, side: "min" | "max", v: Range["min"]): Ranges => ({ ...rs, [k]: { ...rs[k], [side]: v } });

type Props = { initialItems: Land[]; initialTotal: number };

export default function Finder({ initialItems, initialTotal }: Props) {
  const [tier, setTier] = useState<Tier | "">("");
  const [zone, setZone] = useState("");
  const [hood, setHood] = useState("");
  const [sort, setSort] = useState<Sort>("approved_at.desc");
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [ranges, setRanges] = useState<Ranges>(emptyRanges);
  const [items, setItems] = useState<Land[]>(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [areas, setAreas] = useState<string[]>([]);
  const [draft, setDraft] = useState<Sheet | null>(null);
  const [draftCount, setDraftCount] = useState<number | null>(null);
  const [alertOpen, setAlertOpen] = useState(false);
  const compare = useCompare();
  const firstRun = useRef(true);
  const reqId = useRef(0);

  const query: SearchQuery = { tier, zone, hood, filters, ranges, sort };
  const key = JSON.stringify(query);

  // New search whenever the query changes (the server already rendered the first one). Typing waits a moment.
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
    supabaseBrowser().rpc("land_areas", { p_tier: tier || null }).then(({ data }) => setAreas(((data ?? []) as number[]).map(String)));
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
    const t = setTimeout(() => countLands(supabaseBrowser(), { ...query, ...draft }).then((n) => alive && setDraftCount(n)), 250);
    return () => { alive = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(draft), tier, zone, hood]);

  useEffect(() => {
    document.body.style.overflow = draft || alertOpen ? "hidden" : "";
    if (!draft) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setDraft(null);
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [draft, alertOpen]);

  const zones = ZONES.filter((z) => !tier || z.tier === tier);
  const curZone = zone ? zoneOf(zone) : null;

  const active: { key: string; label: string; clear: () => void }[] = [];
  RANGE_KEYS.forEach((k) => {
    const r = ranges[k];
    if (isSet(r.min) || isSet(r.max)) active.push({ key: "r" + k, label: rangeLabel(k, r), clear: () => setRanges({ ...ranges, [k]: { min: null, max: null } }) });
  });
  FILTER_KEYS.forEach((k) => filters[k].forEach((v) => active.push({ key: k + v, label: chipLabel(k, v), clear: () => setFilters(toggleIn(filters, k, v)) })));
  // The budget box outside the sheet is "السعر الكلي لحد"; it isn't counted on the filter button.
  const filterCount = active.length - (isSet(ranges.price.max) && !isSet(ranges.price.min) ? 1 : 0);

  const clearAll = () => { setFilters(emptyFilters()); setRanges(emptyRanges()); };

  return (
    <>
      <div className="wrap">
        <div className="finder">
          <div className="seg" role="group" aria-label="الفئة">
            {(["", "mm", "mt"] as (Tier | "")[]).map((t) => (
              <button key={t || "all"} type="button" aria-pressed={tier === t}
                onClick={() => { setTier(t); setZone(""); setHood(""); setFilters((f) => ({ ...f, area: [] })); }}>
                {t ? tierName(t) : "الكل"}
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
                  value={isSet(ranges.price.max) ? Number(ranges.price.max).toLocaleString("en") : ""}
                  onChange={(e) => setRanges(setRange(ranges, "price", "max", parseMoney(e.target.value)))} />
                <span>جنيه</span>
              </label>
            </div>
            <button type="button" className="fbtn" onClick={() => setDraft({ filters: { ...filters }, ranges: { ...ranges } })}>
              <FilterIcon />فلاتر{filterCount > 0 && <i className="num">{filterCount}</i>}
            </button>
          </div>
        </div>
      </div>

      <section className="wrap">
        <div className="res-h">
          <h2 className="num">{total ? `${total.toLocaleString("en")} أرض${tier ? " " + tierName(tier) : ""}` : loading ? "بندوّر..." : "مفيش أراضي بالمواصفات دي"}</h2>
          <select aria-label="ترتيب" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            {SORTS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </div>
        {active.length > 0 && (
          <div className="active">
            {active.map((a) => <button key={a.key} type="button" onClick={a.clear}>{a.label}</button>)}
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
              <button type="button" className="btn line" onClick={clearAll}>مسح الفلاتر</button>
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
              {GROUPS.map((g) => (
                <div key={g.title}>
                  <div className="grp-t">{g.title}</div>
                  {g.ranges?.map((k) => (
                    <RangeRow key={k} k={k} value={draft.ranges[k]} onChange={(side, v) => setDraft({ ...draft, ranges: setRange(draft.ranges, k, side, v) })} />
                  ))}
                  {g.chips?.map((k) => {
                    const opts = optionsFor(k, areas);
                    if (!opts.length) return null;
                    return (
                      <div className="grp" key={k}>
                        <h3>{CHIP_TITLE[k]}</h3>
                        <div className="opts">
                          {opts.map((v) => (
                            <button key={v} type="button" className={`opt${k === "area" ? " num" : ""}`} aria-pressed={draft.filters[k].includes(v)}
                              onClick={() => setDraft({ ...draft, filters: toggleIn(draft.filters, k, v) })}>
                              {k === "area" ? `${v} م²` : v}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="sheet-f">
              <button type="button" className="btn line" onClick={() => setDraft({ filters: emptyFilters(), ranges: emptyRanges() })}>مسح الكل</button>
              <button type="button" className="btn dark num" onClick={() => { setFilters(draft.filters); setRanges(draft.ranges); setDraft(null); }}>
                {draftCount == null ? "اعرض النتايج" : `اعرض ${draftCount.toLocaleString("en")} أرض`}
              </button>
            </div>
          </div>
        </div>
      )}

      {alertOpen && <AlertForm criteria={{ tier, zone, hood, ...filters, ranges }} onClose={() => setAlertOpen(false)} />}
    </>
  );
}

// "من / لحد" inputs for one number or date the seller enters
function RangeRow({ k, value, onChange }: { k: RangeKey; value: Range; onChange: (side: "min" | "max", v: Range["min"]) => void }) {
  const info = RANGE_INFO[k];
  const show = (v: Range["min"]) => (!isSet(v) ? "" : info.kind === "money" ? Number(v).toLocaleString("en") : String(v));
  const parse = (raw: string): [string, Range["min"]] => {
    if (info.kind === "date") return [raw, raw || null];
    if (info.kind === "money") { const n = parseMoney(raw); return [n ? n.toLocaleString("en") : "", n]; }
    if (info.kind === "int") { const d = digitsOnly(raw).slice(0, 3); return [d, d ? Number(d) : null]; }
    const d = decimalOnly(raw, 4);
    const n = Number(d.replace(/\.$/, ""));
    return [d, d && !Number.isNaN(n) ? n : null];
  };
  // Keep the text as typed (so "12." can become "12.5"); only resync when the value changed from outside (e.g. "مسح الكل").
  const [text, setText] = useState({ min: show(value.min), max: show(value.max) });
  useEffect(() => {
    setText((c) => ({
      min: parse(c.min)[1] === value.min ? c.min : show(value.min),
      max: parse(c.max)[1] === value.max ? c.max : show(value.max),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.min, value.max]);
  const input = (side: "min" | "max", ph: string) => (
    <input className="rng-in num" type={info.kind === "date" ? "date" : "text"}
      inputMode={info.kind === "decimal" ? "decimal" : info.kind === "date" ? undefined : "numeric"}
      placeholder={ph} aria-label={`${info.title} ${ph}`} value={text[side]}
      onChange={(e) => { const [t, n] = parse(e.target.value); setText((c) => ({ ...c, [side]: t })); onChange(side, n); }} />
  );
  return (
    <div className="grp">
      <h3>{info.title}{info.unit && <small>{info.unit}</small>}</h3>
      <div className="rng">{input("min", "من")}<span>—</span>{input("max", "لحد")}</div>
    </div>
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
