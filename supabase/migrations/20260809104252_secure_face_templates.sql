-- Private on-device face embeddings for employee attendance.
-- Raw recognition templates are visible only to their owner; admins only see
-- the resulting attendance record and proof selfie, never biometric vectors.
create table if not exists public.face_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_name text,
  pose text not null check (pose in (
    'center', 'side_a', 'side_b', 'tilt_a', 'tilt_b', 'smile', 'center_2'
  )),
  embedding jsonb not null
    check (jsonb_typeof(embedding) = 'array' and jsonb_array_length(embedding) = 128),
  quality real not null default 0.5 check (quality >= 0 and quality <= 1),
  yaw real not null default 0,
  pitch real not null default 0,
  roll real not null default 0,
  model_version text not null default 'opencv-sface-2021dec',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, pose, model_version)
);

create index if not exists face_templates_user_idx
  on public.face_templates (user_id, model_version, created_at);

alter table public.face_templates enable row level security;
revoke all on public.face_templates from anon;
grant select, insert, update, delete on public.face_templates to authenticated;

drop policy if exists "face_templates_select_own" on public.face_templates;
create policy "face_templates_select_own"
  on public.face_templates for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "face_templates_insert_own" on public.face_templates;
create policy "face_templates_insert_own"
  on public.face_templates for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "face_templates_update_own" on public.face_templates;
create policy "face_templates_update_own"
  on public.face_templates for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "face_templates_delete_own" on public.face_templates;
create policy "face_templates_delete_own"
  on public.face_templates for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Remove the legacy globally-readable enrollment policy. Existing rows remain
-- available to their owner for migration/audit but no longer leak to all users.
alter table public.face_enrollments enable row level security;
drop policy if exists "face_enrollments_all" on public.face_enrollments;
drop policy if exists "face_enrollments_select_own" on public.face_enrollments;
create policy "face_enrollments_select_own"
  on public.face_enrollments for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "face_enrollments_insert_own" on public.face_enrollments;
create policy "face_enrollments_insert_own"
  on public.face_enrollments for insert to authenticated
  with check ((select auth.uid()) = user_id);
