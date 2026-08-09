-- Дуудлага илгээсэн админ ажилтны нэр

alter table public.service_calls
  add column if not exists created_by_name text;

notify pgrst, 'reload schema';
