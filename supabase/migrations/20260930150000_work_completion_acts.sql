-- Gennetex ERP — Ажил гүйцэтгэлийн акт
-- Existing project/work sources are service_calls and field_site_sessions.
-- The act stores immutable snapshots; approved/delivered documents are never
-- rendered from live ERP rows.

create table if not exists public.act_number_sequences (
  year integer primary key,
  last_value integer not null default 0 check (last_value >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.act_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  title text not null default 'Ажил гүйцэтгэлийн акт',
  company text not null default 'Женнетекс ХХК',
  logo_url text,
  project_types text[] not null default '{}',
  configuration jsonb not null default '{}'::jsonb,
  photo_layout smallint not null default 1 check (photo_layout in (1, 2, 4)),
  footer_text text not null default 'Ажил хүлээлцэх акт',
  is_default boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists act_templates_one_default_idx
  on public.act_templates ((is_default)) where is_default;

create table if not exists public.acts (
  id uuid primary key default gen_random_uuid(),
  act_number text not null unique,
  template_id uuid references public.act_templates(id) on delete restrict,
  source_type text not null default 'manual'
    check (source_type in ('service_call', 'site_session', 'manual')),
  source_id uuid,
  act_type text not null default 'work_completion'
    check (act_type in ('work_completion', 'work_handover')),
  project_name text,
  project_type text,
  location text,
  contractor_name text not null default 'Женнетекс ХХК',
  customer_name text,
  work_description text,
  start_date date,
  end_date date,
  photo_layout smallint not null default 1 check (photo_layout in (1, 2, 4)),
  status text not null default 'draft'
    check (status in ('draft', 'ready', 'approved', 'delivered', 'cancelled', 'archived')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_by_name text,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_by_name text,
  approved_at timestamptz,
  delivered_at timestamptz,
  archived_at timestamptz,
  deleted_at timestamptz,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_date is null or end_date is null or end_date >= start_date),
  check ((source_type = 'manual' and source_id is null) or source_type <> 'manual')
);

create index if not exists acts_source_idx on public.acts (source_type, source_id);
create index if not exists acts_status_created_idx on public.acts (status, created_at desc) where deleted_at is null;
create index if not exists acts_created_by_idx on public.acts (created_by, created_at desc) where deleted_at is null;

create table if not exists public.act_materials (
  id uuid primary key default gen_random_uuid(),
  act_id uuid not null references public.acts(id) on delete cascade,
  material_id uuid references public.inventory(id) on delete set null,
  material_name text not null,
  unit text not null default 'ширхэг',
  quantity numeric not null default 0 check (quantity >= 0),
  source_transaction_id uuid references public.stock_movements(id) on delete set null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists act_materials_act_idx on public.act_materials (act_id, sort_order);

create table if not exists public.act_checklists (
  id uuid primary key default gen_random_uuid(),
  act_id uuid not null references public.acts(id) on delete cascade,
  requirement text not null,
  result text not null default 'na' check (result in ('yes', 'no', 'na')),
  reason text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists act_checklists_act_idx on public.act_checklists (act_id, sort_order);

create table if not exists public.act_receivers (
  id uuid primary key default gen_random_uuid(),
  act_id uuid not null references public.acts(id) on delete cascade,
  type text not null check (type in ('customer', 'site', 'contractor')),
  organization text,
  employee_id uuid references public.profiles(id) on delete set null,
  name text,
  position text,
  signature_url text,
  stamp_url text,
  signature_mode text not null default 'none' check (signature_mode in ('upload', 'draw', 'none')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists act_receivers_act_idx on public.act_receivers (act_id, sort_order);

create table if not exists public.act_photos (
  id uuid primary key default gen_random_uuid(),
  act_id uuid not null references public.acts(id) on delete cascade,
  storage_path text,
  image_url text,
  caption text,
  taken_at timestamptz,
  taken_by_employee_id uuid references public.profiles(id) on delete set null,
  taken_by_employee_name text,
  source_kind text not null default 'upload'
    check (source_kind in ('upload', 'service_call', 'site_session', 'visit_log', 'attendance', 'work_log')),
  source_id text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  check (nullif(storage_path, '') is not null or nullif(image_url, '') is not null)
);

create index if not exists act_photos_act_idx on public.act_photos (act_id, sort_order);

create table if not exists public.act_audit_logs (
  id bigint generated always as identity primary key,
  act_id uuid not null references public.acts(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_name text,
  event_type text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists act_audit_logs_act_idx on public.act_audit_logs (act_id, created_at desc);

-- Future inventory transactions can be linked to the exact ERP source. Existing
-- rows stay untouched; service_calls.close_meta.materials remains the historic source.
alter table public.stock_movements
  add column if not exists service_call_id uuid references public.service_calls(id) on delete set null,
  add column if not exists site_session_id uuid references public.field_site_sessions(id) on delete set null;

create index if not exists stock_movements_service_call_idx
  on public.stock_movements (service_call_id, created_at desc) where service_call_id is not null;
create index if not exists stock_movements_site_session_idx
  on public.stock_movements (site_session_id, created_at desc) where site_session_id is not null;

insert into public.act_templates
  (name, title, company, project_types, configuration, photo_layout, footer_text, is_default)
values (
  'Gennetex - Ажил гүйцэтгэлийн акт',
  'Ажил гүйцэтгэлийн акт',
  'Женнетекс ХХК',
  array['fiber_optic', 'general'],
  jsonb_build_object(
    'fields', jsonb_build_array(
      'location', 'contractor_name', 'customer_name', 'work_description', 'start_date', 'end_date'
    ),
    'checklist', jsonb_build_array(
      'Даалгаврын дагуу шилэн кабель татсан эсэх',
      'Газрыг 80-100 см ухсан эсэх',
      'Зам хөндлөн гарахдаа даацын хоолой хийсэн эсэх',
      'Шилэн кабелийн тууз хийсэн эсэх',
      'Кабелийг булахдаа газраас дээш нуруулдаж татсан эсэх',
      'Худагийг зөв байрлуулж, суурилуулсан эсэх',
      'Муфт дээр унтралтгүй залгасан эсэх',
      'Конвейр дээр кабелийг зөв татсан эсэх',
      'Станцын дотор кабелийг зааврын дагуу зөв татсан эсэх',
      'FDF дээр унтралтгүй залгаа хийж тестэлсэн эсэх',
      'Тухайн объектууд руу кабелийг оруулсан эсэх'
    ),
    'signature_sections', jsonb_build_array('customer', 'site', 'contractor'),
    'tagline', 'Generation of Network Experts'
  ),
  1,
  'Ажил хүлээлцэх акт',
  true
)
on conflict (name) do nothing;

create or replace function public.next_act_number(p_year integer default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_year integer := coalesce(p_year, extract(year from timezone('Asia/Ulaanbaatar', now()))::integer);
  v_value integer;
begin
  insert into public.act_number_sequences(year, last_value, updated_at)
  values (v_year, 1, now())
  on conflict (year) do update
    set last_value = public.act_number_sequences.last_value + 1,
        updated_at = now()
  returning last_value into v_value;
  return 'ACT-' || v_year::text || '-' || lpad(v_value::text, 4, '0');
end;
$$;

revoke all on function public.next_act_number(integer) from public, anon, authenticated;

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
  v_rank integer := 0;
  v_permissions jsonb := '{}'::jsonb;
  v_act public.acts%rowtype;
  v_assigned boolean := false;
begin
  if v_uid is null then return false; end if;
  select role, coalesce(permissions, '{}'::jsonb)
    into v_role, v_permissions
    from public.profiles where id = v_uid;
  v_rank := public.role_rank(v_role);

  if v_rank >= 3 or coalesce((v_permissions ->> ('acts.' || p_action))::boolean, false) then
    return true;
  end if;
  if p_action in ('view', 'create', 'edit', 'approve', 'photo', 'export', 'duplicate', 'archive')
     and v_rank >= 2 then
    return true;
  end if;
  if p_act_id is null then return false; end if;

  select * into v_act from public.acts where id = p_act_id and deleted_at is null;
  if not found then return false; end if;
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

create or replace function public.list_act_sources()
returns table (
  source_type text,
  source_id uuid,
  project_name text,
  customer_name text,
  location text,
  work_description text,
  start_date date,
  end_date date,
  project_type text,
  source_status text
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select p.id, public.role_rank(p.role) as rank
    from public.profiles p where p.id = auth.uid()
  )
  select 'service_call'::text, s.id,
    coalesce(nullif(s.customer, ''), nullif(s.address, ''), 'Ажлын захиалга'),
    s.customer, s.address, s.problem,
    coalesce(s.scheduled_at, s.created_at)::date,
    coalesce(nullif(s.close_meta ->> 'closed_at', '')::timestamptz, s.updated_at, s.created_at)::date,
    coalesce(nullif(s.call_type, ''), 'general'), s.status
  from public.service_calls s cross join me
  where me.rank >= 2 or auth.uid() in (s.engineer_id, s.partner_engineer_id)
  union all
  select 'site_session'::text, f.id, f.site_name,
    coalesce(c.customer, f.site_name), f.site_address, coalesce(f.work_note, c.problem),
    coalesce(f.arrived_at, f.created_at)::date,
    coalesce(f.departed_at, f.submitted_at, f.created_at)::date,
    coalesce(c.call_type, 'general'), f.status
  from public.field_site_sessions f
  left join public.service_calls c on c.id = f.call_id
  cross join me
  where me.rank >= 2
     or f.driver_id = auth.uid()
     or exists (
       select 1 from jsonb_array_elements(coalesce(f.passengers, '[]'::jsonb)) p
       where p ->> 'id' = auth.uid()::text
     )
  order by 7 desc nulls last, 3;
$$;

revoke all on function public.list_act_sources() from public, anon;
grant execute on function public.list_act_sources() to authenticated;

create or replace function public.get_act_source_snapshot(p_source_type text, p_source_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_materials jsonb := '[]'::jsonb;
  v_photos jsonb := '[]'::jsonb;
  v_call public.service_calls%rowtype;
  v_site public.field_site_sessions%rowtype;
begin
  if not exists (
    select 1 from public.list_act_sources() s
    where s.source_type = p_source_type and s.source_id = p_source_id
  ) then raise exception 'permission_denied'; end if;

  if p_source_type = 'service_call' then
    select * into strict v_call from public.service_calls where id = p_source_id;
    v_materials := coalesce(v_call.close_meta -> 'materials', '[]'::jsonb);
    select v_materials || coalesce(jsonb_agg(jsonb_build_object(
      'id', m.item_id, 'name', m.item_name, 'unit', m.unit,
      'qty', m.quantity, 'transaction_id', m.id
    ) order by m.created_at), '[]'::jsonb)
    into v_materials
    from public.stock_movements m
    where m.service_call_id = p_source_id and m.movement_type in ('withdraw', 'consume');

    v_photos := coalesce(v_call.close_meta -> 'photos', v_call.close_meta #> '{workflow,photos}', '[]'::jsonb);
    select v_photos || coalesce(jsonb_agg(jsonb_build_object(
      'url', v.photo_url, 'caption', coalesce(v.location_name, v.customer),
      'taken_at', v.arrived_at, 'employee_name', v.user_name,
      'source_kind', 'visit_log', 'source_id', v.id
    ) order by v.arrived_at) filter (where v.photo_url is not null), '[]'::jsonb)
    into v_photos
    from public.visit_logs v where v.call_id = p_source_id::text;

    v_result := jsonb_build_object(
      'source_type', p_source_type, 'source_id', p_source_id,
      'project_name', coalesce(v_call.customer, v_call.address),
      'project_type', coalesce(v_call.call_type, 'general'),
      'customer_name', v_call.customer, 'location', v_call.address,
      'work_description', v_call.problem,
      'start_date', coalesce(v_call.scheduled_at, v_call.created_at)::date,
      'end_date', coalesce(nullif(v_call.close_meta ->> 'closed_at', '')::timestamptz, v_call.updated_at, v_call.created_at)::date,
      'materials', coalesce(v_materials, '[]'::jsonb), 'photos', coalesce(v_photos, '[]'::jsonb)
    );
  elsif p_source_type = 'site_session' then
    select * into strict v_site from public.field_site_sessions where id = p_source_id;
    if v_site.call_id is not null then
      select * into v_call from public.service_calls where id = v_site.call_id;
      v_materials := coalesce(v_call.close_meta -> 'materials', '[]'::jsonb);
      v_photos := coalesce(v_call.close_meta -> 'photos', v_call.close_meta #> '{workflow,photos}', '[]'::jsonb);
    end if;
    select v_materials || coalesce(jsonb_agg(jsonb_build_object(
      'id', m.item_id, 'name', m.item_name, 'unit', m.unit,
      'qty', m.quantity, 'transaction_id', m.id
    ) order by m.created_at), '[]'::jsonb)
    into v_materials
    from public.stock_movements m
    where m.site_session_id = p_source_id and m.movement_type in ('withdraw', 'consume');
    if v_site.photo_url is not null then
      v_photos := v_photos || jsonb_build_array(jsonb_build_object(
        'url', v_site.photo_url, 'caption', v_site.site_name,
        'taken_at', coalesce(v_site.submitted_at, v_site.arrived_at, v_site.created_at),
        'employee_name', v_site.driver_name, 'source_kind', 'site_session', 'source_id', v_site.id
      ));
    end if;
    v_result := jsonb_build_object(
      'source_type', p_source_type, 'source_id', p_source_id,
      'project_name', v_site.site_name,
      'project_type', coalesce(v_call.call_type, 'general'),
      'customer_name', coalesce(v_call.customer, v_site.site_name),
      'location', v_site.site_address,
      'work_description', coalesce(v_site.work_note, v_call.problem),
      'start_date', coalesce(v_site.arrived_at, v_site.created_at)::date,
      'end_date', coalesce(v_site.departed_at, v_site.submitted_at, v_site.created_at)::date,
      'materials', coalesce(v_materials, '[]'::jsonb), 'photos', coalesce(v_photos, '[]'::jsonb)
    );
  else
    raise exception 'invalid_source_type';
  end if;
  return v_result;
end;
$$;

revoke all on function public.get_act_source_snapshot(text, uuid) from public, anon;
grant execute on function public.get_act_source_snapshot(text, uuid) to authenticated;

create or replace function public.save_act(p_act_id uuid, p_payload jsonb, p_force_approved_edit boolean default false)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := p_act_id;
  v_uid uuid := auth.uid();
  v_actor text;
  v_template uuid;
  v_status text;
  v_old_materials jsonb;
  v_old_checklist jsonb;
  v_item jsonb;
  v_order integer;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select coalesce(nullif(btrim(name), ''), email, 'ERP хэрэглэгч') into v_actor
  from public.profiles where id = v_uid;

  if v_id is null then
    if not public.act_can('create', null) then raise exception 'permission_denied'; end if;
    v_id := gen_random_uuid();
    v_template := nullif(p_payload ->> 'template_id', '')::uuid;
    if v_template is null then select id into v_template from public.act_templates where is_default limit 1; end if;
    insert into public.acts (
      id, act_number, template_id, source_type, source_id, act_type,
      project_name, project_type, location, contractor_name, customer_name,
      work_description, start_date, end_date, photo_layout, created_by, created_by_name
    ) values (
      v_id, public.next_act_number(null), v_template,
      coalesce(nullif(p_payload ->> 'source_type', ''), 'manual'),
      nullif(p_payload ->> 'source_id', '')::uuid,
      coalesce(nullif(p_payload ->> 'act_type', ''), 'work_completion'),
      nullif(p_payload ->> 'project_name', ''), nullif(p_payload ->> 'project_type', ''),
      nullif(p_payload ->> 'location', ''), coalesce(nullif(p_payload ->> 'contractor_name', ''), 'Женнетекс ХХК'),
      nullif(p_payload ->> 'customer_name', ''), nullif(p_payload ->> 'work_description', ''),
      nullif(p_payload ->> 'start_date', '')::date, nullif(p_payload ->> 'end_date', '')::date,
      coalesce((p_payload ->> 'photo_layout')::smallint, 1), v_uid, v_actor
    );
    insert into public.act_audit_logs(act_id, actor_id, actor_name, event_type)
    values (v_id, v_uid, v_actor, 'created');
  else
    select status into v_status from public.acts where id = v_id and deleted_at is null for update;
    if not found then raise exception 'act_not_found'; end if;
    if not public.act_can('edit', v_id) then raise exception 'permission_denied'; end if;
    if v_status in ('approved', 'delivered') and not (
      p_force_approved_edit and public.act_can('delete', v_id)
    ) then raise exception 'approved_act_locked'; end if;
    select coalesce(jsonb_agg(to_jsonb(m) - 'id' - 'act_id' - 'created_at' order by sort_order), '[]'::jsonb)
      into v_old_materials from public.act_materials m where act_id = v_id;
    select coalesce(jsonb_agg(to_jsonb(c) - 'id' - 'act_id' - 'created_at' order by sort_order), '[]'::jsonb)
      into v_old_checklist from public.act_checklists c where act_id = v_id;

    v_template := nullif(p_payload ->> 'template_id', '')::uuid;
    update public.acts set
      template_id = coalesce(v_template, template_id),
      source_type = coalesce(nullif(p_payload ->> 'source_type', ''), source_type),
      source_id = case when p_payload ? 'source_id' then nullif(p_payload ->> 'source_id', '')::uuid else source_id end,
      act_type = coalesce(nullif(p_payload ->> 'act_type', ''), act_type),
      project_name = nullif(p_payload ->> 'project_name', ''),
      project_type = nullif(p_payload ->> 'project_type', ''),
      location = nullif(p_payload ->> 'location', ''),
      contractor_name = coalesce(nullif(p_payload ->> 'contractor_name', ''), 'Женнетекс ХХК'),
      customer_name = nullif(p_payload ->> 'customer_name', ''),
      work_description = nullif(p_payload ->> 'work_description', ''),
      start_date = nullif(p_payload ->> 'start_date', '')::date,
      end_date = nullif(p_payload ->> 'end_date', '')::date,
      photo_layout = coalesce((p_payload ->> 'photo_layout')::smallint, photo_layout),
      version = version + 1,
      updated_at = now()
    where id = v_id;
  end if;

  delete from public.act_materials where act_id = v_id;
  v_order := 0;
  for v_item in select value from jsonb_array_elements(coalesce(p_payload -> 'materials', '[]'::jsonb)) loop
    insert into public.act_materials(act_id, material_id, material_name, unit, quantity, source_transaction_id, sort_order)
    values (
      v_id, nullif(v_item ->> 'material_id', '')::uuid,
      coalesce(nullif(v_item ->> 'material_name', ''), 'Нэргүй материал'),
      coalesce(nullif(v_item ->> 'unit', ''), 'ширхэг'),
      greatest(coalesce(nullif(v_item ->> 'quantity', '')::numeric, 0), 0),
      nullif(v_item ->> 'source_transaction_id', '')::uuid, v_order
    );
    v_order := v_order + 1;
  end loop;

  delete from public.act_checklists where act_id = v_id;
  v_order := 0;
  for v_item in select value from jsonb_array_elements(coalesce(p_payload -> 'checklists', '[]'::jsonb)) loop
    insert into public.act_checklists(act_id, requirement, result, reason, sort_order)
    values (
      v_id, coalesce(nullif(v_item ->> 'requirement', ''), 'Шаардлага'),
      coalesce(nullif(v_item ->> 'result', ''), 'na'), nullif(v_item ->> 'reason', ''), v_order
    );
    v_order := v_order + 1;
  end loop;

  delete from public.act_receivers where act_id = v_id;
  v_order := 0;
  for v_item in select value from jsonb_array_elements(coalesce(p_payload -> 'receivers', '[]'::jsonb)) loop
    insert into public.act_receivers(
      act_id, type, organization, employee_id, name, position,
      signature_url, stamp_url, signature_mode, sort_order
    ) values (
      v_id, v_item ->> 'type', nullif(v_item ->> 'organization', ''),
      nullif(v_item ->> 'employee_id', '')::uuid, nullif(v_item ->> 'name', ''),
      nullif(v_item ->> 'position', ''), nullif(v_item ->> 'signature_url', ''),
      nullif(v_item ->> 'stamp_url', ''), coalesce(nullif(v_item ->> 'signature_mode', ''), 'none'), v_order
    );
    v_order := v_order + 1;
  end loop;

  delete from public.act_photos where act_id = v_id;
  v_order := 0;
  for v_item in select value from jsonb_array_elements(coalesce(p_payload -> 'photos', '[]'::jsonb)) loop
    insert into public.act_photos(
      act_id, storage_path, image_url, caption, taken_at,
      taken_by_employee_id, taken_by_employee_name, source_kind, source_id, sort_order
    ) values (
      v_id, nullif(v_item ->> 'storage_path', ''), nullif(v_item ->> 'image_url', ''),
      nullif(v_item ->> 'caption', ''), nullif(v_item ->> 'taken_at', '')::timestamptz,
      nullif(v_item ->> 'taken_by_employee_id', '')::uuid,
      nullif(v_item ->> 'taken_by_employee_name', ''),
      coalesce(nullif(v_item ->> 'source_kind', ''), 'upload'),
      nullif(v_item ->> 'source_id', ''), v_order
    );
    v_order := v_order + 1;
  end loop;

  if p_act_id is not null then
    if coalesce(v_old_materials, '[]'::jsonb) <> coalesce(p_payload -> 'materials', '[]'::jsonb) then
      insert into public.act_audit_logs(act_id, actor_id, actor_name, event_type)
      values (v_id, v_uid, v_actor, 'materials_updated');
    end if;
    if coalesce(v_old_checklist, '[]'::jsonb) <> coalesce(p_payload -> 'checklists', '[]'::jsonb) then
      insert into public.act_audit_logs(act_id, actor_id, actor_name, event_type)
      values (v_id, v_uid, v_actor, 'checklist_updated');
    end if;
  end if;
  return v_id;
end;
$$;

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
    if not public.act_can('approve', p_act_id) then raise exception 'permission_denied'; end if;
    if exists (select 1 from public.act_checklists where act_id = p_act_id and result = 'no' and nullif(btrim(reason), '') is null) then
      raise exception 'checklist_reason_required';
    end if;
    v_status := 'approved';
  elsif p_action = 'ready' then
    if not public.act_can('edit', p_act_id) then raise exception 'permission_denied'; end if;
    v_status := 'ready';
  elsif p_action = 'deliver' then
    if not public.act_can('approve', p_act_id) or v_act.status <> 'approved' then raise exception 'invalid_transition'; end if;
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
  values (p_act_id, v_uid, v_actor, v_status, jsonb_build_object('from', v_old_status, 'to', v_status));
  return v_act;
end;
$$;

-- Assigned employees may append work evidence without receiving permission to
-- alter the act snapshot itself. Approved/delivered snapshots remain locked.
create or replace function public.add_act_photo(p_act_id uuid, p_photo jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := gen_random_uuid();
  v_uid uuid := auth.uid();
  v_actor text;
  v_status text;
  v_order integer;
begin
  if not public.act_can('photo', p_act_id) then raise exception 'permission_denied'; end if;
  select status into v_status from public.acts where id = p_act_id and deleted_at is null for update;
  if not found then raise exception 'act_not_found'; end if;
  if v_status in ('approved', 'delivered', 'archived') then raise exception 'approved_act_locked'; end if;
  if nullif(p_photo ->> 'storage_path', '') is null and nullif(p_photo ->> 'image_url', '') is null then
    raise exception 'photo_required';
  end if;
  select coalesce(max(sort_order), -1) + 1 into v_order from public.act_photos where act_id = p_act_id;
  insert into public.act_photos(
    id, act_id, storage_path, image_url, caption, taken_at,
    taken_by_employee_id, taken_by_employee_name, source_kind, source_id, sort_order
  ) values (
    v_id, p_act_id, nullif(p_photo ->> 'storage_path', ''), nullif(p_photo ->> 'image_url', ''),
    nullif(p_photo ->> 'caption', ''), nullif(p_photo ->> 'taken_at', '')::timestamptz,
    coalesce(nullif(p_photo ->> 'taken_by_employee_id', '')::uuid, v_uid),
    nullif(p_photo ->> 'taken_by_employee_name', ''),
    coalesce(nullif(p_photo ->> 'source_kind', ''), 'upload'), nullif(p_photo ->> 'source_id', ''), v_order
  );
  select coalesce(nullif(btrim(name), ''), email, 'ERP хэрэглэгч') into v_actor
  from public.profiles where id = v_uid;
  insert into public.act_audit_logs(act_id, actor_id, actor_name, event_type, detail)
  values (p_act_id, v_uid, v_actor, 'photo_added', jsonb_build_object('photo_id', v_id));
  return v_id;
end;
$$;

create or replace function public.duplicate_act(p_act_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.acts%rowtype;
  v_new uuid := gen_random_uuid();
  v_uid uuid := auth.uid();
  v_actor text;
begin
  if not public.act_can('duplicate', p_act_id) or not public.act_can('create', null) then raise exception 'permission_denied'; end if;
  select * into strict v_old from public.acts where id = p_act_id and deleted_at is null;
  select coalesce(nullif(btrim(name), ''), email, 'ERP хэрэглэгч') into v_actor from public.profiles where id = v_uid;
  insert into public.acts(
    id, act_number, template_id, source_type, source_id, act_type, project_name,
    project_type, location, contractor_name, customer_name, work_description,
    start_date, end_date, photo_layout, status, created_by, created_by_name
  ) values (
    v_new, public.next_act_number(null), v_old.template_id, v_old.source_type, v_old.source_id,
    v_old.act_type, v_old.project_name, v_old.project_type, v_old.location,
    v_old.contractor_name, v_old.customer_name, v_old.work_description,
    current_date, current_date, v_old.photo_layout, 'draft', v_uid, v_actor
  );
  insert into public.act_materials(act_id, material_id, material_name, unit, quantity, source_transaction_id, sort_order)
    select v_new, material_id, material_name, unit, quantity, source_transaction_id, sort_order
    from public.act_materials where act_id = p_act_id;
  insert into public.act_checklists(act_id, requirement, result, reason, sort_order)
    select v_new, requirement, 'na', null, sort_order from public.act_checklists where act_id = p_act_id;
  insert into public.act_receivers(act_id, type, organization, employee_id, name, position, signature_mode, sort_order)
    select v_new, type, organization, employee_id, name, position, 'none', sort_order
    from public.act_receivers where act_id = p_act_id;
  insert into public.act_audit_logs(act_id, actor_id, actor_name, event_type, detail)
    values (v_new, v_uid, v_actor, 'duplicated', jsonb_build_object('source_act_id', p_act_id));
  return v_new;
end;
$$;

create or replace function public.delete_act(p_act_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.act_can('delete', p_act_id) then raise exception 'permission_denied'; end if;
  update public.acts set deleted_at = now(), updated_at = now() where id = p_act_id and deleted_at is null;
end;
$$;

create or replace function public.log_act_export(p_act_id uuid, p_format text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_actor text;
begin
  if not public.act_can('export', p_act_id) then raise exception 'permission_denied'; end if;
  select coalesce(nullif(btrim(name), ''), email, 'ERP хэрэглэгч') into v_actor from public.profiles where id = auth.uid();
  insert into public.act_audit_logs(act_id, actor_id, actor_name, event_type, detail)
  values (p_act_id, auth.uid(), v_actor, 'exported', jsonb_build_object('format', lower(p_format)));
end;
$$;

create or replace function public.save_act_template(p_template_id uuid, p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid := coalesce(p_template_id, gen_random_uuid());
begin
  if not public.act_can('templates', null) then raise exception 'permission_denied'; end if;
  if coalesce((p_payload ->> 'is_default')::boolean, false) then
    update public.act_templates set is_default = false where is_default;
  end if;
  insert into public.act_templates(
    id, name, title, company, logo_url, project_types, configuration,
    photo_layout, footer_text, is_default, created_by
  ) values (
    v_id, p_payload ->> 'name', coalesce(nullif(p_payload ->> 'title', ''), 'Ажил гүйцэтгэлийн акт'),
    coalesce(nullif(p_payload ->> 'company', ''), 'Женнетекс ХХК'), nullif(p_payload ->> 'logo_url', ''),
    coalesce(array(select jsonb_array_elements_text(p_payload -> 'project_types')), '{}'),
    coalesce(p_payload -> 'configuration', '{}'::jsonb),
    coalesce((p_payload ->> 'photo_layout')::smallint, 1),
    coalesce(nullif(p_payload ->> 'footer_text', ''), 'Ажил хүлээлцэх акт'),
    coalesce((p_payload ->> 'is_default')::boolean, false), auth.uid()
  )
  on conflict (id) do update set
    name = excluded.name, title = excluded.title, company = excluded.company,
    logo_url = excluded.logo_url, project_types = excluded.project_types,
    configuration = excluded.configuration, photo_layout = excluded.photo_layout,
    footer_text = excluded.footer_text, is_default = excluded.is_default, updated_at = now();
  return v_id;
end;
$$;

alter table public.act_number_sequences enable row level security;
alter table public.act_templates enable row level security;
alter table public.acts enable row level security;
alter table public.act_materials enable row level security;
alter table public.act_checklists enable row level security;
alter table public.act_receivers enable row level security;
alter table public.act_photos enable row level security;
alter table public.act_audit_logs enable row level security;

create policy act_templates_select on public.act_templates for select to authenticated using (true);
create policy acts_select on public.acts for select to authenticated using (deleted_at is null and public.act_can('view', id));
create policy act_materials_select on public.act_materials for select to authenticated using (public.act_can('view', act_id));
create policy act_checklists_select on public.act_checklists for select to authenticated using (public.act_can('view', act_id));
create policy act_receivers_select on public.act_receivers for select to authenticated using (public.act_can('view', act_id));
create policy act_photos_select on public.act_photos for select to authenticated using (public.act_can('view', act_id));
create policy act_audit_logs_select on public.act_audit_logs for select to authenticated using (public.act_can('view', act_id));

revoke all on public.act_number_sequences from anon, authenticated;
revoke all on public.act_templates, public.acts, public.act_materials, public.act_checklists,
  public.act_receivers, public.act_photos, public.act_audit_logs from anon, authenticated;
grant select on public.act_templates, public.acts, public.act_materials, public.act_checklists,
  public.act_receivers, public.act_photos, public.act_audit_logs to authenticated;

grant execute on function public.save_act(uuid, jsonb, boolean) to authenticated;
grant execute on function public.transition_act(uuid, text) to authenticated;
grant execute on function public.add_act_photo(uuid, jsonb) to authenticated;
grant execute on function public.duplicate_act(uuid) to authenticated;
grant execute on function public.delete_act(uuid) to authenticated;
grant execute on function public.log_act_export(uuid, text) to authenticated;
grant execute on function public.save_act_template(uuid, jsonb) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'act-files', 'act-files', false, 20971520,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy act_files_select on storage.objects for select to authenticated
using (
  bucket_id = 'act-files'
  and public.act_can('view', nullif((storage.foldername(name))[1], '')::uuid)
);
create policy act_files_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'act-files'
  and public.act_can('photo', nullif((storage.foldername(name))[1], '')::uuid)
);
create policy act_files_update on storage.objects for update to authenticated
using (
  bucket_id = 'act-files'
  and public.act_can('edit', nullif((storage.foldername(name))[1], '')::uuid)
)
with check (
  bucket_id = 'act-files'
  and public.act_can('edit', nullif((storage.foldername(name))[1], '')::uuid)
);
create policy act_files_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'act-files'
  and public.act_can('edit', nullif((storage.foldername(name))[1], '')::uuid)
);

notify pgrst, 'reload schema';
