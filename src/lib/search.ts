import type { SupabaseClient } from "@supabase/supabase-js";
import { LAND_COLUMNS, type Land } from "./types";
import type { Tier } from "./site";

export const PAGE_SIZE = 24;

// Pick-one-or-more filters (chips)
export type FilterKey = "area" | "pos" | "dir" | "view" | "stage" | "legal" | "ownership" | "utilities";
export const FILTER_KEYS: FilterKey[] = ["area", "pos", "dir", "view", "stage", "legal", "ownership", "utilities"];
export type Filters = Record<FilterKey, string[]>;

// From / to filters on the numbers a seller enters
export type RangeKey = "price" | "area" | "front_m" | "paid" | "grace_months";
export const RANGE_KEYS: RangeKey[] = ["price", "area", "front_m", "paid", "grace_months"];
export type Range = { min: number | null; max: number | null };
export type Ranges = Record<RangeKey, Range>;

// Every sort works both ways: "<column>.asc" or "<column>.desc"
export type SortCol = "approved_at" | "price" | "area" | "front_m" | "paid" | "grace_months";
export type Sort = `${SortCol}.${"asc" | "desc"}`;
export const SORTS: [Sort, string][] = [
  ["approved_at.desc", "الأحدث"], ["approved_at.asc", "الأقدم"],
  ["price.asc", "السعر: الأقل الأول"], ["price.desc", "السعر: الأعلى الأول"],
  ["area.asc", "المساحة: الأصغر الأول"], ["area.desc", "المساحة: الأكبر الأول"],
  ["front_m.asc", "الواجهة: الأضيق الأول"], ["front_m.desc", "الواجهة: الأعرض الأول"],
  ["paid.asc", "المدفوع: الأقل الأول"], ["paid.desc", "المدفوع: الأعلى الأول"],
  ["grace_months.asc", "مهلة البناء: الأقل الأول"], ["grace_months.desc", "مهلة البناء: الأطول الأول"],
];

export type SearchQuery = { tier: Tier; zone: string; hood: string; block: string; filters: Filters; ranges: Ranges; sort: Sort };

export const emptyFilters = (): Filters => Object.fromEntries(FILTER_KEYS.map((k) => [k, []])) as unknown as Filters;
export const emptyRanges = (): Ranges => Object.fromEntries(RANGE_KEYS.map((k) => [k, { min: null, max: null }])) as unknown as Ranges;

// One place builds the search so the list, the count and the server's first page always agree.
function applyFilters<Q>(q: Q, s: SearchQuery): Q {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let r = (q as any).eq("status", "approved").eq("tier", s.tier);
  if (s.zone) r = r.eq("zone", s.zone);
  if (s.hood) r = r.eq("hood", s.hood);
  if (s.block.trim()) r = r.eq("block", s.block.trim());
  const f = s.filters;
  if (f.area.length) r = r.in("area", f.area.map(Number));
  for (const k of ["pos", "dir", "view", "stage", "legal", "ownership", "utilities"] as const) {
    if (f[k].length) r = r.in(k, f[k]);
  }
  for (const k of RANGE_KEYS) {
    const { min, max } = s.ranges[k];
    if (min != null) r = r.gte(k, min);
    if (max != null) r = r.lte(k, max);
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
