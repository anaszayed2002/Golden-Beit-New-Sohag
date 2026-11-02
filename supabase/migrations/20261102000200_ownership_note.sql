-- free-text explanation when ownership is "حالة تفصيلية"
alter table public.lands add column ownership_note text check (char_length(ownership_note) <= 500);

create or replace function public.submit_land(p jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_code text; v_phone text := trim(p->>'seller_phone');
begin
  if (select count(*) from public.land_private lp join public.lands l on l.id = lp.land_id
      where lp.seller_phone = v_phone and l.created_at > now() - interval '1 day') >= 10 then
    raise exception 'too many submissions';
  end if;
  insert into public.lands (tier, zone, hood, block, area, pos, dir, view, front_m, stage, legal, grace_months,
                            ownership, ownership_note, utilities, price, paid, description)
  values (p->>'tier', p->>'zone', nullif(trim(p->>'hood'),''), nullif(trim(p->>'block'),''), (p->>'area')::int,
          nullif(p->>'pos',''), nullif(p->>'dir',''), nullif(p->>'view',''), nullif(p->>'front_m','')::int,
          nullif(p->>'stage',''), nullif(p->>'legal',''), nullif(p->>'grace_months','')::int,
          nullif(p->>'ownership',''),
          case when p->>'ownership' = 'حالة تفصيلية' then nullif(trim(p->>'ownership_note'),'') end,
          nullif(p->>'utilities',''), (p->>'price')::bigint,
          nullif(p->>'paid','')::bigint, nullif(trim(p->>'description'),''))
  returning id, code into v_id, v_code;
  insert into public.land_private (land_id, seller_name, seller_phone, plot_no)
  values (v_id, trim(p->>'seller_name'), v_phone, nullif(trim(p->>'plot_no'),''));
  return v_code;
end $$;
