import Link from "next/link";
import Sketch from "./Sketch";
import { fmtFull, placeLabel } from "@/lib/site";
import type { Land } from "@/lib/types";

export default function LandCard({ land: l, inCompare, onCompare }: { land: Land; inCompare: boolean; onCompare: () => void }) {
  const title = [`${l.area} م²`, l.pos].filter(Boolean).join(" · ");
  return (
    <article className="card">
      <div className="sk">
        <Sketch area={l.area} pos={l.pos} dir={l.dir} />
        <button type="button" className="cmp" aria-pressed={inCompare} onClick={onCompare}>{inCompare ? "في المقارنة" : "+ قارن"}</button>
      </div>
      <div className="card-b">
        <div className="where">{placeLabel(l.zone, l.hood)}</div>
        <h3 className="num">{title}</h3>
        <div className="chips">
          {l.legal && <span className={`tag ${l.legal === "مستلمة" ? "ok" : "warn"}`}>{l.legal}</span>}
          {l.stage && <span className="tag plain">{l.stage}{l.floors ? ` · ${l.floors}` : ""}</span>}
          {l.ownership && <span className="tag plain">{l.ownership}</span>}
          {l.views.slice(0, 2).map((v) => <span className="tag g" key={v}>{v}</span>)}
        </div>
        <div className="price">
          <div><small>السعر الكلي</small><b className="num">{fmtFull(l.price)}</b></div>
          <Link className="btn dark sm" href={`/land/${l.code}`}>تفاصيل</Link>
        </div>
      </div>
    </article>
  );
}
