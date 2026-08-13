-- ============================================================================
-- Бүртгэл устгах хүсэлт (Apple 5.1.1(v) / Google Play data deletion)
-- ============================================================================
--
-- НӨХЦӨЛ БАЙДАЛ:
--   Энэ апп дотор хэрэглэгч бүртгэл ҮҮСГЭДЭГГҮЙ — админ урьдчилж
--   `authorized_users`-д нэмснээр л нэвтрэх боломжтой болдог.
--
--   Apple-ийн албан ёсны текст: "apps ... that support account creation
--   must also let users initiate deletion of their account within the app."
--   Бүртгэл үүсгэдэггүй тул хатуу утгаараа хамаарахгүй байж болно.
--   ГЭВЧ reviewer энэ ялгааг үргэлж хүлээн авдаггүй бөгөөд маргах нь
--   долоо хоногийн саатал болдог. Тиймээс зам нээж өгөх нь хямд.
--
--   Мөн ажил олгогчийн систем гэдэг нь ажилтныг өгөгдлөө устгах эрхээс
--   хасах шалтгаан биш.
--
-- ЗАГВАР:
--   Хүсэлт өгмөгц НЭВТРЭХ ЭРХ НЬ ШУУД хаагдана (тэр даруй биелэх хэсэг),
--   харин ирц, цалин зэрэг хөдөлмөрийн харилцааны бүртгэл нь хуулийн
--   хадгалах хугацааны дараа устана. Apple үүнийг зөвшөөрдөг:
--   "If your process for account deletion is manual or otherwise takes
--    time to complete, this is acceptable."
-- ============================================================================

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  email text not null,
  name text,
  reason text,
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'rejected')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  handled_by uuid references public.profiles(id) on delete set null
);

create index if not exists acct_del_status_idx
  on public.account_deletion_requests (status, requested_at desc);

alter table public.account_deletion_requests enable row level security;

-- Хэрэглэгч өөрийн хүсэлтээ харна; админ бүгдийг харна.
drop policy if exists acct_del_read on public.account_deletion_requests;
create policy acct_del_read on public.account_deletion_requests
  for select to authenticated using (
    user_id = auth.uid()
    or public.role_rank((select p.role from public.profiles p where p.id = auth.uid())) >= 3
  );

-- INSERT нь зөвхөн доорх RPC-ээр — хүсэлтийг өөр хүний нэрээр
-- үүсгэхээс сэргийлнэ.

-- ---------------------------------------------------------------------------
-- Хэрэглэгч өөрөө устгах хүсэлт өгөх
-- ---------------------------------------------------------------------------
create or replace function public.request_account_deletion(p_reason text default null)
returns table (request_id uuid, access_revoked boolean, retention_days int)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_id uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select * into v_profile from public.profiles p where p.id = v_uid;
  if v_profile.id is null then raise exception 'profile_not_found'; end if;

  -- Сүүлийн superadmin өөрийгөө устгавал систем эзэнгүй үлдэнэ.
  if v_profile.role = 'superadmin'
     and (select count(*) from public.profiles p where p.role = 'superadmin') <= 1 then
    raise exception 'last_superadmin_cannot_delete';
  end if;

  insert into public.account_deletion_requests (user_id, email, name, reason)
  values (v_uid, v_profile.email, v_profile.name, nullif(trim(p_reason), ''))
  returning id into v_id;

  -- НЭВТРЭХ ЭРХ ШУУД ХААГДАНА. Энэ бол хэрэглэгчийн шууд мэдрэх үр дүн:
  -- дахин нэвтэрч чадахгүй болно.
  update public.authorized_users a
     set active = false, updated_at = now()
   where lower(a.email) = lower(v_profile.email);

  -- Байршил зэрэг идэвхтэй хяналтыг тэр дор нь зогсооно
  update public.profiles p
     set latitude = null, longitude = null
   where p.id = v_uid;

  update public.device_tokens d
     set is_active = false, updated_at = now()
   where d.user_id = v_uid;

  return query select v_id, true, 30;
end;
$$;

revoke execute on function public.request_account_deletion(text) from public, anon;
grant  execute on function public.request_account_deletion(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Админ хүсэлтийг биелүүлэх
-- ---------------------------------------------------------------------------
create or replace function public.complete_account_deletion(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_req public.account_deletion_requests%rowtype;
begin
  if v_actor is null then raise exception 'not_authenticated'; end if;
  if public.role_rank((select p.role from public.profiles p where p.id = v_actor)) < 3 then
    raise exception 'forbidden';
  end if;

  select * into v_req from public.account_deletion_requests r where r.id = p_request_id;
  if v_req.id is null then raise exception 'request_not_found'; end if;

  -- Хувийн шинжтэй өгөгдлийг устгана. Ирц, цалингийн бүртгэл нь
  -- хөдөлмөрийн хуулийн дагуу хадгалагдах ёстой тул нэрийг нь
  -- хувь хүнтэй холбогдохгүй болгож үлдээнэ.
  delete from public.face_templates  where user_id = v_req.user_id;
  delete from public.face_enrollments where user_id = v_req.user_id;
  delete from public.location_logs   where user_id = v_req.user_id;
  delete from public.device_tokens   where user_id = v_req.user_id;
  delete from public.push_tokens     where user_id = v_req.user_id;

  update public.account_deletion_requests r
     set status = 'completed', completed_at = now(), handled_by = v_actor
   where r.id = p_request_id;
end;
$$;

revoke execute on function public.complete_account_deletion(uuid) from public, anon;
grant  execute on function public.complete_account_deletion(uuid) to authenticated;
