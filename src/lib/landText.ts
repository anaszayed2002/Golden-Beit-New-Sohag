import { SITE, fmtDate, fmtFull, hoodLabel, tierName, zoneOf } from "./site";
import { dueNow, instLeftTotal, instTotal, remaining, type Land } from "./types";

export type CardFields = Omit<Land, "id" | "code" | "status" | "created_at" | "approved_at">;
type Rows = [string, string][];

const keep = (rows: [string, string | null | undefined | false][]): Rows => rows.filter((r): r is [string, string] => !!r[1]);

// The land card in four parts, in the order a buyer reads it. Empty values are left out.
export function landSections(l: CardFields): { title: string; rows: Rows }[] {
  const z = zoneOf(l.zone);
  const hasPay = l.paid != null || l.over_amount != null;
  const hasInst = l.inst_value != null && l.inst_count != null;
  const built = l.stage === "قيد البناء" || l.stage === "مبنى" || l.stage === "مبنى متشطب";
  return [
    {
      title: "المكان",
      rows: keep([
        ["المدينة", "سوهاج الجديدة"],
        ["المجاورة", hoodLabel(l.hood)],
        ["المنطقة", z.short],
        ["القطعة", tierName(l.tier)],
        ["البلوك", l.block],
      ]),
    },
    {
      title: "القطعة",
      rows: keep([
        ["المساحة", `${l.area} م²`],
        ["الواجهة", l.pos],
        ["عرض الواجهة", l.front_m ? `${l.front_m} م` : null],
        ["التميز الجغرافي والإطلالة", [...(l.views ?? []), ...(l.services ?? [])].join("، ")],
        ["الاتجاه", l.dir],
        ["المرافق", l.utilities],
      ]),
    },
    {
      title: "الحالة",
      rows: keep([
        ["الحالة", l.legal],
        ["موعد الاستلام", fmtDate(l.delivery_date)],
        ["المرحلة البنائية", l.stage],
        ["آخر موعد لمهلة البناء", fmtDate(l.grace_until)],
        ["مهلة البناء", l.grace_months != null && !l.grace_until ? `فاضل ${l.grace_months} شهر` : null],
        ["وصل لحد", l.build_reached],
        ["عدد الأدوار", l.floors],
        ["بدروم", built && l.basement ? "فيه بدروم" : null],
        ["تسلسل الملكية", l.ownership],
        ["تفاصيل الحالة", l.ownership === "حالة تفصيلية" ? l.ownership_note : null],
      ]),
    },
    {
      title: "السعر",
      rows: keep([
        ["السعر الكلي", fmtFull(l.price)],
        ["المدفوع", l.paid != null ? fmtFull(l.paid) : null],
        ["الأوفر", l.over_amount != null ? fmtFull(l.over_amount) : null],
        ["المطلوب دفعه", hasPay ? fmtFull(dueNow(l)) : null],
        ["المتبقي", hasPay ? fmtFull(remaining(l)) : null],
        ["قيمة القسط", l.inst_value != null ? fmtFull(l.inst_value) : null],
        ["عدد الأقساط", l.inst_count != null ? String(l.inst_count) : null],
        ["إجمالي الأقساط", hasInst ? fmtFull(instTotal(l)) : null],
        ["الأقساط المتبقية", l.inst_left != null ? String(l.inst_left) : null],
        ["إجمالي الأقساط المتبقية", l.inst_value != null && l.inst_left != null ? fmtFull(instLeftTotal(l)) : null],
        ["أول قسط", fmtDate(l.inst_first)],
        ["آخر قسط", fmtDate(l.inst_last)],
        ["قيمة التنازل", l.transfer_fee != null ? fmtFull(l.transfer_fee) : null],
        ["أخرى", l.pay_other],
        ["ملاحظات", l.description],
      ]),
    },
  ];
}

// Plain text card for pasting into WhatsApp. Seller details and plot number are never included.
export function landCardText(l: CardFields & { code: string; status?: string }) {
  const lines = [`كود الأرض: ${l.code}`];
  for (const s of landSections(l)) lines.push("", `— ${s.title} —`, ...s.rows.map(([k, v]) => `${k}: ${v}`));
  lines.push("");
  if (!l.status || l.status === "approved") lines.push(`التفاصيل: ${SITE.url}/land/${l.code}`);
  lines.push(`جولدن بيت · ${SITE.phone}`);
  return lines.join("\n");
}
