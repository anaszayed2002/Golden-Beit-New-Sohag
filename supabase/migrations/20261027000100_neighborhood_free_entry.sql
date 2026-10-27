-- sellers type the neighborhood number themselves instead of picking from a list
alter table public.listings drop constraint listings_neighborhood_fkey;
alter table public.listings add constraint listings_neighborhood_range check (neighborhood between 1 and 999);
