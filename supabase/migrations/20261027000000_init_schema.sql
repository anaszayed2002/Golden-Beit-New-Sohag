-- Golden Beit New Sohag: land offer platform
-- Applied to Supabase project lbbayvojqvaziproordg (golden-beit-new-sohag).

create table public.admin_phones (
  phone text primary key
);
insert into public.admin_phones (phone) values ('01040333703');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text not null unique,
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now()
);

create table public.neighborhoods (
  n int primary key,
  tier text not null check (tier in ('mt','mm')),
  label text,
  active boolean not null default true,
  sort int not null default 0
);
insert into public.neighborhoods (n, tier, label, sort) values
  (11,'mm','النخيل',1),(12,'mm','النخيل',2),(13,'mm',null,3),
  (22,'mt',null,10),(23,'mt',null,11),(24,'mt',null,12),(25,'mt',null,13),
  (45,'mt',null,14),(46,'mt',null,15);

create sequence public.listing_code_seq start 101;

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  tier text not null check (tier in ('mt','mm')),
  neighborhood int not null references public.neighborhoods(n),
  area int not null check (area between 50 and 5000),
  ask bigint not null check (ask > 0),
  paid bigint check (paid >= 0),
  features text[] not null default '{}',
  description text check (char_length(description) <= 1000),
  status text not null default 'pending' check (status in ('pending','approved','rejected','sold')),
  created_at timestamptz not null default now(),
  approved_at timestamptz
);
create index listings_status_idx on public.listings(status, tier);
create index listings_owner_idx on public.listings(owner_id);

-- seller contact details and plot number stay private
create table public.listing_private (
  listing_id uuid primary key references public.listings(id) on delete cascade,
  contact_phone text not null check (contact_phone ~ '^01[0125][0-9]{8}$'),
  plot_no text
);

create table public.plot_requests (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null default auth.uid(),
  name text not null check (char_length(name) between 2 and 80),
  phone text not null check (phone ~ '^01[0125][0-9]{8}$'),
  status text not null default 'new' check (status in ('new','contacted','done','cancelled')),
  created_at timestamptz not null default now()
);
create index plot_requests_listing_idx on public.plot_requests(listing_id);
create index plot_requests_user_idx on public.plot_requests(user_id);

-- helpers
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin');
$$;

create or replace function public.set_listing_code() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.code := 'GB-' || new.neighborhood || '-' || nextval('public.listing_code_seq');
  return new;
end $$;
create trigger listings_code before insert on public.listings
  for each row execute function public.set_listing_code();

create or replace function public.stamp_approval() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    new.approved_at := now();
  end if;
  return new;
end $$;
create trigger listings_approval before update on public.listings
  for each row execute function public.stamp_approval();

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare p text := coalesce(new.raw_user_meta_data->>'phone', '');
begin
  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    p,
    case when exists (select 1 from public.admin_phones a where a.phone = p) then 'admin' else 'user' end
  );
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- seller submits listing + private details in one call
create or replace function public.submit_listing(
  p_tier text, p_neighborhood int, p_area int, p_ask bigint, p_paid bigint,
  p_features text[], p_description text, p_contact_phone text, p_plot_no text
) returns text
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_code text;
begin
  if (select auth.uid()) is null then raise exception 'not signed in'; end if;
  insert into public.listings (owner_id, tier, neighborhood, area, ask, paid, features, description)
  values ((select auth.uid()), p_tier, p_neighborhood, p_area, p_ask, p_paid,
          coalesce(p_features, '{}'), nullif(trim(p_description), ''))
  returning id, code into v_id, v_code;
  insert into public.listing_private (listing_id, contact_phone, plot_no)
  values (v_id, p_contact_phone, nullif(trim(p_plot_no), ''));
  return v_code;
end $$;
revoke execute on function public.submit_listing from public, anon;
grant execute on function public.submit_listing to authenticated;

-- RLS
alter table public.admin_phones enable row level security;
alter table public.profiles enable row level security;
alter table public.neighborhoods enable row level security;
alter table public.listings enable row level security;
alter table public.listing_private enable row level security;
alter table public.plot_requests enable row level security;

create policy "admin reads admin phones" on public.admin_phones for select to authenticated using ((select public.is_admin()));

create policy "self or admin reads profile" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
create policy "self updates name" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()) and role = 'user');
create policy "admin updates profiles" on public.profiles for update to authenticated
  using ((select public.is_admin()));

create policy "anyone reads neighborhoods" on public.neighborhoods for select to anon, authenticated using (true);
create policy "admin manages neighborhoods" on public.neighborhoods for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "public reads approved listings" on public.listings for select to anon, authenticated
  using (status = 'approved' or owner_id = (select auth.uid()) or (select public.is_admin()));
create policy "admin updates listings" on public.listings for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin deletes listings" on public.listings for delete to authenticated
  using ((select public.is_admin()));

create policy "owner or admin reads private" on public.listing_private for select to authenticated
  using ((select public.is_admin()) or exists (
    select 1 from public.listings l where l.id = listing_id and l.owner_id = (select auth.uid())));

create policy "anyone requests approved plot" on public.plot_requests for insert to anon, authenticated
  with check (status = 'new'
    and (user_id is null or user_id = (select auth.uid()))
    and exists (select 1 from public.listings l where l.id = listing_id and l.status = 'approved'));
create policy "requester or admin reads requests" on public.plot_requests for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "admin updates requests" on public.plot_requests for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

revoke execute on function public.handle_new_user from public, anon, authenticated;
-- listings select policy for anon calls is_admin(); it simply returns false for anon
grant execute on function public.is_admin to anon, authenticated;
