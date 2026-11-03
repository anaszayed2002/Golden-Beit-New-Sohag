-- area list for the filter when no tier is picked (null = all)
create or replace function public.land_areas(p_tier text) returns setof numeric
language sql stable set search_path = '' as $$
  select distinct area from public.lands where status = 'approved' and (p_tier is null or tier = p_tier) order by 1;
$$;
