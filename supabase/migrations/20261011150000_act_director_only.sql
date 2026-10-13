-- Акт: зөвхөн Захирал (bayasgalan.gennetex@gmail.com) баталгаажуулна.
--
--   • Захирал, sysadmin (superadmin) — бүх акт.
--   • Бусад хүн (энгийн админ, менежер ч гэсэн) — `acts.create` эрх
--     олгогдсон үед л ӨӨРИЙН актаа бичиж, харна. Эрхийн түвшнээр (role_rank)
--     автоматаар нээгдэхээ больсон.
--   • Баталгаажуулах / буцаах — зөвхөн Захирал. Баталгаажуулахад
--     `apply_act_director_stamp` trigger тамгыг Захирлын мөрөнд дарна.

create or replace function public.is_act_director()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and lower(btrim(coalesce(p.email, ''))) = 'bayasgalan.gennetex@gmail.com'
  );
$$;

revoke all on function public.is_act_director() from public, anon;
grant execute on function public.is_act_director() to authenticated;

create or replace function public.act_can(p_action text, p_act_id uuid default null)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_permissions jsonb := '{}'::jsonb;
  v_act public.acts%rowtype;
  v_assigned boolean := false;
  v_can_write boolean := false;
begin
  if v_uid is null then return false; end if;
  select role, coalesce(permissions, '{}'::jsonb)
    into v_role, v_permissions
    from public.profiles where id = v_uid;

  if lower(coalesce(v_role, '')) = 'superadmin' or public.is_act_director() then
    return true;
  end if;
  -- Тусгайлан олгосон нарийн эрх (вэбийн acts.view, acts.stamp г.м).
  -- `acts.create` нь зөвхөн ШИНЭ акт үүсгэх эрх — бусдын актад хамаарахгүй.
  -- (Баталгаажуулалт өөрөө transition_act дотор Захирлаар хязгаарлагдана.)
  if (p_action <> 'create' or p_act_id is null)
     and coalesce((v_permissions ->> ('acts.' || p_action))::boolean, false) then
    return true;
  end if;
  if p_act_id is null then return false; end if;

  select * into v_act from public.acts where id = p_act_id and deleted_at is null;
  if not found then return false; end if;

  -- Акт бичих эрхтэй зохиогч: өөрийн НООРОГ актаа засна (илгээх нь 'edit').
  v_can_write := coalesce((v_permissions ->> 'acts.create')::boolean, false);
  if v_can_write and v_act.created_by = v_uid and v_act.status = 'draft'
     and p_action in ('edit', 'photo') then
    return true;
  end if;

  if v_act.created_by = v_uid then v_assigned := true; end if;
  if not v_assigned and v_act.source_type = 'service_call' then
    select exists (
      select 1 from public.service_calls s
      where s.id = v_act.source_id
        and v_uid in (s.engineer_id, s.partner_engineer_id)
    ) into v_assigned;
  end if;
  if not v_assigned and v_act.source_type = 'site_session' then
    select exists (
      select 1 from public.field_site_sessions s
      where s.id = v_act.source_id
        and (
          s.driver_id = v_uid
          or exists (
            select 1 from jsonb_array_elements(coalesce(s.passengers, '[]'::jsonb)) p
            where p ->> 'id' = v_uid::text
          )
        )
    ) into v_assigned;
  end if;

  return v_assigned and p_action in ('view', 'photo', 'export');
end;
$$;

revoke all on function public.act_can(text, uuid) from public, anon;
grant execute on function public.act_can(text, uuid) to authenticated;

create or replace function public.transition_act(p_act_id uuid, p_action text)
returns public.acts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_act public.acts%rowtype;
  v_old_status text;
  v_status text;
  v_uid uuid := auth.uid();
  v_actor text;
begin
  select * into v_act from public.acts where id = p_act_id and deleted_at is null for update;
  if not found then raise exception 'act_not_found'; end if;
  v_old_status := v_act.status;
  if p_action = 'approve' then
    if not public.is_act_director() then raise exception 'director_only'; end if;
    if exists (select 1 from public.act_checklists where act_id = p_act_id and result = 'no' and nullif(btrim(reason), '') is null) then
      raise exception 'checklist_reason_required';
    end if;
    v_status := 'approved';
  elsif p_action = 'ready' then
    if not public.act_can('edit', p_act_id) then raise exception 'permission_denied'; end if;
    v_status := 'ready';
  elsif p_action = 'return' then
    -- Илгээсэн актыг засуулахаар зохиогч руу буцаана — зөвхөн Захирал.
    if not public.is_act_director() then raise exception 'director_only'; end if;
    if v_act.status <> 'ready' then raise exception 'invalid_transition'; end if;
    v_status := 'draft';
  elsif p_action = 'deliver' then
    if not public.act_can('edit', p_act_id) or v_act.status <> 'approved' then raise exception 'invalid_transition'; end if;
    v_status := 'delivered';
  elsif p_action = 'cancel' then
    if not public.act_can('edit', p_act_id) then raise exception 'permission_denied'; end if;
    v_status := 'cancelled';
  elsif p_action = 'archive' then
    if not public.act_can('archive', p_act_id) then raise exception 'permission_denied'; end if;
    v_status := 'archived';
  else raise exception 'invalid_transition'; end if;

  select coalesce(nullif(btrim(name), ''), email, 'ERP хэрэглэгч') into v_actor
  from public.profiles where id = v_uid;
  update public.acts set
    status = v_status,
    approved_by = case when v_status = 'approved' then v_uid else approved_by end,
    approved_by_name = case when v_status = 'approved' then v_actor else approved_by_name end,
    approved_at = case when v_status = 'approved' then now() else approved_at end,
    delivered_at = case when v_status = 'delivered' then now() else delivered_at end,
    archived_at = case when v_status = 'archived' then now() else archived_at end,
    updated_at = now(), version = version + 1
  where id = p_act_id returning * into v_act;
  insert into public.act_audit_logs(act_id, actor_id, actor_name, event_type, detail)
  values (p_act_id, v_uid, v_actor, case when v_status = 'draft' then 'returned' else v_status end,
          jsonb_build_object('from', v_old_status, 'to', v_status));
  return v_act;
end;
$$;

revoke all on function public.transition_act(uuid, text) from public, anon;
grant execute on function public.transition_act(uuid, text) to authenticated;

notify pgrst, 'reload schema';
