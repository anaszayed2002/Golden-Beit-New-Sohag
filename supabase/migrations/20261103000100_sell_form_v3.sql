-- v3 sell form: neighborhood decides area + class, views/services lists, status details, payment plan.

alter table public.lands drop constraint lands_legal_check;
update public.lands set legal = 'غير مستلمة' where legal = 'لم تستلم';
alter table public.lands add constraint lands_legal_check check (legal in ('مستلمة','غير مستلمة'));

alter table public.lands
  add column views text[] not null default '{}',
  add column services text[] not null default '{}',
  add column delivery_date date,
  add column grace_until date,
  add column build_reached text check (build_reached in ('أساسات فقط','أرضي','أول','ثاني','ثالث','رابع')),
  add column floors text check (floors in ('أرضي','أرضي + 1','أرضي + 2','أرضي + 3','أرضي + 4','أرضي + 5')),
  add column basement boolean,
  add column over_amount bigint check (over_amount >= 0),
  add column inst_value bigint check (inst_value >= 0),
  add column inst_count int check (inst_count between 0 and 600),
  add column inst_left int check (inst_left between 0 and 600),
  add column inst_first date,
  add column inst_last date,
  add column transfer_fee bigint check (transfer_fee >= 0),
  add column pay_other text check (char_length(pay_other) <= 500);

-- carry the old single view into the list
update public.lands set views = array[view] where view is not null and view <> 'داخلي';

create index if not exists lands_views_idx on public.lands using gin (views);
create index if not exists lands_services_idx on public.lands using gin (services);

-- 3–10 → 455 فدان, الشمالية/الجنوبية → 214 فدان, 11–17 & 37–40 → التوسعات (مميز), 18–49 others → 735 فدان (متوسط), الأحياء → الأحياء
create or replace function public.hood_zone(p_hood text) returns text
language sql immutable set search_path = '' as $$
  select case
    when p_hood in ('الشمالية','الجنوبية') then 'z214'
    when p_hood = 'الأحياء' then 'zahy'
    when p_hood ~ '^[0-9]+$' and p_hood::int between 3 and 10 then 'z455'
    when p_hood ~ '^[0-9]+$' and (p_hood::int between 11 and 17 or p_hood::int between 37 and 40) then 'ztm'
    when p_hood ~ '^[0-9]+$' and p_hood::int between 18 and 49 then 'z735'
  end;
$$;

create or replace function public.submit_land(p jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid; v_code text; v_phone text := trim(p->>'seller_phone'); v_try int := 0;
  v_hood text := trim(p->>'hood'); v_zone text; v_tier text;
  v_legal text := nullif(p->>'legal',''); v_stage text := nullif(p->>'stage','');
  v_inst boolean := coalesce((p->>'has_inst')::boolean, false);
begin
  if (select count(*) from public.land_private lp join public.lands l on l.id = lp.land_id
      where lp.seller_phone = v_phone and l.created_at > now() - interval '1 day') >= 10 then
    raise exception 'too many submissions';
  end if;
  v_zone := public.hood_zone(v_hood);
  if v_zone is null then raise exception 'unknown neighborhood'; end if;
  v_tier := case when v_zone in ('z455','z214','ztm') then 'mm' else 'mt' end;
  if v_legal is distinct from 'مستلمة' then v_stage := null; end if;

  loop
    v_try := v_try + 1;
    begin
      insert into public.lands (code, tier, zone, hood, area, pos, front_m, views, services,
        legal, delivery_date, stage, grace_until, build_reached, floors, basement,
        ownership, ownership_note, price, paid, over_amount,
        inst_value, inst_count, inst_left, inst_first, inst_last, transfer_fee, pay_other)
      values (public.next_land_code(), v_tier, v_zone, case when v_zone = 'zahy' then null else v_hood end,
        (p->>'area')::numeric, nullif(p->>'pos',''), nullif(p->>'front_m','')::numeric,
        coalesce(array(select jsonb_array_elements_text(p->'views')), '{}'),
        coalesce(array(select jsonb_array_elements_text(p->'services')), '{}'),
        v_legal,
        case when v_legal = 'غير مستلمة' then nullif(p->>'delivery_date','')::date end,
        v_stage,
        case when v_stage in ('أرض فضاء','ذات رخصة') then nullif(p->>'grace_until','')::date end,
        case when v_stage = 'قيد البناء' then nullif(p->>'build_reached','') end,
        case when v_stage in ('مبنى','مبنى متشطب') then nullif(p->>'floors','') end,
        case when v_stage in ('قيد البناء','مبنى','مبنى متشطب') then coalesce((p->>'basement')::boolean, false) end,
        nullif(p->>'ownership',''),
        case when p->>'ownership' = 'حالة تفصيلية' then nullif(trim(p->>'ownership_note'),'') end,
        (p->>'price')::bigint, nullif(p->>'paid','')::bigint, nullif(p->>'over_amount','')::bigint,
        case when v_inst then nullif(p->>'inst_value','')::bigint end,
        case when v_inst then nullif(p->>'inst_count','')::int end,
        case when v_inst then nullif(p->>'inst_left','')::int end,
        case when v_inst then nullif(p->>'inst_first','')::date end,
        case when v_inst then nullif(p->>'inst_last','')::date end,
        nullif(p->>'transfer_fee','')::bigint, nullif(trim(p->>'pay_other'),''))
      returning id, code into v_id, v_code;
      exit;
    exception when unique_violation then
      if v_try >= 5 then raise; end if;
    end;
  end loop;
  insert into public.land_private (land_id, seller_name, seller_phone, plot_no)
  values (v_id, trim(p->>'seller_name'), v_phone, nullif(trim(p->>'plot_no'),''));
  return v_code;
end $$;
