"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import CloseButton from "@/components/CloseButton";
import { supabaseBrowser } from "@/lib/supabase";
import { useCompare } from "@/lib/compare";
import { OPT, fmtFull, hoodLabel, zoneOf } from "@/lib/site";
import { LAND_COLUMNS, dueNow, remaining, type Land } from "@/lib/types";

type Row = { k: string; show: (l: Land) => React.ReactNode; score?: (l: Land) => number | null };
const rank = (list: readonly string[], v: string | null) => (v ? list.indexOf(v) : null);

// Higher score wins; a row is only highlighted when the lands differ.
const ROWS: Row[] = [
  { k: "المكان", show: (l) => <>{hoodLabel(l.hood)}{l.hood && <br />}<small className="muted">{zoneOf(l.zone).short}</small></> },
  { k: "السعر الكلي", show: (l) => fmtFull(l.price), score: (l) => -l.price },
  { k: "المطلوب دفعه", show: (l) => (l.paid != null || l.over_amount != null ? fmtFull(dueNow(l)) : "—"), score: (l) => (l.paid != null || l.over_amount != null ? -dueNow(l) : null) },
  { k: "المتبقي", show: (l) => (l.paid != null || l.over_amount != null ? fmtFull(remaining(l)) : "—") },
  { k: "الأقساط المتبقية", show: (l) => (l.inst_left != null ? `${l.inst_left}${l.inst_value ? ` × ${fmtFull(l.inst_value)}` : ""}` : "—") },
  { k: "المساحة", show: (l) => `${l.area} م²`, score: (l) => l.area },
  { k: "الواجهة", show: (l) => l.pos ?? "—", score: (l) => rank(OPT.pos, l.pos) },
  { k: "عرض الواجهة", show: (l) => (l.front_m ? `${l.front_m} م` : "—"), score: (l) => l.front_m },
  { k: "التميز الجغرافي والإطلالة", show: (l) => l.views.join("، ") || "—", score: (l) => l.views.length || null },
  { k: "الحالة", show: (l) => l.legal ?? "—", score: (l) => (l.legal ? (l.legal === "مستلمة" ? 1 : 0) : null) },
  { k: "المرحلة البنائية", show: (l) => [l.stage, l.build_reached && `لحد ${l.build_reached}`, l.floors, l.basement ? "+ بدروم" : null].filter(Boolean).join(" · ") || "—" },
  { k: "الملكية", show: (l) => l.ownership ?? "—", score: (l) => { const r = rank(OPT.ownership, l.ownership); return r == null ? null : -r; } },
];

function bests(lands: Land[], score?: Row["score"]) {
  if (!score) return lands.map(() => false);
  const v = lands.map(score);
  const known = v.filter((x): x is number => x != null);
  if (known.length < 2) return lands.map(() => false);
  const top = Math.max(...known);
  if (known.every((x) => x === top)) return lands.map(() => false);
  return v.map((x) => x === top);
}

export default function ComparePage() {
  const compare = useCompare();
  const [lands, setLands] = useState<Land[] | null>(null);

  useEffect(() => {
    const fromUrl = (new URLSearchParams(window.location.search).get("c") || "").split(",").filter(Boolean);
    // A shared link opens its own picks; after that this browser's picks drive the table.
    const codes = compare.codes.length ? compare.codes : fromUrl;
    if (!codes.length) { setLands([]); return; }
    supabaseBrowser().from("lands").select(LAND_COLUMNS).in("code", codes.slice(0, 3)).eq("status", "approved")
      .then(({ data }) => setLands(((data ?? []) as Land[]).sort((a, b) => codes.indexOf(a.code) - codes.indexOf(b.code))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compare.codes.join(",")]);

  return (
    <main>
      <div className="wrap">
        <div className="dt-top"><h1 style={{ fontSize: 22 }}>مقارنة الأراضي</h1><CloseButton /></div>
        {lands === null ? (
          <p className="loading">لحظة...</p>
        ) : lands.length < 2 ? (
          <div className="empty" style={{ marginBottom: 40 }}>
            <span>اختار أرضين أو تلاتة من «+ قارن» على كروت الأراضي.</span>
            <Link className="btn dark" href="/">شوف الأراضي</Link>
          </div>
        ) : (
          <>
            <p className="muted" style={{ margin: 0, fontSize: 14 }}>الخانة الخضرا هي الأفضل في البند.</p>
            <div className="cmp-wrap">
              <table className="cmp-t">
                <thead>
                  <tr><th></th>{lands.map((l) => (
                    <td key={l.id}><span className="num">{l.code}</span><br />
                      <span className="cmp-acts"><Link className="btn dark sm" href={`/land/${l.code}`}>تفاصيل</Link>
                        <button type="button" className="btn line sm" onClick={() => compare.toggle(l.code)}>{compare.has(l.code) ? "شيل" : "رجّع"}</button></span>
                    </td>))}</tr>
                </thead>
                <tbody>
                  {ROWS.map((r) => {
                    const b = bests(lands, r.score);
                    return <tr key={r.k}><th>{r.k}</th>{lands.map((l, i) => <td key={l.id} className={`num${b[i] ? " best" : ""}`}>{r.show(l)}</td>)}</tr>;
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
