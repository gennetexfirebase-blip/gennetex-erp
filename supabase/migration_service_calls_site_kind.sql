-- Дуудлагыг Айл / Байгууллага гэж ангилна
-- Supabase → SQL Editor дээр Run хийнэ.

alter table public.service_calls
  add column if not exists site_kind text not null default 'ail';

-- ail = айл, baiguulga = байгууллага
alter table public.service_calls
  drop constraint if exists service_calls_site_kind_check;

alter table public.service_calls
  add constraint service_calls_site_kind_check
  check (site_kind in ('ail', 'baiguulga'));

create index if not exists service_calls_site_kind_idx
  on public.service_calls (site_kind, created_at desc);

notify pgrst, 'reload schema';
