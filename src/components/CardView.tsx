"use client";

import { useEffect } from "react";
import Sketch from "./Sketch";
import { CloseIcon, WhatsAppIcon } from "./Icons";
import { SITE, fmtFull, hoodLabel, mapUrl, waLink, zoneOf } from "@/lib/site";
import type { Land } from "@/lib/types";

// «العرض كبطاقة»: the seller's map image (or the sketch) with the plot's key facts and Golden Beit's contact.
export default function CardView({ land: l, onClose }: { land: Land; onClose: () => void }) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => { document.body.style.overflow = ""; document.removeEventListener("keydown", esc); };
  }, [onClose]);

  const rows: [string, string | null][] = [
    ["المنطقة", zoneOf(l.zone).short],
    ["المجاورة", hoodLabel(l.hood) || null],
    ["رقم القطعة", l.plot_no],
    ["المساحة", `${l.area} م²`],
    ["السعر الكُلّي", fmtFull(l.price)],
  ];
  const wa = waLink(`أهلاً جولدن بيت، عايز أستفسر عن الأرض ${l.code}\n${SITE.url}/land/${l.code}`);

  return (
    <div className="sheet-bg cv-bg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cv" role="dialog" aria-modal="true" aria-label={`بطاقة الأرض ${l.code}`}>
        <button type="button" className="x" aria-label="إغلاق" onClick={onClose}><CloseIcon /></button>
        <div className="cv-pic">
          {l.map_path
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={mapUrl(l.map_path)} alt="مكان القطعة على الخريطة" />
            : <Sketch area={l.area} pos={l.pos} dir={l.dir} front={l.front_m} big />}
        </div>
        <dl className="cv-rows">
          {rows.filter((r): r is [string, string] => !!r[1]).map(([k, v]) => <div key={k}><dt>{k}</dt><dd className="num">{v}</dd></div>)}
        </dl>
        <div className="cv-foot">
          <div className="cv-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-white.png" alt="" />
            <span><b>جولدن بيت</b><small className="num">{l.code}</small></span>
          </div>
          <a className="btn wa sm" href={wa} target="_blank" rel="noopener"><WhatsAppIcon /><span className="num">{SITE.phone}</span></a>
        </div>
      </div>
    </div>
  );
}
