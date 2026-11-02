-- New lands take the smallest free GB-#### code (from GB-1001), so codes of deleted lands are reused.
create or replace function public.next_land_code() returns text
language sql volatile set search_path = '' as $$
  select 'GB-' || min(c.n)
  from (
    select 1001 as n
    union all
    select substring(code from 4)::int + 1 from public.lands where code ~ '^GB-[0-9]+$'
  ) c
  where c.n >= 1001 and not exists (select 1 from public.lands l where l.code = 'GB-' || c.n);
$$;
revoke execute on function public.next_land_code from public, anon, authenticated;

create or replace function public.submit_land(p jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_code text; v_phone text := trim(p->>'seller_phone'); v_try int := 0;
begin
  if (select count(*) from public.land_private lp join public.lands l on l.id = lp.land_id
      where lp.seller_phone = v_phone and l.created_at > now() - interval '1 day') >= 10 then
    raise exception 'too many submissions';
  end if;
  loop
    v_try := v_try + 1;
    begin
      insert into public.lands (code, tier, zone, hood, block, area, pos, dir, view, front_m, stage, legal, grace_months,
                                ownership, ownership_note, utilities, price, paid, description)
      values (public.next_land_code(), p->>'tier', p->>'zone', nullif(trim(p->>'hood'),''), nullif(trim(p->>'block'),''), (p->>'area')::numeric,
              nullif(p->>'pos',''), nullif(p->>'dir',''), nullif(p->>'view',''), nullif(p->>'front_m','')::numeric,
              nullif(p->>'stage',''), nullif(p->>'legal',''), nullif(p->>'grace_months','')::int,
              nullif(p->>'ownership',''),
              case when p->>'ownership' = 'حالة تفصيلية' then nullif(trim(p->>'ownership_note'),'') end,
              nullif(p->>'utilities',''), (p->>'price')::bigint,
              nullif(p->>'paid','')::bigint, nullif(trim(p->>'description'),''))
      returning id, code into v_id, v_code;
      exit;
    exception when unique_violation then
      -- two sellers grabbed the same free code at once; try the next one
      if v_try >= 5 then raise; end if;
    end;
  end loop;
  insert into public.land_private (land_id, seller_name, seller_phone, plot_no)
  values (v_id, trim(p->>'seller_name'), v_phone, nullif(trim(p->>'plot_no'),''));
  return v_code;
end $$;
