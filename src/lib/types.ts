import type { Tier } from "./site";

export type ListingStatus = "pending" | "approved" | "rejected" | "sold";

export const STATUS_NAME: Record<ListingStatus, string> = {
  pending: "في المراجعة",
  approved: "معروضة",
  rejected: "مرفوضة",
  sold: "اتباعت",
};

export type Listing = {
  id: string;
  code: string;
  tier: Tier;
  neighborhood: number;
  area: number;
  ask: number;
  paid: number | null;
  features: string[];
  description: string | null;
  status: ListingStatus;
  created_at: string;
  approved_at: string | null;
};

export type Neighborhood = { n: number; tier: Tier; label: string | null };

export type Profile = { id: string; full_name: string; phone: string; role: "user" | "admin"; created_at?: string };

export const LISTING_COLUMNS = "id,code,tier,neighborhood,area,ask,paid,features,description,status,created_at,approved_at";
