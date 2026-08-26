-- ============================================================================
-- ГЕОФЕНС БАЙРШИЛ → АЖИЛТАН ОНООЛТ (attendance_location_employees)
-- ============================================================================
-- Админ тодорхой геофенс байршлыг тодорхой ажилтнуудад (эсвэл томилохдоо
-- нэг бүрчлэн шийдсэн хэлтсийн гишүүдэд snapshot байдлаар) оноож болно.
-- `department_id`-аар ЛАЙВ шүүхгүй — оноосон мөчид тухайн хэлтсийн
-- гишүүдийг нэг бүрчлэн мөр болгож хадгална (хэлтэс дараа өөрчлөгдвөл
-- дахин оноох шаардлагатай, гэхдээ логик энгийн бөгөөд урьдчилан
-- таамаглах боломжтой хэвээр байна).
-- ============================================================================

create table if not exists public.attendance_location_employees (
  location_id uuid not null references public.attendance_locations(id) on delete cascade,
  employee_id uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (location_id, employee_id)
);

alter table public.attendance_location_employees enable row level security;

drop policy if exists "attendance_location_employees_read" on public.attendance_location_employees;
create policy "attendance_location_employees_read" on public.attendance_location_employees
  for select to authenticated
  using (employee_id = auth.uid() or public.is_admin_user());

drop policy if exists "attendance_location_employees_write" on public.attendance_location_employees;
create policy "attendance_location_employees_write" on public.attendance_location_employees
  for all to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

grant select, insert, update, delete on public.attendance_location_employees to authenticated;

notify pgrst, 'reload schema';
