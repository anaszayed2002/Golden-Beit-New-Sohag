export const SITE = {
  name: "Golden Beit New Sohag",
  phone: "01040333703",
  whatsapp: "201040333703",
  email: "info@goldenbeit.com",
  facebook: process.env.NEXT_PUBLIC_FACEBOOK_URL || "",
};

export type Tier = "mt" | "mm";
export const TIERS: Tier[] = ["mt", "mm"];
export const AREAS: Record<Tier, number[]> = { mt: [209, 276], mm: [500, 600] };
export const JEDIA: Record<Tier, number> = { mt: 25000, mm: 100000 };
export const tierName = (t: Tier) => (t === "mm" ? "متميز" : "متوسط");

export const FEATURES = ["ناصية", "على حديقة", "بحري", "على شارع 20 م", "قريبة من المدرسة", "واجهة عريضة"];

export const PHONE_RE = /^01[0125][0-9]{8}$/;
// Accounts are phone + password; Supabase Auth needs an email, so each phone maps to a fixed synthetic one.
export const phoneEmail = (phone: string) => `${phone}@users.goldenbeit.com`;

export function fmtShort(v: number) {
  if (v >= 1_000_000) return (Math.round(v / 10_000) / 100).toLocaleString("en") + " مليون";
  return Math.round(v / 1000).toLocaleString("en") + " ألف";
}
export const fmtFull = (v: number) => Math.round(v).toLocaleString("en") + " ج";

export function parseMoney(s: string) {
  const n = Number(String(s).replace(/[^\d]/g, ""));
  return n || null;
}

// Arabic-Indic digits typed on phones become Latin digits
export function normalizeDigits(s: string) {
  return s.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
}

export const waLink = (text: string, to = SITE.whatsapp) => `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
export const waTo = (egyptPhone: string, text: string) => waLink(text, "2" + egyptPhone);
