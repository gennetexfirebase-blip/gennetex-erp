-- ============================================================================
-- Ирцийн WIDGET — апп нээлгүйгээр ирц бүртгэх төхөөрөмжийн token
-- ============================================================================
--
-- ЯАГААД ТУСДАА TOKEN ВЭ:
--   Widget нь аппын гадна (iOS widget extension / Android AppWidget) ажилладаг
--   тул Supabase-ийн session-ийг хуваалцаж болохгүй: refresh token нэг удаа
--   хэрэглэгддэг тул widget сэргээвэл аппын session тасарна.
--   Оронд нь апп нэвтэрсний дараа ЗӨВХӨН ирц бүртгэх эрхтэй, төхөөрөмж
--   бүрт нэг token авч widget-тэй хуваалцана. Сервер зөвхөн hash-ийг хадгална.
--
--   Token-оор зөвхөн `widget-attendance` edge function ажиллана: өнөөдрийн
--   төлөв унших, ажлын цэгийн бүсэд байвал ирсэн/явсан бүртгэх. Гарах үед
--   апп token-оо хүчингүй болгоно.
-- ============================================================================

create table if not exists public.attendance_widget_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  device_label text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists attendance_widget_tokens_user_idx
  on public.attendance_widget_tokens (user_id) where revoked_at is null;

alter table public.attendance_widget_tokens enable row level security;
revoke all on public.attendance_widget_tokens from public, anon;
grant select on public.attendance_widget_tokens to authenticated;

drop policy if exists attendance_widget_tokens_own on public.attendance_widget_tokens;
create policy attendance_widget_tokens_own on public.attendance_widget_tokens
  for select to authenticated using (user_id = auth.uid());

-- Шинэ token олгоно (тухайн төхөөрөмжийн өмнөх token-ыг хүчингүй болгоно).
create or replace function public.issue_attendance_widget_token(p_device text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  tok text;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  update public.attendance_widget_tokens
     set revoked_at = now()
   where user_id = uid
     and revoked_at is null
     and device_label is not distinct from left(p_device, 120);

  tok := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.attendance_widget_tokens (user_id, token_hash, device_label)
  values (uid, encode(extensions.digest(tok, 'sha256'), 'hex'), left(p_device, 120));
  return tok;
end;
$$;

revoke all on function public.issue_attendance_widget_token(text) from public, anon;
grant execute on function public.issue_attendance_widget_token(text) to authenticated;

-- Гарах үед: тухайн төхөөрөмжийн (эсвэл бүх) token-ыг хүчингүй болгоно.
create or replace function public.revoke_attendance_widget_tokens(p_device text default null)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.attendance_widget_tokens
     set revoked_at = now()
   where user_id = auth.uid()
     and revoked_at is null
     and (p_device is null or device_label is not distinct from left(p_device, 120));
$$;

revoke all on function public.revoke_attendance_widget_tokens(text) from public, anon;
grant execute on function public.revoke_attendance_widget_tokens(text) to authenticated;
