import type { SupabaseClient } from "@supabase/supabase-js";
import { LAND_COLUMNS, type Land } from "./types";
import type { Tier } from "./site";

export const PAGE_SIZE = 24;

// Pick-one-or-more filters (chips). views matches a land that has any of the picked items.
export type FilterKey = "area" | "pos" | "views" | "legal" | "stage" | "build_reached" | "floors" | "basement" | "ownership";
export const FILTER_KEYS: FilterKey[] = ["area", "pos", "views", "legal", "stage", "build_reached", "floors", "basement", "ownership"];
export type Filters = Record<FilterKey, string[]>;
const ARRAY_KEYS = ["views"] as const;

// From / to filters on the numbers and dates a seller enters (dates as "YYYY-MM-DD")
export type RangeKey =
  | "price" | "paid" | "over_amount" | "inst_value" | "inst_left" | "transfer_fee"
  | "area" | "front_m" | "delivery_date" | "grace_until" | "inst_last";
export const RANGE_KEYS: RangeKey[] = ["price", "paid", "over_amount", "inst_value", "inst_left", "transfer_fee", "area", "front_m", "delivery_date", "grace_until", "inst_last"];
export type Range = { min: number | string | null; max: number | string | null };
export type Ranges = Record<RangeKey, Range>;

// Every sort works both ways: "<column>.asc" or "<column>.desc"
export type SortCol = "approved_at" | "price" | "area" | "front_m" | "paid" | "over_amount" | "inst_left" | "delivery_date" | "grace_until";
export type Sort = `${SortCol}.${"asc" | "desc"}`;
export const SORTS: [Sort, string][] = [
  ["approved_at.desc", "الأحدث"], ["approved_at.asc", "الأقدم"],
  ["price.asc", "السعر: الأقل الأول"], ["price.desc", "السعر: الأعلى الأول"],
  ["area.asc", "المساحة: الأصغر الأول"], ["area.desc", "المساحة: الأكبر الأول"],
  ["front_m.asc", "الواجهة: الأضيق الأول"], ["front_m.desc", "الواجهة: الأعرض الأول"],
  ["paid.asc", "المدفوع: الأقل الأول"], ["paid.desc", "المدفوع: الأعلى الأول"],
  ["over_amount.asc", "الأوفر: الأقل الأول"], ["over_amount.desc", "الأوفر: الأعلى الأول"],
  ["inst_left.asc", "الأقساط المتبقية: الأقل الأول"], ["inst_left.desc", "الأقساط المتبقية: الأكتر الأول"],
  ["delivery_date.asc", "الاستلام: الأقرب الأول"], ["delivery_date.desc", "الاستلام: الأبعد الأول"],
  ["grace_until.asc", "مهلة البناء: الأقرب الأول"], ["grace_until.desc", "مهلة البناء: الأبعد الأول"],
];

// tier "" = all units
export type SearchQuery = { tier: Tier | ""; zone: string; hood: string; filters: Filters; ranges: Ranges; sort: Sort };

export const emptyFilters = (): Filters => Object.fromEntries(FILTER_KEYS.map((k) => [k, []])) as unknown as Filters;
export const emptyRanges = (): Ranges => Object.fromEntries(RANGE_KEYS.map((k) => [k, { min: null, max: null }])) as unknown as Ranges;

// One place builds the search so the list, the count and the server's first page always agree.
function applyFilters<Q>(q: Q, s: SearchQuery): Q {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let r = (q as any).eq("status", "approved");
  if (s.tier) r = r.eq("tier", s.tier);
  if (s.zone) r = r.eq("zone", s.zone);
  if (s.hood) r = r.eq("hood", s.hood);
  const f = s.filters;
  if (f.area.length) r = r.in("area", f.area.map(Number));
  for (const k of ["pos", "legal", "stage", "build_reached", "floors", "ownership"] as const) {
    if (f[k].length) r = r.in(k, f[k]);
  }
  for (const k of ARRAY_KEYS) if (f[k].length) r = r.overlaps(k, f[k]);
  if (f.basement.length) r = r.eq("basement", true);
  for (const k of RANGE_KEYS) {
    const { min, max } = s.ranges[k];
    if (min != null && min !== "") r = r.gte(k, min);
    if (max != null && max !== "") r = r.lte(k, max);
  }
  return r;
}

export async function searchLands(sb: SupabaseClient, s: SearchQuery, page: number) {
  const [col, dir] = s.sort.split(".") as [SortCol, "asc" | "desc"];
  // Lands missing the sorted value go last either way.
  let q = applyFilters(sb.from("lands").select(LAND_COLUMNS, { count: "exact" }), s)
    .order(col, { ascending: dir === "asc", nullsFirst: false })
    .order("id");
  const from = page * PAGE_SIZE;
  q = q.range(from, from + PAGE_SIZE - 1);
  const { data, count, error } = await q;
  return { items: (data ?? []) as Land[], total: count ?? 0, error };
}

export async function countLands(sb: SupabaseClient, s: SearchQuery) {
  const { count } = await applyFilters(sb.from("lands").select("id", { count: "exact", head: true }), s);
  return count ?? 0;
}
