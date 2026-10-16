-- ============================================================================
-- bairshil.gennetex.com — ажилчдын одоогийн байршил, хэлтсээр эрхтэй
-- ============================================================================
--
--   Хэн юуг харах:
--     superadmin (sysadmin)                 → бүх ажилтан
--     sysadmin-ий оноосон хүн (grant)        → бүх ажилтан
--     хэлтэст оноогдсон админ                → зөвхөн өөрийн хэлтэс
--     бусад                                 → харахгүй
--
--   location_view_grants — sysadmin «бүгдийг харах» эрх өгсөн хүмүүс.
--   Байршил нь profiles.latitude/longitude/last_seen (апп шинэчилдэг).
-- ============================================================================

create table if not exists public.location_view_grants (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now()
);
alter table public.location_view_grants enable row level security;
-- Бодлого байхгүй: зөвхөн доорх security definer функцүүд хандана.

/** Одоогийн хэрэглэгчийн байршил харах хүрээ: 'all', 'dept', null. */
create or replace function public.location_scope()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.is_superadmin() then 'all'
    when exists (select 1 from public.location_view_grants g where g.user_id = auth.uid()) then 'all'
    when public.is_admin_user() and public.my_department() is not null then 'dept'
    else null
  end;
$$;
revoke all on function public.location_scope() from public, anon;
grant execute on function public.location_scope() to authenticated;

create or replace function public.staff_locations()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  scope text := public.location_scope();
  dept uuid := public.my_department();
begin
  if scope is null then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'scope', scope,
    'department', (select d.name from public.departments d where d.id = dept),
    'staff', coalesce((select jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.name, 'last_name', p.last_name, 'position', p.position,
        'avatar_url', p.avatar_url, 'department_id', p.department_id, 'department', d.name,
        'lat', p.latitude, 'lng', p.longitude, 'seen', p.last_seen) order by d.name nulls last, p.name)
      from public.profiles p
      left join public.departments d on d.id = p.department_id
      where p.role is distinct from 'superadmin'
        and (scope = 'all' or p.department_id = dept)), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.staff_locations() from public, anon;
grant execute on function public.staff_locations() to authenticated;

-- ── Эрх олгох (зөвхөн superadmin) ─────────────────────────────────────────
create or replace function public.location_grants_list()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_superadmin() then raise exception 'forbidden'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('user_id', g.user_id, 'granted_at', g.granted_at) order by g.granted_at)
                   from public.location_view_grants g), '[]'::jsonb);
end;
$$;
revoke all on function public.location_grants_list() from public, anon;
grant execute on function public.location_grants_list() to authenticated;

create or replace function public.location_grant_set(p_user uuid, p_on boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_superadmin() then raise exception 'forbidden'; end if;
  if p_on then
    insert into public.location_view_grants (user_id, granted_by) values (p_user, auth.uid())
    on conflict (user_id) do nothing;
  else
    delete from public.location_view_grants g where g.user_id = p_user;
  end if;
end;
$$;
revoke all on function public.location_grant_set(uuid, boolean) from public, anon;
grant execute on function public.location_grant_set(uuid, boolean) to authenticated;

notify pgrst, 'reload schema';
