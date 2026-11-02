-- v2: full land card, no customer accounts. Sellers and buyers leave name + phone only.
-- Applied to project lbbayvojqvaziproordg as migration "lands_v2_no_public_accounts".
-- Old tables are kept as legacy_* (data copied over), not dropped.

alter table public.plot_requests rename to legacy_plot_requests;
alter table public.listing_private rename to legacy_listing_private;
alter table public.listings rename to legacy_listings;
alter table public.neighborhoods rename to legacy_neighborhoods;
drop function if exists public.submit_listing(text,int,int,bigint,bigint,text[],text,text,text);

create sequence public.land_code_seq start 1001;

create table public.lands (
  id uuid primary key default gen_random_uuid(),
  code text unique not null default ('GB-' || nextval('public.land_code_seq')),
  tier text not null check (tier in ('mt','mm')),
  zone text not null check (zone in ('z455','z214','ztm','z735','zahy')),
  hood text check (char_length(hood) <= 40),
  block text check (char_length(block) <= 12),
  area int not null check (area between 50 and 5000),
  pos text check (pos in ('واجهة واحدة','ناصية','دبل فيس','تربل فيس')),
  dir text check (dir in ('بحري','قبلي','شرقي','غربي')),
  view text check (view in ('حديقة','خدمات','شارع رئيسي','داخلي')),
  front_m int check (front_m between 3 and 100),
  stage text check (stage in ('أرض فضاء','ذات رخصة','قيد البناء','مبنى','مبنى متشطب')),
  legal text check (legal in ('لم تستلم','مستلمة')),
  grace_months int check (grace_months between 0 and 120),
  ownership text check (ownership in ('مالك أصيل','توكيل واحد','توكيلين','أكثر من توكيلين','حالة تفصيلية')),
  utilities text check (utilities in ('غير مرفقة','قيد الترفيق (أولية)','قيد الانتهاء من الترفيق','مرفقة')),
  price bigint not null check (price > 0),
  paid bigint check (paid >= 0),
  description text check (char_length(description) <= 1000),
  status text not null default 'pending' check (status in ('pending','approved','rejected','sold')),
  created_at timestamptz not null default now(),
  approved_at timestamptz
);
create index lands_public_idx on public.lands(status, tier, zone);

-- seller name, phone and plot number: admin only
create table public.land_private (
  land_id uuid primary key references public.lands(id) on delete cascade,
  seller_name text not null check (char_length(seller_name) between 2 and 80),
  seller_phone text not null check (seller_phone ~ '^01[0125][0-9]{8}$'),
  plot_no text check (char_length(plot_no) <= 20)
);
create index land_private_phone_idx on public.land_private(seller_phone);

create table public.purchase_requests (
  id uuid primary key default gen_random_uuid(),
  land_id uuid not null references public.lands(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  phone text not null check (phone ~ '^01[0125][0-9]{8}$'),
  status text not null default 'new' check (status in ('new','contacted','done','cancelled')),
  created_at timestamptz not null default now()
);
create index purchase_requests_land_idx on public.purchase_requests(land_id);

-- "notify me" searches from buyers who did not find a match
create table public.land_alerts (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  phone text not null check (phone ~ '^01[0125][0-9]{8}$'),
  criteria jsonb not null default '{}',
  status text not null default 'new' check (status in ('new','contacted','done')),
  created_at timestamptz not null default now()
);

create trigger lands_approval before update on public.lands
  for each row execute function public.stamp_approval();

-- carry over the existing listing and its request
insert into public.lands (id, code, tier, zone, hood, area, price, paid, description, status, created_at, approved_at)
select l.id, l.code, l.tier, 'z735', l.neighborhood::text, l.area, l.ask, l.paid, l.description, l.status, l.created_at, l.approved_at
from public.legacy_listings l;
insert into public.land_private (land_id, seller_name, seller_phone, plot_no)
select l.id, coalesce(nullif(p.full_name,''),'بائع'), lp.contact_phone, lp.plot_no
from public.legacy_listings l join public.legacy_listing_private lp on lp.listing_id = l.id left join public.profiles p on p.id = l.owner_id;
insert into public.purchase_requests (land_id, name, phone, status, created_at)
select r.listing_id, r.name, r.phone, r.status, r.created_at from public.legacy_plot_requests r;

-- seller submits without an account; max 5 per phone per day
create or replace function public.submit_land(p jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_code text; v_phone text := trim(p->>'seller_phone');
begin
  if (select count(*) from public.land_private lp join public.lands l on l.id = lp.land_id
      where lp.seller_phone = v_phone and l.created_at > now() - interval '1 day') >= 5 then
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
revoke execute on function public.submit_land from public;
grant execute on function public.submit_land to anon, authenticated;

alter table public.lands enable row level security;
alter table public.land_private enable row level security;
alter table public.purchase_requests enable row level security;
alter table public.land_alerts enable row level security;

create policy "public reads approved lands" on public.lands for select to anon, authenticated
  using (status = 'approved' or (select public.is_admin()));
create policy "admin updates lands" on public.lands for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin deletes lands" on public.lands for delete to authenticated
  using ((select public.is_admin()));

create policy "admin reads seller details" on public.land_private for select to authenticated
  using ((select public.is_admin()));

create policy "anyone requests an approved land" on public.purchase_requests for insert to anon, authenticated
  with check (status = 'new' and exists (select 1 from public.lands l where l.id = land_id and l.status = 'approved'));
create policy "admin reads requests" on public.purchase_requests for select to authenticated using ((select public.is_admin()));
create policy "admin updates requests" on public.purchase_requests for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "anyone saves an alert" on public.land_alerts for insert to anon, authenticated with check (status = 'new');
create policy "admin reads alerts" on public.land_alerts for select to authenticated using ((select public.is_admin()));
create policy "admin updates alerts" on public.land_alerts for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
