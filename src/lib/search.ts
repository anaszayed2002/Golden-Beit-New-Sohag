import type { SupabaseClient } from "@supabase/supabase-js";
import { LAND_COLUMNS, type Land } from "./types";
import type { Tier } from "./site";

export const PAGE_SIZE = 24;

export type FilterKey = "area" | "pos" | "dir" | "view" | "front" | "stage" | "legal" | "ownership" | "utilities";
export const FILTER_KEYS: FilterKey[] = ["area", "pos", "dir", "view", "front", "stage", "legal", "ownership", "utilities"];
export type Filters = Record<FilterKey, string[]>;
export type Sort = "new" | "price" | "area";
export type SearchQuery = { tier: Tier; zone: string; hood: string; budget: number | null; filters: Filters; sort: Sort };

export const emptyFilters = (): Filters => Object.fromEntries(FILTER_KEYS.map((k) => [k, []])) as unknown as Filters;

// One place builds the search so the list, the count and the server's first page always agree.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyFilters<Q>(q: Q, s: SearchQuery): Q {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let r = (q as any).eq("status", "approved").eq("tier", s.tier);
  if (s.zone) r = r.eq("zone", s.zone);
  if (s.hood) r = r.eq("hood", s.hood);
  if (s.budget) r = r.lte("price", s.budget);
  const f = s.filters;
  if (f.area.length) r = r.in("area", f.area.map(Number));
  for (const k of ["pos", "dir", "view", "stage", "legal", "ownership", "utilities"] as const) {
    if (f[k].length) r = r.in(k, f[k]);
  }
  // "15م+" style picks: the smallest chosen minimum is the effective one
  if (f.front.length) r = r.gte("front_m", Math.min(...f.front.map(Number)));
  return r;
}

export async function searchLands(sb: SupabaseClient, s: SearchQuery, page: number) {
  let q = applyFilters(sb.from("lands").select(LAND_COLUMNS, { count: "exact" }), s);
  if (s.sort === "price") q = q.order("price", { ascending: true });
  else if (s.sort === "area") q = q.order("area", { ascending: false });
  else q = q.order("approved_at", { ascending: false, nullsFirst: false });
  q = q.order("id");
  const from = page * PAGE_SIZE;
  const { data, count, error } = await q.range(from, from + PAGE_SIZE - 1);
  return { items: (data ?? []) as Land[], total: count ?? 0, error };
}

export async function countLands(sb: SupabaseClient, s: SearchQuery) {
  const { count } = await applyFilters(sb.from("lands").select("id", { count: "exact", head: true }), s);
  return count ?? 0;
}
