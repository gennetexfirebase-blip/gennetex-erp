-- ============================================================================
-- WI-FI-ЭЭР ИРЦ БАТАЛГААЖУУЛАХ (attendance_wifi)
-- ============================================================================
-- Админ тодорхой байгууллагын Wi-Fi (SSID/BSSID) тохируулж, ажилтан/хэлтэс
-- оноож болно. `attendance_locations.wifi_gateway_ip` багана өмнө нь
-- нэмэгдсэн ч ашиглагдаагүй байсан (frontend уншиж/бичдэггүй) — энэ
-- хүснэгт нь Wi-Fi тохиргооны жинхэнэ эх сурвалж болно.
-- ============================================================================

create table if not exists public.attendance_wifi (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  ssid         text not null,
  bssid        text,
  location_id  uuid references public.attendance_locations(id) on delete set null,
  description  text,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  created_by   uuid references auth.users(id) on delete set null
);

create index if not exists attendance_wifi_active_idx on public.attendance_wifi (active);

alter table public.attendance_wifi enable row level security;

-- Уншихыг бүх нэвтэрсэн хэрэглэгчид нээнэ — ирц бүртгэхдээ өөрийн
-- утасны SSID тохирч байгаа эсэхийг апп дотроос шалгах ёстой (нэр/SSID
-- нь нууц мэдээлэл биш).
drop policy if exists "attendance_wifi_read" on public.attendance_wifi;
create policy "attendance_wifi_read" on public.attendance_wifi
  for select to authenticated
  using (true);

drop policy if exists "attendance_wifi_write" on public.attendance_wifi;
create policy "attendance_wifi_write" on public.attendance_wifi
  for all to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

grant select, insert, update, delete on public.attendance_wifi to authenticated;

-- ---------------------------------------------------------------------------
-- Wi-Fi → ажилтан оноолт
-- ---------------------------------------------------------------------------
create table if not exists public.attendance_wifi_employees (
  wifi_id     uuid not null references public.attendance_wifi(id) on delete cascade,
  employee_id uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (wifi_id, employee_id)
);

alter table public.attendance_wifi_employees enable row level security;

-- Ажилтан зөвхөн ӨӨРТ нь оноогдсон эсэхийг л мэдэх хэрэгтэй.
drop policy if exists "attendance_wifi_employees_read" on public.attendance_wifi_employees;
create policy "attendance_wifi_employees_read" on public.attendance_wifi_employees
  for select to authenticated
  using (employee_id = auth.uid() or public.is_admin_user());

drop policy if exists "attendance_wifi_employees_write" on public.attendance_wifi_employees;
create policy "attendance_wifi_employees_write" on public.attendance_wifi_employees
  for all to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

grant select, insert, update, delete on public.attendance_wifi_employees to authenticated;

notify pgrst, 'reload schema';
