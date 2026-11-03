-- «العرض كبطاقة»: the plot number is now public on the card, and the seller can upload a map image with an arrow on the plot.
-- Also: premium (مميز) lands can't be 276 m².

alter table public.lands
  add column plot_no text check (char_length(plot_no) <= 10),
  add column map_path text check (map_path ~ '^m/[0-9a-f-]{36}\.jpg$');

update public.lands l set plot_no = lp.plot_no from public.land_private lp where lp.land_id = l.id and lp.plot_no is not null;
alter table public.land_private drop column plot_no;

-- Public bucket for the map images: images only, 3 MB each. Visitors can only add files under m/.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('land-maps', 'land-maps', true, 3145728, array['image/jpeg'])
on conflict (id) do update set public = true, file_size_limit = 3145728, allowed_mime_types = array['image/jpeg'];

create policy "anyone uploads a land map" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'land-maps' and name ~ '^m/[0-9a-f-]{36}\.jpg$');
create policy "admin removes land maps" on storage.objects for delete to authenticated
  using (bucket_id = 'land-maps' and (select public.is_admin()));

create or replace function public.submit_land(p jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid; v_code text; v_phone text := trim(p->>'seller_phone'); v_try int := 0;
  v_hood text := trim(p->>'hood'); v_zone text; v_tier text;
  v_legal text := nullif(p->>'legal',''); v_stage text := nullif(p->>'stage','');
  v_inst boolean := coalesce((p->>'has_inst')::boolean, false);
  v_area numeric := (p->>'area')::numeric;
  v_map text := nullif(p->>'map_path','');
begin
  if (select count(*) from public.land_private lp join public.lands l on l.id = lp.land_id
      where lp.seller_phone = v_phone and l.created_at > now() - interval '1 day') >= 10 then
    raise exception 'too many submissions';
  end if;
  v_zone := public.hood_zone(v_hood);
  if v_zone is null then raise exception 'unknown neighborhood'; end if;
  v_tier := case when v_zone in ('z455','z214','ztm') then 'mm' else 'mt' end;
  if v_tier = 'mm' and floor(v_area) = 276 then raise exception 'premium 276'; end if;
  if v_legal is distinct from 'مستلمة' then v_stage := null; end if;
  -- the image must already be in the bucket
  if v_map is not null and not exists (select 1 from storage.objects where bucket_id = 'land-maps' and name = v_map) then
    v_map := null;
  end if;

  loop
    v_try := v_try + 1;
    begin
      insert into public.lands (code, tier, zone, hood, plot_no, map_path, area, pos, front_m, views, services,
        legal, delivery_date, stage, grace_until, build_reached, floors, basement,
        ownership, ownership_note, price, paid, over_amount,
        inst_value, inst_count, inst_left, inst_first, inst_last, transfer_fee, pay_other)
      values (public.next_land_code(), v_tier, v_zone, case when v_zone = 'zahy' then null else v_hood end,
        nullif(trim(p->>'plot_no'),''), v_map,
        v_area, nullif(p->>'pos',''), nullif(p->>'front_m','')::numeric,
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
  insert into public.land_private (land_id, seller_name, seller_phone)
  values (v_id, trim(p->>'seller_name'), v_phone);
  return v_code;
end $$;
