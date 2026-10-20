-- Гүйцэтгэл — харилцагчийн төрөл (Өрх / Байгууллага), байгууллагын ангилал, гэмтлийн дэд төрөл.
--   customer_type: 'household' (Өрх, анхдагч) | 'org' (Байгууллага)
--   org_kind     : Сургууль, Зочид буудал … (perf_settings.org_options — админ нэмнэ)
--   damage_kind  : Өрх → Гэмтэл (kind='damage') үед — Шилэн кабель шилжүүлэг / Шилэн кабель сольсон

alter table public.perf_jobs add column if not exists customer_type text not null default 'household' check (customer_type in ('household', 'org'));
alter table public.perf_jobs add column if not exists org_kind text;
alter table public.perf_jobs add column if not exists damage_kind text;

alter table public.perf_settings add column if not exists org_options text[] not null default array['Сургууль', 'Зочид буудал'];

-- Гэмтэл — үнэлгээг sanhuu → Гүйцэтгэл дээр тохируулна.
insert into public.perf_rates (kind, label, amount) values ('damage', 'Гэмтэл', 0) on conflict (kind) do nothing;

notify pgrst, 'reload schema';
