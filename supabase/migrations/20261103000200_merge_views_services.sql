-- "التميز الجغرافي والإطلالة" is one list now: services fold into views, and كنيسة is dropped.
update public.lands
set views = coalesce(array(select distinct x from unnest(views || services) x where x <> 'كنيسة' order by x), '{}'),
    services = '{}'
where cardinality(services) > 0 or 'كنيسة' = any(views);
