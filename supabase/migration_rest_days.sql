-- Амралтын өдөр (цаг биш) — хуучин багана хасах
-- Supabase SQL Editor дээр ажиллуулна

alter table public.employee_break_schedules drop column if exists start_time;
alter table public.employee_break_schedules drop column if exists end_time;

notify pgrst, 'reload schema';
