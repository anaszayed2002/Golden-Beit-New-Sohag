import type { Tier, ZoneId } from "./site";

export type LandStatus = "pending" | "approved" | "rejected" | "sold";

export const STATUS_NAME: Record<LandStatus, string> = {
  pending: "في المراجعة",
  approved: "معروضة",
  rejected: "مرفوضة",
  sold: "اتباعت",
};

export type Land = {
  id: string;
  code: string;
  tier: Tier;
  zone: ZoneId;
  hood: string | null;
  area: number;
  pos: string | null;
  front_m: number | null;
  views: string[];
  services: string[];
  legal: string | null;
  delivery_date: string | null;
  stage: string | null;
  grace_until: string | null;
  build_reached: string | null;
  floors: string | null;
  basement: boolean | null;
  ownership: string | null;
  ownership_note: string | null;
  price: number;
  paid: number | null;
  over_amount: number | null;
  inst_value: number | null;
  inst_count: number | null;
  inst_left: number | null;
  inst_first: string | null;
  inst_last: string | null;
  transfer_fee: number | null;
  pay_other: string | null;
  // fields from earlier forms, still shown when an old listing has them
  block: string | null;
  dir: string | null;
  utilities: string | null;
  grace_months: number | null;
  description: string | null;
  status: LandStatus;
  created_at: string;
  approved_at: string | null;
};

export const LAND_COLUMNS =
  "id,code,tier,zone,hood,area,pos,front_m,views,services,legal,delivery_date,stage,grace_until,build_reached,floors,basement,ownership,ownership_note,price,paid,over_amount,inst_value,inst_count,inst_left,inst_first,inst_last,transfer_fee,pay_other,block,dir,utilities,grace_months,description,status,created_at,approved_at";

// Payment figures, exactly as agreed with the client
export const dueNow = (l: Pick<Land, "paid" | "over_amount">) => (l.paid ?? 0) + (l.over_amount ?? 0); // المدفوع + الأوفر
export const remaining = (l: Pick<Land, "price" | "paid" | "over_amount">) => l.price - dueNow(l); // السعر الكلي − المطلوب دفعه
export const instTotal = (l: Pick<Land, "inst_value" | "inst_count">) => (l.inst_value ?? 0) * (l.inst_count ?? 0); // القسط × العدد
export const instLeftTotal = (l: Pick<Land, "inst_value" | "inst_left">) => (l.inst_value ?? 0) * (l.inst_left ?? 0); // القسط × المتبقي

export type Profile = { id: string; full_name: string; phone: string; role: "user" | "admin"; created_at?: string };
