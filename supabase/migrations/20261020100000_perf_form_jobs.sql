-- Гүйцэтгэл — админ guitsetgel.gennetex.com-ийн формоор ажил гараар бүртгэнэ.
--   source = 'sheet' (Google Sheet, perf-sync бүтнээр нь солино) | 'form' (гараар — устахгүй)
--   note   — гомдлын агуулга / тайлбар

alter table public.perf_jobs add column if not exists source text not null default 'sheet' check (source in ('sheet', 'form'));
alter table public.perf_jobs add column if not exists note text;
alter table public.perf_jobs add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.perf_jobs add column if not exists created_by_name text;
alter table public.perf_jobs alter column sheet_row drop not null;
create index if not exists perf_jobs_source_idx on public.perf_jobs (source, work_date);

notify pgrst, 'reload schema';

-- Хийсэн ажил (checkbox-ууд) ба хэний эхээр (ахалж) явсан.
alter table public.perf_jobs add column if not exists tasks text[] not null default '{}';
alter table public.perf_jobs add column if not exists lead text;

notify pgrst, 'reload schema';

-- «Хийсэн ажил» сонголтын жагсаалт — админ нэмж, дарааллыг сольж болно.
alter table public.perf_settings add column if not exists task_options text[] not null default array[
  'Коннектор сольсон', 'Кабель сольсон', 'Роутер / ONU тохируулсан', 'Төхөөрөмж сольсон',
  'Бокс суурилуулсан', 'Сигнал хэмжсэн', 'Дотор утас засварласан', 'Хэрэглэгчид зааварчилгаа өгсөн'
];

notify pgrst, 'reload schema';

-- Sheet-ийн мөрийг guitsetgel-ээс засах: засвар нь source=form мөр болж, эх мөрийн түлхүүрийг
-- (огноо|төрөл|инженерүүд|цаг) sheet_key-д хадгална. perf-sync тэр түлхүүртэй мөрийг дахин оруулахгүй.
alter table public.perf_jobs add column if not exists sheet_key text;
create index if not exists perf_jobs_sheet_key_idx on public.perf_jobs (sheet_key) where sheet_key is not null;

notify pgrst, 'reload schema';
