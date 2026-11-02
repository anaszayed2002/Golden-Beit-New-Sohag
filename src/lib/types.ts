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
  block: string | null;
  area: number;
  pos: string | null;
  dir: string | null;
  view: string | null;
  front_m: number | null;
  stage: string | null;
  legal: string | null;
  grace_months: number | null;
  ownership: string | null;
  ownership_note: string | null;
  utilities: string | null;
  price: number;
  paid: number | null;
  description: string | null;
  status: LandStatus;
  created_at: string;
  approved_at: string | null;
};

export const LAND_COLUMNS =
  "id,code,tier,zone,hood,block,area,pos,dir,view,front_m,stage,legal,grace_months,ownership,ownership_note,utilities,price,paid,description,status,created_at,approved_at";

export type Profile = { id: string; full_name: string; phone: string; role: "user" | "admin"; created_at?: string };
