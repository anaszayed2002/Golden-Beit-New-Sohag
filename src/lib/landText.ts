import { SITE, fmtFull, hoodLabel, tierName, zoneOf } from "./site";
import type { Land } from "./types";

type CardFields = Pick<Land, "tier" | "zone" | "hood" | "block" | "area" | "pos" | "dir" | "view" | "front_m" | "stage" | "legal" | "grace_months" | "ownership" | "ownership_note" | "utilities" | "price" | "paid" | "description">;

// Label/value rows of a land, in the order a buyer reads them. Empty values are left out.
export function landRows(l: CardFields): [string, string][] {
  const z = zoneOf(l.zone);
  const rows: [string, string | null | undefined][] = [
    ["الفئة", tierName(l.tier)],
    ["المنطقة", z.short],
    ["المجاورة", hoodLabel(l.hood)],
    ["البلوك", l.block],
    ["المساحة", `${l.area} م²`],
    ["موقع القطعة", l.pos],
    ["الاتجاه", l.dir],
    ["الإطلالة", l.view],
    ["عرض الواجهة", l.front_m ? `${l.front_m} م` : null],
    ["المرحلة البنائية", l.stage],
    ["الاستلام", l.legal],
    ["مهلة البناء", l.legal === "مستلمة" && l.grace_months != null ? `فاضل ${l.grace_months} شهر` : null],
    ["تسلسل الملكية", l.ownership],
    ["تفاصيل الحالة", l.ownership === "حالة تفصيلية" ? l.ownership_note : null],
    ["المرافق", l.utilities],
    ["المطلوب", fmtFull(l.price)],
    ["المدفوع", l.paid != null ? fmtFull(l.paid) : null],
    ["ملاحظات", l.description],
  ];
  return rows.filter((r): r is [string, string] => !!r[1]);
}

// Plain text card for pasting into WhatsApp. Seller details are never included.
export function landCardText(l: CardFields & { code: string; status?: string }) {
  const lines = [`كود الأرض: ${l.code}`, ...landRows(l).map(([k, v]) => `${k}: ${v}`)];
  if (!l.status || l.status === "approved") lines.push(`التفاصيل: ${SITE.url}/land/${l.code}`);
  lines.push(`جولدن بيت · ${SITE.phone}`);
  return lines.join("\n");
}
