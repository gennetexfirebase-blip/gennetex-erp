-- Supabase SQL schema — Gennetex ERP
-- Supabase Dashboard -> SQL Editor дээр энэ файлыг бүхэлд нь ажиллуулна.

-- ========== Хэрэглэгчийн профайл + эрх (profiles) ==========
-- auth.users-тэй холбоотой. role: 'employee' | 'admin' | 'superadmin'
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email text,
  role text not null default 'employee',
  position text,
  phone text,
  avatar_url text,
  latitude double precision,
  longitude double precision,
  last_seen timestamptz,
  must_change_password boolean default false,
  created_at timestamptz default now()
);

-- Хуучин DB дээр багана нэмэх (аль хэдийн байвал алгасна)
alter table public.profiles add column if not exists must_change_password boolean default false;
alter table public.profiles add column if not exists report_signature_url text;
alter table public.profiles add column if not exists telegram_user_id bigint;
alter table public.profiles add column if not exists telegram_username text;
alter table public.profiles add column if not exists telegram_linked_at timestamptz;

alter table public.profiles enable row level security;

drop policy if exists "profiles_read" on public.profiles;
create policy "profiles_read" on public.profiles
  for select using (auth.role() = 'authenticated');

drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update" on public.profiles
  for update using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'superadmin'))
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'superadmin'))
  );

-- Ажилтан өөрийн нэр/утас/зураг засахыг хориглоно (зөвхөн админ)
create or replace function public.protect_employee_profile_fields()
returns trigger as $$
declare
  user_role text;
begin
  select role into user_role from public.profiles where id = auth.uid();
  if user_role is null or user_role in ('admin', 'superadmin') then
    return new;
  end if;
  if new.name is distinct from old.name
     or new.last_name is distinct from old.last_name
     or new.email is distinct from old.email
     or new.role is distinct from old.role
     or new.position is distinct from old.position
     or new.phone is distinct from old.phone
     or new.address is distinct from old.address then
    raise exception 'profile_update_denied';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists protect_employee_profile_fields on public.profiles;
create trigger protect_employee_profile_fields
  before update on public.profiles
  for each row execute function public.protect_employee_profile_fields();

create or replace function public.protect_superadmin_profile()
returns trigger as $$
declare
  actor_role text;
begin
  select role into actor_role from public.profiles where id = auth.uid();
  if old.role = 'superadmin' and coalesce(actor_role, '') <> 'superadmin' then
    raise exception 'superadmin_protected';
  end if;
  if new.role = 'superadmin' and coalesce(actor_role, '') <> 'superadmin' then
    raise exception 'superadmin_role_denied';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists protect_superadmin_profile on public.profiles;
create trigger protect_superadmin_profile
  before update on public.profiles
  for each row execute function public.protect_superadmin_profile();

drop policy if exists "profiles_insert" on public.profiles;
create policy "profiles_insert" on public.profiles
  for insert with check (true);

-- Шинэ хэрэглэгч бүртгэгдэхэд профайл автоматаар үүсгэх (metadata-аас нэр/эрх авна)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, email, role, position, phone, must_change_password)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'employee'),
    new.raw_user_meta_data->>'position',
    new.raw_user_meta_data->>'phone',
    coalesce((new.raw_user_meta_data->>'must_change_password')::boolean, false)
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Нэвтрэхэд profiles үүсгэх / auth metadata-аас superadmin эрх синк
create or replace function public.bootstrap_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  u record;
  meta_role text;
  row public.profiles;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select id, email, raw_user_meta_data into u from auth.users where id = uid;
  if not found then raise exception 'user_not_found'; end if;
  meta_role := coalesce(u.raw_user_meta_data->>'role', 'employee');
  if meta_role not in ('employee', 'admin', 'superadmin') then meta_role := 'employee'; end if;
  insert into public.profiles (id, name, email, role)
  values (uid, coalesce(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)), u.email, meta_role)
  on conflict (id) do update set
    email = excluded.email,
    name = coalesce(public.profiles.name, excluded.name),
    role = case
      when public.profiles.role = 'superadmin' then 'superadmin'
      when excluded.role = 'superadmin' then 'superadmin'
      when excluded.role = 'admin' and public.profiles.role = 'employee' then 'admin'
      else public.profiles.role
    end
  returning * into row;
  return row;
end;
$$;
grant execute on function public.bootstrap_profile() to authenticated;

-- Системийн админ бүх хэрэглэгчийн нууц үг солино
create or replace function public.admin_reset_user_password(
  target_user_id uuid,
  new_password text,
  force_change boolean default true
)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  actor_role text;
begin
  select role into actor_role from public.profiles where id = auth.uid();
  if coalesce(actor_role, '') <> 'superadmin' then
    raise exception 'forbidden';
  end if;
  if new_password is null or length(new_password) < 6 then
    raise exception 'password_too_short';
  end if;
  if not exists (select 1 from auth.users where id = target_user_id) then
    raise exception 'user_not_found';
  end if;
  update auth.users
     set encrypted_password = crypt(new_password, gen_salt('bf')),
         updated_at = now()
   where id = target_user_id;
  update public.profiles
     set must_change_password = coalesce(force_change, true)
   where id = target_user_id;
end;
$$;
revoke all on function public.admin_reset_user_password(uuid, text, boolean) from public;
grant execute on function public.admin_reset_user_password(uuid, text, boolean) to authenticated;

-- ЭХНИЙ АДМИН: доорх мөрийг өөрийн имэйлээр солиод, бүртгүүлсний ДАРАА ажиллуулна:
-- update public.profiles set role = 'admin' where email = 'admin@company.mn';

-- ========== Барааны олголт / хэрэглээ (stock_movements) ==========
-- Ажилтан бараанаас авахад энд бүртгэгдэж, барааны тоо хасагдана.
create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid,
  item_name text,
  unit text,
  user_id uuid,
  user_name text,
  quantity numeric not null,
  movement_type text default 'withdraw', -- withdraw | consume | return
  created_at timestamptz default now()
);
create index if not exists stock_mov_user_idx on public.stock_movements (user_id, created_at desc);

-- ========== Чат: яриа (conversations) ==========
-- is_group=false бол 1:1 (dm_key = хоёр хэрэглэгчийн id эрэмбэлсэн), true бол групп
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  name text,
  is_group boolean default false,
  dm_key text unique,
  created_by uuid,
  created_at timestamptz default now()
);

create table if not exists public.conversation_members (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete cascade,
  user_id uuid,
  user_name text,
  created_at timestamptz default now(),
  unique (conversation_id, user_id)
);
create index if not exists conv_members_user_idx on public.conversation_members (user_id);

-- ========== Дуудлагын дохио (call_sessions) — "X залгаж байна" ==========
create table if not exists public.call_sessions (
  id uuid primary key default gen_random_uuid(),
  room text not null,
  caller_id uuid,
  caller_name text,
  callee_id uuid,
  callee_name text,
  status text default 'ringing', -- ringing | accepted | declined | ended
  created_at timestamptz default now()
);
create index if not exists call_callee_idx on public.call_sessions (callee_id, created_at desc);

-- ========== Байгууллагын машин (vehicles) ==========
-- Машин бүр дээр QR наана. QR-ийн агуулга = code (жишээ: VH-001)
create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  plate_number text not null,
  liters_per_100km numeric default 12,
  driver_name text,
  driver_id uuid references auth.users(id),
  active boolean default true,
  barcode text,
  created_at timestamptz default now()
);
-- Хуучин DB-д багана нэмэх (migration)
alter table public.vehicles add column if not exists driver_id uuid references auth.users(id);
alter table public.vehicles add column if not exists barcode text;
create index if not exists vehicles_barcode_idx on public.vehicles (barcode);

-- ========== Машины лог (vehicle_logs) — хэн ямар машин уншсан/жолоодсон ==========
create table if not exists public.vehicle_logs (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid,
  plate_number text,
  code text,
  user_id uuid,
  user_name text,
  event text default 'scan', -- scan | trip_start | trip_end
  distance_km numeric,
  liters numeric,
  cost numeric,
  latitude double precision,
  longitude double precision,
  created_at timestamptz default now()
);
create index if not exists vehicle_logs_idx on public.vehicle_logs (vehicle_id, created_at desc);
create index if not exists vehicle_logs_user_idx on public.vehicle_logs (user_id, created_at desc);
alter table public.vehicle_logs enable row level security;
drop policy if exists "vehicle_logs_all" on public.vehicle_logs;
create policy "vehicle_logs_all" on public.vehicle_logs for all using (true) with check (true);

-- ========== Аялал (trips) — км/бензиний тооцоо ==========
create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid references public.vehicles(id),
  plate_number text,
  driver_id uuid references auth.users(id),
  driver_name text,
  distance_km numeric default 0,
  liters numeric default 0,
  cost numeric default 0,
  idle_seconds integer default 0,
  status text default 'active', -- active | done
  started_at timestamptz default now(),
  ended_at timestamptz
);

-- ========== Аяллын хамт яваа хүн ==========
create table if not exists public.trip_passengers (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  passenger_id uuid references auth.users(id) on delete set null,
  passenger_name text not null,
  scanned_at timestamptz default now()
);
create index if not exists trip_passengers_trip_idx on public.trip_passengers (trip_id, scanned_at);
alter table public.profiles add column if not exists badge_code text unique;
alter table public.profiles add column if not exists last_name text;
alter table public.profiles add column if not exists address text;

-- ========== Ажлын байр (баг) ==========
create table if not exists public.field_site_sessions (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references public.trips(id) on delete set null,
  driver_id uuid references auth.users(id) on delete set null,
  driver_name text,
  site_name text not null,
  site_address text,
  latitude double precision,
  longitude double precision,
  passengers jsonb default '[]'::jsonb,
  arrived_at timestamptz,
  departed_at timestamptz,
  work_note text,
  status text not null default 'pending',
  submitted_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists field_site_sessions_trip_idx on public.field_site_sessions (trip_id, created_at desc);
create index if not exists field_site_sessions_day_idx on public.field_site_sessions (created_at desc);
create index if not exists field_site_sessions_status_idx on public.field_site_sessions (status, created_at desc);

-- ========== Инженерийн дуудлага ==========
create table if not exists public.service_calls (
  id uuid primary key default gen_random_uuid(),
  customer text not null,
  phone text,
  address text,
  problem text,
  call_type text not null default 'other',
  engineer_id uuid references auth.users(id) on delete set null,
  engineer_name text,
  latitude double precision,
  longitude double precision,
  status text not null default 'Хүлээгдэж буй',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists service_calls_engineer_idx on public.service_calls (engineer_id, created_at desc);
create index if not exists service_calls_status_idx on public.service_calls (status, created_at desc);

-- ========== Бензиний тохиргоо (админ засна) ==========
create table if not exists public.fuel_settings (
  id int primary key default 1 check (id = 1),
  liters_per_100km numeric not null default 12,
  price_per_liter numeric not null default 2600,
  idle_liters_per_hour numeric not null default 1.2,
  updated_at timestamptz default now()
);
insert into public.fuel_settings (id) values (1) on conflict (id) do nothing;

-- ========== Ажилтны тайлан (employee_reports) ==========
create table if not exists public.employee_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  user_name text,
  report_type text not null,
  title text not null,
  body_html text,
  payload jsonb,
  signature_url text,
  pdf_url text,
  created_at timestamptz default now()
);
create index if not exists employee_reports_created_idx on public.employee_reports (created_at desc);
create index if not exists employee_reports_user_idx on public.employee_reports (user_id, created_at desc);

-- ========== Байршлын лог (location_logs) ==========
create table if not exists public.location_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  user_name text,
  latitude double precision,
  longitude double precision,
  speed double precision,
  recorded_at timestamptz default now()
);
create index if not exists location_logs_user_idx on public.location_logs (user_id, recorded_at desc);

-- ========== Айлд очсон лог (visit_logs) ==========
create table if not exists public.visit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  user_name text,
  call_id text,
  customer text,
  problem text,
  call_type text,
  latitude double precision,
  longitude double precision,
  arrived_at timestamptz default now()
);
-- Хуучин DB-д багана нэмэх (migration)
alter table public.visit_logs add column if not exists problem text;
alter table public.visit_logs add column if not exists call_type text;

-- ========== Ажилтан (staff) ==========
create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  role text default 'Ажилтан',
  color text default '#3b82f6',
  latitude double precision,
  longitude double precision,
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);

-- ========== Бараа материал (inventory) ==========
create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text default 'ширхэг',
  quantity numeric default 0,
  price numeric default 0,
  barcode text,
  category text default 'material', -- material (бараа материал) | tool (багаж)
  created_at timestamptz default now()
);
-- Хуучин DB-д багана нэмэх
alter table public.inventory add column if not exists category text default 'material';

create index if not exists inventory_barcode_idx on public.inventory (barcode);

-- ========== Ирц (attendance) — царайны зурагтай ==========
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  staff_id text,
  staff_name text not null,
  type text not null default 'check_in', -- check_in | check_out
  photo_url text,
  latitude double precision,
  longitude double precision,
  status text default 'approved', -- approved | pending | rejected
  is_remote boolean default false,
  distance_m double precision,
  note text,
  created_at timestamptz default now()
);
-- Хуучин DB-д багана нэмэх (migration)
alter table public.attendance add column if not exists status text default 'approved';
alter table public.attendance add column if not exists is_remote boolean default false;
alter table public.attendance add column if not exists distance_m double precision;
alter table public.attendance add column if not exists note text;

create index if not exists attendance_created_idx on public.attendance (created_at desc);

-- ========== Царайны бүртгэл (face_enrollments) ==========
-- Ажилтан анх удаа 10 удаа царайгаа бүртгэнэ. Дараа нь ирц бүртгэхэд
-- шинэ selfie-г эдгээртэй харьцуулж зөвхөн тухайн хүнийг таньна.
create table if not exists public.face_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  user_name text,
  photo_url text not null,
  created_at timestamptz default now()
);
create index if not exists face_enroll_user_idx on public.face_enrollments (user_id, created_at);
alter table public.profiles add column if not exists face_enrolled boolean default false;
alter table public.profiles add column if not exists face_uuid text;

-- On-device OpenCV SFace templates. Raw vectors are private to the employee.
create table if not exists public.face_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_name text,
  pose text not null check (pose in ('center', 'side_a', 'side_b', 'tilt_a', 'tilt_b', 'smile', 'center_2')),
  embedding jsonb not null check (jsonb_typeof(embedding) = 'array' and jsonb_array_length(embedding) = 128),
  quality real not null default 0.5 check (quality >= 0 and quality <= 1),
  yaw real not null default 0,
  pitch real not null default 0,
  roll real not null default 0,
  model_version text not null default 'opencv-sface-2021dec',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, pose, model_version)
);
create index if not exists face_templates_user_idx on public.face_templates (user_id, model_version, created_at);

-- ========== Ирц бүртгэх зөвшөөрөгдсөн байршил (attendance_locations) ==========
-- Админ энд контор/талбайн байршлыг тодорхойлно. Зөвхөн энэ цэгийн ойролцоо
-- (radius_m доторх) ирц шууд бүртгэгдэнэ. Гадуур бол зайнаас хүсэлт болно.
create table if not exists public.attendance_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  latitude double precision not null,
  longitude double precision not null,
  radius_m integer not null default 200,
  active boolean default true,
  created_at timestamptz default now()
);

-- ========== Чат мессеж (messages) ==========
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  room text not null default 'general',
  sender_id text not null,
  sender_name text not null,
  content text default '',
  attachment_url text,
  attachment_type text, -- image | file
  attachment_name text,
  created_at timestamptz default now()
);
-- Хуучин DB-д багана нэмэх + content-ийг заавал биш болгох
alter table public.messages add column if not exists attachment_url text;
alter table public.messages add column if not exists attachment_type text;
alter table public.messages add column if not exists attachment_name text;
alter table public.messages alter column content drop not null;
alter table public.messages alter column content set default '';
alter table public.messages add column if not exists edited_at timestamptz;

create index if not exists messages_room_idx on public.messages (room, created_at);

-- ========== RLS (Row Level Security) ==========
-- Хялбар эхлэлийн тохиргоо: нэвтэрсэн болон anon хэрэглэгчид унших/бичих эрхтэй.
-- Production дээр эрхийг чангатгана уу.
alter table public.staff enable row level security;
alter table public.inventory enable row level security;
alter table public.attendance enable row level security;
alter table public.messages enable row level security;
alter table public.vehicles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_passengers enable row level security;
alter table public.field_site_sessions enable row level security;
alter table public.service_calls enable row level security;
alter table public.location_logs enable row level security;
alter table public.visit_logs enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.call_sessions enable row level security;
alter table public.stock_movements enable row level security;
alter table public.attendance_locations enable row level security;
alter table public.face_enrollments enable row level security;
alter table public.face_templates enable row level security;
alter table public.employee_reports enable row level security;
alter table public.fuel_settings enable row level security;

-- ========== Push notification token (push_tokens) ==========
create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  token text not null,
  platform text,
  updated_at timestamptz default now()
);
create unique index if not exists push_tokens_user_token_idx on public.push_tokens (user_id, token);
create index if not exists push_tokens_user_idx on public.push_tokens (user_id);
alter table public.push_tokens enable row level security;
drop policy if exists "push_tokens_all" on public.push_tokens;
create policy "push_tokens_all" on public.push_tokens for all using (true) with check (true);

drop policy if exists "staff_all" on public.staff;
create policy "staff_all" on public.staff
  for all using (true) with check (true);

drop policy if exists "inventory_all" on public.inventory;
create policy "inventory_all" on public.inventory
  for all using (true) with check (true);

drop policy if exists "attendance_all" on public.attendance;
create policy "attendance_all" on public.attendance
  for all using (true) with check (true);

drop policy if exists "messages_all" on public.messages;
create policy "messages_all" on public.messages
  for all using (true) with check (true);

drop policy if exists "vehicles_all" on public.vehicles;
create policy "vehicles_all" on public.vehicles for all using (true) with check (true);

drop policy if exists "trips_all" on public.trips;
create policy "trips_all" on public.trips for all using (true) with check (true);

drop policy if exists "trip_passengers_read" on public.trip_passengers;
create policy "trip_passengers_read" on public.trip_passengers for select using (true);

drop policy if exists "trip_passengers_write" on public.trip_passengers;
create policy "trip_passengers_write" on public.trip_passengers for all using (true) with check (true);

drop policy if exists "field_site_sessions_all" on public.field_site_sessions;
create policy "field_site_sessions_all" on public.field_site_sessions for all to anon, authenticated using (true) with check (true);
grant select, insert, update on public.field_site_sessions to anon, authenticated;

drop policy if exists "service_calls_all" on public.service_calls;
create policy "service_calls_all" on public.service_calls for all to anon, authenticated using (true) with check (true);
grant select, insert, update on public.service_calls to anon, authenticated;

drop policy if exists "location_logs_all" on public.location_logs;
create policy "location_logs_all" on public.location_logs for all using (true) with check (true);

drop policy if exists "visit_logs_all" on public.visit_logs;
create policy "visit_logs_all" on public.visit_logs for all using (true) with check (true);

drop policy if exists "conversations_all" on public.conversations;
create policy "conversations_all" on public.conversations for all using (true) with check (true);

drop policy if exists "conversation_members_all" on public.conversation_members;
create policy "conversation_members_all" on public.conversation_members for all using (true) with check (true);

drop policy if exists "call_sessions_all" on public.call_sessions;
create policy "call_sessions_all" on public.call_sessions for all using (true) with check (true);

drop policy if exists "stock_movements_all" on public.stock_movements;
create policy "stock_movements_all" on public.stock_movements for all using (true) with check (true);

drop policy if exists "attendance_locations_all" on public.attendance_locations;
create policy "attendance_locations_all" on public.attendance_locations for all using (true) with check (true);

drop policy if exists "face_enrollments_all" on public.face_enrollments;
drop policy if exists "face_enrollments_select_own" on public.face_enrollments;
create policy "face_enrollments_select_own" on public.face_enrollments for select to authenticated
using ((select auth.uid()) = user_id);
drop policy if exists "face_enrollments_insert_own" on public.face_enrollments;
create policy "face_enrollments_insert_own" on public.face_enrollments for insert to authenticated
with check ((select auth.uid()) = user_id);

revoke all on public.face_templates from anon;
grant select, insert, update, delete on public.face_templates to authenticated;
drop policy if exists "face_templates_select_own" on public.face_templates;
create policy "face_templates_select_own" on public.face_templates for select to authenticated
using ((select auth.uid()) = user_id);
drop policy if exists "face_templates_insert_own" on public.face_templates;
create policy "face_templates_insert_own" on public.face_templates for insert to authenticated
with check ((select auth.uid()) = user_id);
drop policy if exists "face_templates_update_own" on public.face_templates;
create policy "face_templates_update_own" on public.face_templates for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "face_templates_delete_own" on public.face_templates;
create policy "face_templates_delete_own" on public.face_templates for delete to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "employee_reports_all" on public.employee_reports;
create policy "employee_reports_all" on public.employee_reports for all using (true) with check (true);

drop policy if exists "fuel_settings_read" on public.fuel_settings;
create policy "fuel_settings_read" on public.fuel_settings for select using (true);

drop policy if exists "fuel_settings_write" on public.fuel_settings;
create policy "fuel_settings_write" on public.fuel_settings for all using (true) with check (true);

-- ========== Ажилтны хуваарь + амралт ==========
create table if not exists public.employee_shifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  user_name text,
  shift_date date not null,
  start_time text not null,
  end_time text not null,
  location_id uuid references public.attendance_locations(id) on delete set null,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  unique (user_id, shift_date)
);

create table if not exists public.work_breaks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  user_name text,
  work_date date not null default current_date,
  minutes integer not null default 0,
  note text,
  created_at timestamptz default now()
);

create table if not exists public.employee_break_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  user_name text,
  day_of_week smallint not null check (day_of_week between 1 and 7),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  unique (user_id, day_of_week)
);

create index if not exists employee_break_schedules_user_idx
  on public.employee_break_schedules (user_id, day_of_week);

-- Realtime (all referenced tables exist at this point; safe to rerun)
do $$
declare
  tbl text;
  tables text[] := array[
    'messages', 'staff', 'profiles', 'location_logs', 'visit_logs',
    'conversations', 'conversation_members', 'call_sessions', 'employee_reports',
    'employee_shifts', 'work_breaks', 'employee_break_schedules', 'attendance'
  ];
begin
  foreach tbl in array tables loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = tbl
    ) then
      execute format('alter publication supabase_realtime add table public.%I', tbl);
    end if;
  end loop;
end $$;

alter table public.attendance add column if not exists location_name text;
alter table public.visit_logs add column if not exists photo_url text;
alter table public.visit_logs add column if not exists face_verified boolean default false;
alter table public.visit_logs add column if not exists location_name text;

alter table public.employee_shifts enable row level security;
alter table public.work_breaks enable row level security;
alter table public.employee_break_schedules enable row level security;
drop policy if exists "employee_shifts_all" on public.employee_shifts;
create policy "employee_shifts_all" on public.employee_shifts for all using (true) with check (true);
drop policy if exists "work_breaks_all" on public.work_breaks;
create policy "work_breaks_all" on public.work_breaks for all using (true) with check (true);
drop policy if exists "employee_break_schedules_all" on public.employee_break_schedules;
drop policy if exists "employee_break_schedules_select" on public.employee_break_schedules;
drop policy if exists "employee_break_schedules_insert" on public.employee_break_schedules;
drop policy if exists "employee_break_schedules_update" on public.employee_break_schedules;
drop policy if exists "employee_break_schedules_delete" on public.employee_break_schedules;

grant select, insert, update, delete on public.employee_break_schedules to anon, authenticated;
grant all on public.employee_break_schedules to service_role;

create policy "employee_break_schedules_select" on public.employee_break_schedules
  for select to anon, authenticated using (true);
create policy "employee_break_schedules_insert" on public.employee_break_schedules
  for insert to anon, authenticated with check (true);
create policy "employee_break_schedules_update" on public.employee_break_schedules
  for update to anon, authenticated using (true) with check (true);
create policy "employee_break_schedules_delete" on public.employee_break_schedules
  for delete to anon, authenticated using (true);

-- ========== Storage: ирцийн зураг ==========
-- 'attendance' нэртэй PUBLIC bucket үүсгэнэ.
insert into storage.buckets (id, name, public)
values ('reports', 'reports', true)
on conflict (id) do nothing;

drop policy if exists "reports_read" on storage.objects;
create policy "reports_read" on storage.objects for select using (bucket_id = 'reports');
drop policy if exists "reports_write" on storage.objects;
create policy "reports_write" on storage.objects for insert with check (bucket_id = 'reports');
drop policy if exists "reports_update" on storage.objects;
create policy "reports_update" on storage.objects for update using (bucket_id = 'reports');
drop policy if exists "reports_delete" on storage.objects;
create policy "reports_delete" on storage.objects for delete using (bucket_id = 'reports');

insert into storage.buckets (id, name, public)
values ('attendance', 'attendance', true)
on conflict (id) do nothing;

drop policy if exists "attendance_read" on storage.objects;
create policy "attendance_read" on storage.objects
  for select using (bucket_id = 'attendance');

drop policy if exists "attendance_write" on storage.objects;
create policy "attendance_write" on storage.objects
  for insert with check (bucket_id = 'attendance');

-- ========== Жишээ өгөгдөл ==========
insert into public.staff (name, phone, role, color, latitude, longitude) values
  ('Дорж', '99110011', 'Цахилгаанчин', '#22c55e', 47.9105, 106.8830),
  ('Сүхээ', '99220022', 'Сантехникч', '#f59e0b', 47.9250, 106.9300)
on conflict do nothing;

insert into public.vehicles (code, plate_number, liters_per_100km, driver_name) values
  ('VH-001', '1234 УБА', 12, 'Дорж'),
  ('VH-002', '5678 УНЯ', 9.5, 'Сүхээ'),
  ('VH-003', '9012 УБВ', 14, null)
on conflict (code) do nothing;

insert into public.inventory (name, unit, quantity, price, barcode) values
  ('Router (чиглүүлэгч)', 'ширхэг', 25, 145000, '4820000000017'),
  ('Switch 8 порт', 'ширхэг', 18, 210000, '4820000000024'),
  ('Оптик кабель', 'метр', 1500, 1200, '4820000000031'),
  ('UTP кабель Cat6', 'метр', 2000, 900, '4820000000048'),
  ('RJ45 холбогч', 'ширхэг', 500, 500, '4820000000055'),
  ('ONU төхөөрөмж', 'ширхэг', 40, 95000, '4820000000062'),
  ('Access Point (WiFi)', 'ширхэг', 12, 320000, '4820000000079'),
  ('Медиа конвертер', 'ширхэг', 30, 65000, '4820000000086'),
  ('Патч панель 24 порт', 'ширхэг', 8, 180000, '4820000000093'),
  ('Оптик патч корд', 'ширхэг', 100, 8000, '4820000000109')
on conflict do nothing;
