-- Цагийн тайлан: ажилтан бүрийг системд бүртгэгдсэн (эсвэл компани ирц
-- бүртгэж эхэлсэн) өдрөөс нь тоолно. Эс бөгөөс жилээр харахад систем
-- ашиглаж эхлэхээс өмнөх сарууд бүхэлдээ «тасалсан» гэж гарч байв.
create or replace function public.time_report_since(p_created timestamptz)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(
    coalesce((p_created at time zone 'Asia/Ulaanbaatar')::date, '2000-01-01'::date),
    coalesce((select (min(a.created_at) at time zone 'Asia/Ulaanbaatar')::date from public.attendance a), '2000-01-01'::date)
  );
$$;
revoke all on function public.time_report_since(timestamptz) from public, anon, authenticated;

do $$
declare
  def text;
begin
  def := pg_get_functiondef('public.time_report_data(date,date,text)'::regprocedure);
  def := replace(def, $q$'role', e.role, 'avatar_url'$q$, $q$'role', e.role, 'since', public.time_report_since(e.created_at), 'avatar_url'$q$);
  def := replace(def, $q$select p.id, p.name, p.last_name, p.email, p.position, p.role,$q$, $q$select p.id, p.name, p.last_name, p.email, p.position, p.role, p.created_at,$q$);
  if position('time_report_since' in def) = 0 or position('p.created_at' in def) = 0 then raise exception 'patch failed (data)'; end if;
  execute def;

  def := pg_get_functiondef('public.get_attendance_warning(text)'::regprocedure);
  def := replace(def, $q$'avatar_url', p.avatar_url, 'department', d.name)$q$, $q$'avatar_url', p.avatar_url, 'department', d.name, 'since', public.time_report_since(p.created_at))$q$);
  if position('time_report_since' in def) = 0 then raise exception 'patch failed (warning)'; end if;
  execute def;
end $$;

notify pgrst, 'reload schema';
