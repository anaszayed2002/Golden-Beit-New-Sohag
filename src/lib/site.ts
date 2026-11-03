export const SITE = {
  name: "Golden Beit New Sohag",
  phone: "01040333703",
  whatsapp: "201040333703",
  email: "info@goldenbeit.com",
  url: "https://sohag.goldenbeit.com",
  facebook: process.env.NEXT_PUBLIC_FACEBOOK_URL || "",
};

export type Tier = "mm" | "mt";
export const tierName = (t: Tier) => (t === "mm" ? "مميز" : "متوسط");

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => String(a + i));

export type ZoneId = "z455" | "z214" | "ztm" | "z735" | "zahy";
export type Zone = { id: ZoneId; tier: Tier; name: string; short: string; hoods: string[] };

// Areas and their neighborhoods. Ranges include both ends.
export const ZONES: Zone[] = [
  { id: "z455", tier: "mm", name: "منطقة الـ455 فدان", short: "455 فدان", hoods: range(3, 10) },
  { id: "z214", tier: "mm", name: "منطقة الـ214 فدان", short: "214 فدان", hoods: ["الشمالية", "الجنوبية"] },
  { id: "ztm", tier: "mm", name: "التوسعات الجنوبية (مميز)", short: "التوسعات / المجاورات / 735 فدان", hoods: [...range(11, 17), ...range(37, 40)] },
  { id: "z735", tier: "mt", name: "التوسعات الجنوبية 735 فدان", short: "التوسعات / المجاورات / 735 فدان", hoods: range(18, 49) },
  { id: "zahy", tier: "mt", name: "الأحياء (الإسكان الاجتماعي)", short: "الأحياء", hoods: [] },
];
export const zoneOf = (id: string) => ZONES.find((z) => z.id === id) ?? ZONES[0];
export const hoodLabel = (h: string | null | undefined) => (!h ? "" : /^\d+$/.test(h) ? "مجاورة " + h : h);
export const placeLabel = (zone: string, hood: string | null) => [hoodLabel(hood), zoneOf(zone).short].filter(Boolean).join(" · ");

// Option lists double as ranking order for the compare table (worst → best where it applies).
export const OPT = {
  pos: ["واجهة واحدة", "ناصية", "دبل فيس", "تربل فيس"],
  // التميز الجغرافي والإطلالة: what the plot faces or is near (one list, pick any)
  views: ["حديقة", "مسجد", "مدرسة", "جامعة", "مستشفى", "صيدلية", "بنك", "سوق", "مول", "نادي", "خدمات", "باركينج", "شارع", "شارع رئيسي", "موقف مواصلات", "محطة بنزين"],
  legal: ["غير مستلمة", "مستلمة"],
  stage: ["أرض فضاء", "ذات رخصة", "قيد البناء", "مبنى", "مبنى متشطب"],
  build_reached: ["أساسات فقط", "أرضي", "أول", "ثاني", "ثالث", "رابع"],
  floors: ["أرضي", "أرضي + 1", "أرضي + 2", "أرضي + 3", "أرضي + 4", "أرضي + 5"],
  ownership: ["مالك أصيل", "توكيل واحد", "توكيلين", "أكثر من توكيلين", "حالة تفصيلية"],
} as const;

// Every neighborhood in the sell form; the neighborhood decides the area and the class.
export const ALL_HOODS = [...range(3, 49), "الشمالية", "الجنوبية", "الأحياء"];
export function hoodZone(h: string): ZoneId | null {
  if (h === "الشمالية" || h === "الجنوبية") return "z214";
  if (h === "الأحياء") return "zahy";
  if (!/^\d+$/.test(h)) return null;
  const n = Number(h);
  if (n >= 3 && n <= 10) return "z455";
  if ((n >= 11 && n <= 17) || (n >= 37 && n <= 40)) return "ztm";
  if (n >= 18 && n <= 49) return "z735";
  return null;
}

export const fmtDate = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" }) : "");

export const PHONE_RE = /^01[0125][0-9]{8}$/;
// Admin accounts only. Supabase Auth needs an email, so each phone maps to a fixed synthetic one.
export const phoneEmail = (phone: string) => `${phone}@users.goldenbeit.com`;

export function fmtShort(v: number) {
  if (v >= 1_000_000) return (Math.round(v / 10_000) / 100).toLocaleString("en") + " مليون";
  return Math.round(v / 1000).toLocaleString("en") + " ألف";
}
export const fmtFull = (v: number) => Math.round(v).toLocaleString("en") + " ج";

// Arabic-Indic digits typed on phones become Latin digits
export function normalizeDigits(s: string) {
  return s.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
}
export const digitsOnly = (s: string) => normalizeDigits(s).replace(/[^\d]/g, "");
// Numbers that may have a fraction (276.5): keeps one decimal point, up to 2 places. "٫" and "," count as the point.
export function decimalOnly(s: string, maxInt = 4) {
  const t = normalizeDigits(s).replace(/[٫,]/g, ".").replace(/[^\d.]/g, "");
  const [int = "", ...rest] = t.split(".");
  const frac = rest.join("").slice(0, 2);
  return int.slice(0, maxInt) + (t.includes(".") ? "." + frac : "");
}
export function parseMoney(s: string) {
  const n = Number(digitsOnly(s));
  return n || null;
}
export const cleanPhone = (s: string) => digitsOnly(s).slice(0, 11);

export const waLink = (text: string, to = SITE.whatsapp) => `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
export const waTo = (egyptPhone: string, text: string) => waLink(text, "2" + egyptPhone);
