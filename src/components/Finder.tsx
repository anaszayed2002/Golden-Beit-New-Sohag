"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Plot from "./Plot";
import { AREAS, fmtShort, normalizeDigits, parseMoney, tierName, type Tier } from "@/lib/site";
import type { Listing, Neighborhood } from "@/lib/types";

type Sort = "asc" | "desc" | "new";

export default function Finder({ listings, hoods }: { listings: Listing[]; hoods: Neighborhood[] }) {
  const [tier, setTier] = useState<Tier>("mt");
  const [area, setArea] = useState(0);
  const [budget, setBudget] = useState<number | null>(null);
  const [sort, setSort] = useState<Sort>("asc");
  const labels = useMemo(() => new Map(hoods.map((h) => [h.n, h.label])), [hoods]);

  const items = useMemo(() => {
    const list = listings.filter((x) => x.tier === tier && (!area || x.area === area) && (!budget || x.ask <= budget));
    if (sort === "asc") list.sort((a, b) => a.ask - b.ask);
    else if (sort === "desc") list.sort((a, b) => b.ask - a.ask);
    else list.sort((a, b) => (b.approved_at ?? b.created_at).localeCompare(a.approved_at ?? a.created_at));
    return list;
  }, [listings, tier, area, budget, sort]);

  return (
    <>
      <div className="wrap" style={{ marginTop: -10 }}>
        <div className="finder">
          <div className="q">
            <h2>الفئة</h2>
            <div className="opts">
              {(["mt", "mm"] as Tier[]).map((t) => (
                <button key={t} type="button" aria-pressed={tier === t} onClick={() => { setTier(t); setArea(0); }}>{tierName(t)}</button>
              ))}
            </div>
          </div>
          <div className="q">
            <h2>المساحة</h2>
            <div className="opts">
              {AREAS[tier].map((a) => (
                <button key={a} type="button" className="num" aria-pressed={area === a} onClick={() => setArea(a)}>{a} م²</button>
              ))}
              <button type="button" aria-pressed={area === 0} onClick={() => setArea(0)}>أي مساحة</button>
            </div>
          </div>
          <div className="q">
            <h2>ميزانيتك لحد</h2>
            <label className="money" htmlFor="fBudget">
              <input
                id="fBudget"
                className="num"
                inputMode="numeric"
                autoComplete="off"
                placeholder="اكتب المبلغ"
                value={budget ? budget.toLocaleString("en") : ""}
                onChange={(e) => setBudget(parseMoney(normalizeDigits(e.target.value)))}
              />
              <span>جنيه</span>
            </label>
            <small>سيبها فاضية لو عايز تشوف كل الأسعار</small>
          </div>
        </div>
      </div>

      <section className="wrap list-sec">
        <div className="list-h">
          <h2>{items.length ? `${items.length} أرض معروضة ${tierName(tier)}` : "مفيش أراضي بالمواصفات دي دلوقتي"}</h2>
          <label htmlFor="fSort">ترتيب{" "}
            <select id="fSort" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="asc">الأرخص الأول</option>
              <option value="desc">الأغلى الأول</option>
              <option value="new">الأحدث</option>
            </select>
          </label>
        </div>
        <div className="grid">
          {items.map((x) => {
            const label = labels.get(x.neighborhood);
            return (
              <article className="card" key={x.id}>
                <div className="plot"><Plot area={x.area} /><span className="tag">{tierName(x.tier)}</span></div>
                <div className="card-b">
                  <h3>أرض <span className="num">{x.area}</span> م² · مجاورة <span className="num">{x.neighborhood}</span></h3>
                  <div className="meta">
                    {x.features.map((f) => <span className="tag" key={f}>{f}</span>)}
                    {label && <span className="tag g">{label}</span>}
                  </div>
                  <div className="card-f">
                    <div><small>المطلوب</small><b className="num">{fmtShort(x.ask)}</b></div>
                    <Link className="btn dark" href={`/land/${x.code}`}>تفاصيل</Link>
                  </div>
                </div>
              </article>
            );
          })}
          {!items.length && (
            <div className="empty">
              <span>جرّب تزوّد الميزانية أو تختار &quot;أي مساحة&quot;.</span>
              <Link className="btn line" href="/sell">اعرض أرضك</Link>
            </div>
          )}
        </div>
        <div className="sell">
          <div>
            <h2>عندك أرض في سوهاج الجديدة؟</h2>
            <p>اعرضها عندنا، وبعد المراجعة هتظهر هنا قدام كل اللي بيدوّروا.</p>
          </div>
          <Link className="btn gold" href="/sell">اعرض أرضك</Link>
        </div>
      </section>
    </>
  );
}
