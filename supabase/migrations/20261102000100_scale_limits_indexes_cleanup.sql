-- Scale to thousands of lands: search indexes, per-phone limits on public forms, area list, drop legacy tables.

-- search indexes (public search always filters on status + tier)
create index if not exists lands_search_zone_idx on public.lands(status, tier, zone, hood);
create index if not exists lands_search_price_idx on public.lands(status, tier, price);
create index if not exists lands_search_area_idx on public.lands(status, tier, area);
create index if not exists lands_search_new_idx on public.lands(status, tier, approved_at desc);
create index if not exists lands_created_idx on public.lands(status, created_at desc);
create index if not exists purchase_requests_created_idx on public.purchase_requests(status, created_at desc);
create index if not exists purchase_requests_phone_idx on public.purchase_requests(phone, created_at);
create index if not exists land_alerts_created_idx on public.land_alerts(status, created_at desc);
create index if not exists land_alerts_phone_idx on public.land_alerts(phone, created_at);
create index if not exists land_private_created_phone_idx on public.land_private(seller_phone);

-- sell form: 10 per phone per day
create or replace function public.submit_land(p jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_code text; v_phone text := trim(p->>'seller_phone');
begin
  if (select count(*) from public.land_private lp join public.lands l on l.id = lp.land_id
      where lp.seller_phone = v_phone and l.created_at > now() - interval '1 day') >= 10 then
    raise exception 'too many submissions';
  end if;
  insert into public.lands (tier, zone, hood, block, area, pos, dir, view, front_m, stage, legal, grace_months,
                            ownership, utilities, price, paid, description)
  values (p->>'tier', p->>'zone', nullif(trim(p->>'hood'),''), nullif(trim(p->>'block'),''), (p->>'area')::int,
          nullif(p->>'pos',''), nullif(p->>'dir',''), nullif(p->>'view',''), nullif(p->>'front_m','')::int,
          nullif(p->>'stage',''), nullif(p->>'legal',''), nullif(p->>'grace_months','')::int,
          nullif(p->>'ownership',''), nullif(p->>'utilities',''), (p->>'price')::bigint,
          nullif(p->>'paid','')::bigint, nullif(trim(p->>'description'),''))
  returning id, code into v_id, v_code;
  insert into public.land_private (land_id, seller_name, seller_phone, plot_no)
  values (v_id, trim(p->>'seller_name'), v_phone, nullif(trim(p->>'plot_no'),''));
  return v_code;
end $$;

-- purchase requests: one per phone per land, 10 per phone per day
create unique index if not exists purchase_requests_one_per_land on public.purchase_requests(land_id, phone);
create or replace function public.limit_purchase_requests() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.purchase_requests where phone = new.phone and created_at > now() - interval '1 day') >= 10 then
    raise exception 'too many requests';
  end if;
  return new;
end $$;
create trigger purchase_requests_limit before insert on public.purchase_requests
  for each row execute function public.limit_purchase_requests();

-- alerts: 3 per phone per day
create or replace function public.limit_land_alerts() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.land_alerts where phone = new.phone and created_at > now() - interval '1 day') >= 3 then
    raise exception 'too many alerts';
  end if;
  return new;
end $$;
create trigger land_alerts_limit before insert on public.land_alerts
  for each row execute function public.limit_land_alerts();
revoke execute on function public.limit_purchase_requests from public, anon, authenticated;
revoke execute on function public.limit_land_alerts from public, anon, authenticated;

-- distinct areas of approved lands, for the area filter (runs with the caller's RLS)
create or replace function public.land_areas(p_tier text) returns setof int
language sql stable set search_path = '' as $$
  select distinct area from public.lands where status = 'approved' and tier = p_tier order by 1;
$$;
grant execute on function public.land_areas to anon, authenticated;

-- legacy tables: data was copied into lands / land_private / purchase_requests (verified 1:1)
drop table public.legacy_plot_requests;
drop table public.legacy_listing_private;
drop table public.legacy_listings;
drop table public.legacy_neighborhoods;
drop sequence if exists public.listing_code_seq;
drop function if exists public.set_listing_code();
