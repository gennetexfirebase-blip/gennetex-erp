-- Ажилтны нэр солигдоход ERP даяар тархаах + hr.gennetex.com-оос ажлаас гаргах / устгах.
--
-- 1) profiles.name / last_name өөрчлөгдөхөд хүснэгт бүрт хуулбарлан хадгалсан нэрийг
--    (ирц, дуудлага, акт, чат, агуулах, ХААБ, гүйцэтгэл …) тухайн хүний id-аар шинэчилнэ.
--    Зөвхөн хуучин нэрийн хэлбэртэй (бүтэн «Овог Нэр», «О.Нэр», «Нэр») яг таарсан утгыг солино.
-- 2) authorized_users ↔ profiles нэрийг ижил байлгана; апп-д бүртгүүлээгүй хүний гүйцэтгэлийн
--    display_name-ийг шинэчилнэ.
-- 3) admin_hr_set_active / admin_hr_delete — энгийн админ (employees эрхийг хаагаагүй) ба хөгжүүлэгч.

create or replace function public.person_name_forms(p_last text, p_name text)
returns text[]
language sql
immutable
as $$
  select array[
    btrim(coalesce(p_last, '') || ' ' || coalesce(p_name, '')),
    case when coalesce(p_last, '') <> '' then left(btrim(p_last), 1) || '.' || btrim(coalesce(p_name, '')) end,
    btrim(coalesce(p_name, ''))
  ];
$$;

create or replace function public.propagate_person_rename(p_user uuid, p_old_last text, p_old_name text, p_new_last text, p_new_name text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  o text[] := public.person_name_forms(p_old_last, p_old_name);
  n text[] := public.person_name_forms(p_new_last, p_new_name);
  r record;
  pairs text[][] := array[
    ['act_audit_logs','actor_name','actor_id'], ['act_photos','taken_by_employee_name','taken_by_employee_id'],
    ['activity_logs','user_name','user_id'], ['acts','approved_by_name','approved_by'], ['acts','created_by_name','created_by'],
    ['ai_performance_reports','created_by_name','created_by'], ['attendance_requests','employee_name','employee_id'],
    ['attendance_warnings','created_by_name','created_by'], ['attendance_warnings','employee_name','employee_id'],
    ['box_issues','issued_by_name','issued_by'], ['box_issues','issued_to_name','issued_to'], ['box_serials','issued_to_name','issued_to'],
    ['call_sessions','callee_name','callee_id'], ['call_sessions','caller_name','caller_id'],
    ['content_reports','reporter_name','reporter_id'], ['content_reports','target_user_name','target_user_id'],
    ['conversation_members','user_name','user_id'], ['device_approvals','decided_by_name','decided_by'], ['device_approvals','user_name','user_id'],
    ['employee_break_schedules','user_name','user_id'], ['employee_feedback','user_name','user_id'], ['employee_reports','user_name','user_id'],
    ['employee_shifts','user_name','user_id'], ['employee_week_schedule','updated_by_name','updated_by'],
    ['employment_contracts','created_by_name','created_by'], ['excel_archives','created_by_name','created_by'],
    ['face_enrollments','user_name','user_id'], ['face_templates','user_name','user_id'], ['field_site_sessions','driver_name','driver_id'],
    ['field_work_records','created_by_name','created_by'], ['field_work_records','resolved_by_name','resolved_by'],
    ['inventory_counts','employee_name','employee_id'], ['inventory_receipts','received_by_name','received_by'],
    ['job_applications','admin_signed_by_name','admin_signed_by'], ['job_contracts','created_by_name','created_by'], ['job_contracts','employee_name','employee_id'],
    ['leave_requests','reviewed_by_name','reviewed_by'], ['leave_requests','user_name','user_id'], ['live_comments','user_name','user_id'],
    ['live_invites','host_name','host_id'], ['live_invites','invitee_name','invitee_id'], ['live_streams','host_name','host_id'],
    ['location_logs','user_name','user_id'], ['meal_ledger','created_by_name','created_by'], ['meetings','host_name','host_id'],
    ['notification_campaigns','sent_by_name','sent_by'], ['ohaab_daily_ack','user_name','user_id'], ['ohaab_instruction','updated_by_name','updated_by'],
    ['payroll_rates','created_by_name','created_by'], ['payroll_rates','user_name','user_id'], ['perf_jobs','created_by_name','created_by'],
    ['post_comments','user_name','user_id'], ['post_reactions','user_name','user_id'], ['posts','author_name','author_id'],
    ['service_calls','created_by_name','created_by'], ['service_calls','engineer_name','engineer_id'], ['service_calls','partner_engineer_name','partner_engineer_id'],
    ['shares','owner_name','owner_id'], ['stock_movements','issued_by_name','issued_by'], ['stock_movements','user_name','user_id'],
    ['stories','author_name','author_id'], ['team_performance_entries','created_by_name','created_by'], ['telegram_chat_messages','sender_name','sender_id'],
    ['trip_passengers','passenger_name','passenger_id'], ['trips','driver_name','driver_id'], ['user_blocks','blocked_name','blocked_id'],
    ['vehicle_logs','user_name','user_id'], ['vehicles','driver_name','driver_id'], ['visit_logs','user_name','user_id'], ['work_breaks','user_name','user_id'],
    ['work_height_approvals','approver_name','approver_id'], ['work_height_assessments','employee_name','employee_id'],
    ['work_height_audit','actor_name','actor_id'], ['work_height_incidents','reporter_name','reporter_id'],
    ['work_hour_entries','created_by_name','created_by'], ['work_hour_entries','user_name','user_id'],
    ['attendance','staff_name','staff_id']
  ];
  i int;
begin
  if p_user is null or o = n then return; end if;
  for i in 1 .. array_length(pairs, 1) loop
    -- Хүснэгт/багана байхгүй бол алгасна (хуучирсан схем).
    if not exists (
      select 1 from information_schema.columns c
      where c.table_schema = 'public' and c.table_name = pairs[i][1] and c.column_name in (pairs[i][2], pairs[i][3])
      group by c.table_name having count(*) = 2
    ) then continue; end if;
    execute format(
      'update public.%I set %I = case %I when $1 then $4 when $2 then $5 when $3 then $6 else %I end where %I::text = $7 and %I in ($1, $2, $3)',
      pairs[i][1], pairs[i][2], pairs[i][2], pairs[i][2], pairs[i][3], pairs[i][2]
    ) using o[1], coalesce(o[2], o[1]), o[3], n[1], coalesce(n[2], n[1]), n[3], p_user::text;
  end loop;

  -- Гүйцэтгэл: формоор бүртгэсэн ажлын инженер, «хэний эрхээр»-ийн нэр; шинэ нэрийг тухайн хүнд холбоно.
  update public.perf_jobs pj
     set engineers = (select array_agg(case when e = o[1] then n[1] else e end) from unnest(pj.engineers) e),
         lead = case when pj.lead = o[1] then n[1] else pj.lead end
   where pj.source = 'form' and (o[1] = any(pj.engineers) or pj.lead = o[1]);
  if n[1] <> '' then
    insert into public.perf_aliases (alias, user_id, ignored, updated_at)
    values (lower(regexp_replace(n[1], '\s+', ' ', 'g')), p_user, false, now())
    on conflict (alias) do update set user_id = excluded.user_id, ignored = false, updated_at = now()
    where public.perf_aliases.user_id is null or public.perf_aliases.user_id = excluded.user_id;
  end if;
end;
$$;

revoke all on function public.propagate_person_rename(uuid, text, text, text, text) from public, anon, authenticated;

create or replace function public.profiles_rename_propagate()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if coalesce(new.name, '') is distinct from coalesce(old.name, '') or coalesce(new.last_name, '') is distinct from coalesce(old.last_name, '') then
    perform public.propagate_person_rename(new.id, old.last_name, old.name, new.last_name, new.name);
    -- HR бүртгэлийг ижил байлгана (апп-аас өөрөө нэрээ сольсон ч).
    update public.authorized_users a set name = new.name, last_name = new.last_name, updated_at = now()
     where a.linked_user_id = new.id and (a.name is distinct from new.name or a.last_name is distinct from new.last_name);
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_rename_propagate on public.profiles;
create trigger profiles_rename_propagate
after update of name, last_name on public.profiles
for each row execute function public.profiles_rename_propagate();

-- Апп-д бүртгүүлээгүй хүн: гүйцэтгэлийн display_name-ийг шинэчилнэ.
create or replace function public.authorized_users_rename_propagate()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if new.linked_user_id is null and (new.name is distinct from old.name or new.last_name is distinct from old.last_name) then
    update public.perf_aliases set display_name = btrim(coalesce(new.last_name, '') || ' ' || coalesce(new.name, '')), updated_at = now()
     where lower(hr_email) = lower(new.email);
  end if;
  if new.email is distinct from old.email then
    update public.perf_aliases set hr_email = new.email where lower(hr_email) = lower(old.email);
  end if;
  return new;
end;
$$;

drop trigger if exists authorized_users_rename_propagate on public.authorized_users;
create trigger authorized_users_rename_propagate
after update of name, last_name, email on public.authorized_users
for each row execute function public.authorized_users_rename_propagate();

-- ── Ажлаас гаргах / эргүүлж авах, устгах ─────────────────────────────
create or replace function public.hr_actor_guard(p_target_role text)
returns void
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  is_dev boolean := public.is_superadmin();
  actor_rank int;
begin
  if is_dev then return; end if;
  select public.role_rank(p.role) into actor_rank from public.profiles p where p.id = auth.uid();
  if coalesce(actor_rank, 0) < 3 then raise exception 'forbidden'; end if;
  if coalesce((select (p.permissions ->> 'employees')::boolean from public.profiles p where p.id = auth.uid()), true) = false then
    raise exception 'permission_denied';
  end if;
  if p_target_role = 'superadmin' then raise exception 'role_forbidden'; end if;
end;
$$;

create or replace function public.admin_hr_set_active(p_email text, p_active boolean)
returns public.authorized_users
language plpgsql
security definer
set search_path to ''
as $$
declare
  target public.authorized_users%rowtype;
  result public.authorized_users%rowtype;
begin
  select * into target from public.authorized_users a where lower(a.email) = lower(trim(coalesce(p_email, '')));
  if not found then raise exception 'not_found'; end if;
  perform public.hr_actor_guard(target.role);
  if target.linked_user_id = auth.uid() then raise exception 'cannot_change_self'; end if;
  update public.authorized_users a set active = coalesce(p_active, false), updated_at = now()
   where a.email = target.email returning * into result;
  return result;
end;
$$;

-- Устгах: апп-ын данс (auth) болон HR бүртгэлийг бүрмөсөн устгана. Буцаах боломжгүй.
create or replace function public.admin_hr_delete(p_email text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  target public.authorized_users%rowtype;
  superadmins int;
begin
  select * into target from public.authorized_users a where lower(a.email) = lower(trim(coalesce(p_email, '')));
  if not found then raise exception 'not_found'; end if;
  perform public.hr_actor_guard(target.role);
  if target.linked_user_id = auth.uid() then raise exception 'cannot_delete_self'; end if;
  if target.role = 'superadmin' then
    select count(*) into superadmins from public.profiles where role = 'superadmin';
    if superadmins <= 1 then raise exception 'last_superadmin'; end if;
  end if;
  delete from public.authorized_users a where a.email = target.email;
  if target.linked_user_id is not null then
    delete from auth.users where id = target.linked_user_id;
  end if;
  return jsonb_build_object('deleted', target.email, 'user_id', target.linked_user_id);
end;
$$;

revoke all on function public.hr_actor_guard(text) from public, anon;
revoke all on function public.admin_hr_set_active(text, boolean) from public, anon;
revoke all on function public.admin_hr_delete(text) from public, anon;
grant execute on function public.admin_hr_set_active(text, boolean) to authenticated;
grant execute on function public.admin_hr_delete(text) to authenticated;

notify pgrst, 'reload schema';
