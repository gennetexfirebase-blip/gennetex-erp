-- ХАБЭА — Өндөрт ажиллах эрсдэлийн үнэлгээ
-- Төлөв шилжилт, зөвшөөрөл, audit trail болон зураг нотолгооны private bucket.

create extension if not exists pgcrypto;

create table if not exists public.work_height_assessments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete restrict,
  employee_name text not null,
  employee_code text,
  department_id uuid references public.departments(id) on delete set null,
  location_id uuid references public.attendance_locations(id) on delete set null,
  location_name text not null,
  latitude double precision,
  longitude double precision,
  height_m numeric(8,2) not null check (height_m > 0 and height_m <= 1000),
  work_type text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  weather text not null,
  partner_ids uuid[] not null default '{}',
  partner_names text[] not null default '{}',
  equipment text[] not null default '{}',
  notes text,
  status text not null default 'draft' check (status in (
    'draft', 'pending_review', 'changes_required', 'hse_approved',
    'management_approved', 'in_progress', 'completed', 'stopped'
  )),
  max_risk_score integer not null default 0 check (max_risk_score between 0 and 25),
  ppe_complete boolean not null default false,
  revision integer not null default 1,
  created_by uuid not null references public.profiles(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  hse_approved_at timestamptz,
  management_approved_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  stopped_at timestamptz,
  constraint work_height_dates_valid check (ends_at > starts_at)
);

create index if not exists work_height_assessments_employee_idx
  on public.work_height_assessments(employee_id, created_at desc);
create index if not exists work_height_assessments_status_idx
  on public.work_height_assessments(status, starts_at desc);
create index if not exists work_height_assessments_location_idx
  on public.work_height_assessments(location_id, starts_at desc);

create table if not exists public.work_height_hazards (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.work_height_assessments(id) on delete cascade,
  hazard_type text not null,
  description text not null,
  likelihood smallint not null check (likelihood between 1 and 5),
  consequence smallint not null check (consequence between 1 and 5),
  risk_score smallint generated always as (likelihood * consequence) stored,
  control_measure text not null,
  residual_likelihood smallint check (residual_likelihood between 1 and 5),
  residual_consequence smallint check (residual_consequence between 1 and 5),
  residual_score smallint generated always as (
    case when residual_likelihood is null or residual_consequence is null then null
         else residual_likelihood * residual_consequence end
  ) stored,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists work_height_hazards_assessment_idx
  on public.work_height_hazards(assessment_id, sort_order);

create table if not exists public.work_height_ppe_checks (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.work_height_assessments(id) on delete cascade,
  item_key text not null,
  item_label text not null,
  required boolean not null default true,
  passed boolean not null default false,
  note text,
  checked_by uuid references public.profiles(id) on delete set null,
  checked_at timestamptz,
  unique (assessment_id, item_key)
);

create table if not exists public.work_height_evidence (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid references public.work_height_assessments(id) on delete cascade,
  incident_id uuid,
  evidence_type text not null default 'ppe' check (evidence_type in ('ppe', 'site', 'incident', 'resolution')),
  storage_path text not null unique,
  mime_type text not null default 'image/jpeg',
  caption text,
  uploaded_by uuid not null references public.profiles(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  check (assessment_id is not null or incident_id is not null)
);

create table if not exists public.work_height_incidents (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid references public.work_height_assessments(id) on delete set null,
  reporter_id uuid not null references public.profiles(id) on delete restrict default auth.uid(),
  reporter_name text not null,
  incident_type text not null check (incident_type in ('unsafe_condition', 'near_miss', 'accident')),
  severity text not null check (severity in ('low', 'medium', 'serious', 'critical')),
  description text not null,
  location_name text not null,
  latitude double precision,
  longitude double precision,
  occurred_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open', 'investigating', 'resolved', 'closed')),
  resolution text,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.work_height_evidence
  drop constraint if exists work_height_evidence_incident_id_fkey;
alter table public.work_height_evidence
  add constraint work_height_evidence_incident_id_fkey
  foreign key (incident_id) references public.work_height_incidents(id) on delete cascade;
create index if not exists work_height_incidents_open_idx
  on public.work_height_incidents(status, severity, occurred_at desc);

create table if not exists public.work_height_audit (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.work_height_assessments(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_name text not null,
  action text not null,
  from_status text,
  to_status text,
  note text,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists work_height_audit_assessment_idx
  on public.work_height_audit(assessment_id, created_at);

create table if not exists public.work_height_approvals (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.work_height_assessments(id) on delete cascade,
  stage text not null check (stage in ('hse', 'management')),
  decision text not null check (decision in ('approved', 'changes_required', 'stopped')),
  approver_id uuid not null references public.profiles(id) on delete restrict,
  approver_name text not null,
  note text,
  created_at timestamptz not null default now()
);

create or replace function public.can_review_work_height()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.my_rank() >= 1 or public.has_permission('approve');
$$;
revoke all on function public.can_review_work_height() from public, anon;
grant execute on function public.can_review_work_height() to authenticated;

create or replace function public.can_view_work_height(p_assessment_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.work_height_assessments a
    where a.id = p_assessment_id
      and (
        a.employee_id = auth.uid() or a.created_by = auth.uid()
        or auth.uid() = any(a.partner_ids)
        or public.can_review_work_height()
      )
  );
$$;
revoke all on function public.can_view_work_height(uuid) from public, anon;
grant execute on function public.can_view_work_height(uuid) to authenticated;

create or replace function public.can_view_work_height_incident(p_incident_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.work_height_incidents i
    where i.id = p_incident_id
      and (
        i.reporter_id = auth.uid()
        or public.can_review_work_height()
        or (i.assessment_id is not null and public.can_view_work_height(i.assessment_id))
      )
  );
$$;
revoke all on function public.can_view_work_height_incident(uuid) from public, anon;
grant execute on function public.can_view_work_height_incident(uuid) to authenticated;

create or replace function public.work_height_actor_name()
returns text language sql stable security definer set search_path = '' as $$
  select coalesce(nullif(trim(p.name), ''), p.email, 'Ажилтан')
  from public.profiles p where p.id = auth.uid();
$$;
revoke all on function public.work_height_actor_name() from public, anon;
grant execute on function public.work_height_actor_name() to authenticated;

create or replace function public.save_work_height_assessment(
  p_assessment_id uuid,
  p_payload jsonb
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := coalesce(p_assessment_id, gen_random_uuid());
  v_existing public.work_height_assessments%rowtype;
  v_hazard jsonb;
  v_ppe jsonb;
  v_employee uuid := coalesce((p_payload->>'employee_id')::uuid, auth.uid());
  v_max integer := 0;
  v_ppe_complete boolean := false;
  v_name text := public.work_height_actor_name();
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_assessment_id is not null then
    select * into v_existing from public.work_height_assessments where id = p_assessment_id for update;
    if v_existing.id is null then raise exception 'assessment_not_found'; end if;
    if v_existing.status not in ('draft', 'changes_required') then raise exception 'assessment_locked'; end if;
    if v_existing.created_by <> auth.uid() and not public.can_review_work_height() then raise exception 'permission_denied'; end if;
  elsif v_employee <> auth.uid() and not public.can_review_work_height() then
    raise exception 'permission_denied';
  end if;

  if coalesce(trim(p_payload->>'employee_name'), '') = ''
     or coalesce(trim(p_payload->>'location_name'), '') = ''
     or coalesce(trim(p_payload->>'work_type'), '') = ''
     or coalesce(trim(p_payload->>'weather'), '') = '' then
    raise exception 'required_fields_missing';
  end if;

  insert into public.work_height_assessments (
    id, employee_id, employee_name, employee_code, department_id, location_id,
    location_name, latitude, longitude, height_m, work_type, starts_at, ends_at,
    weather, partner_ids, partner_names, equipment, notes, created_by
  ) values (
    v_id, v_employee, trim(p_payload->>'employee_name'), nullif(trim(p_payload->>'employee_code'), ''),
    nullif(p_payload->>'department_id', '')::uuid, nullif(p_payload->>'location_id', '')::uuid,
    trim(p_payload->>'location_name'), nullif(p_payload->>'latitude', '')::double precision,
    nullif(p_payload->>'longitude', '')::double precision,
    (p_payload->>'height_m')::numeric, trim(p_payload->>'work_type'),
    (p_payload->>'starts_at')::timestamptz, (p_payload->>'ends_at')::timestamptz,
    trim(p_payload->>'weather'),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_payload->'partner_ids', '[]'::jsonb))::uuid), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_payload->'partner_names', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_payload->'equipment', '[]'::jsonb))), '{}'),
    nullif(trim(p_payload->>'notes'), ''), auth.uid()
  )
  on conflict (id) do update set
    employee_id = excluded.employee_id, employee_name = excluded.employee_name,
    employee_code = excluded.employee_code, department_id = excluded.department_id,
    location_id = excluded.location_id, location_name = excluded.location_name,
    latitude = excluded.latitude, longitude = excluded.longitude, height_m = excluded.height_m,
    work_type = excluded.work_type, starts_at = excluded.starts_at, ends_at = excluded.ends_at,
    weather = excluded.weather, partner_ids = excluded.partner_ids,
    partner_names = excluded.partner_names, equipment = excluded.equipment,
    notes = excluded.notes, revision = public.work_height_assessments.revision + 1,
    updated_at = now();

  delete from public.work_height_hazards where assessment_id = v_id;
  for v_hazard in select * from jsonb_array_elements(coalesce(p_payload->'hazards', '[]'::jsonb)) loop
    insert into public.work_height_hazards (
      assessment_id, hazard_type, description, likelihood, consequence, control_measure,
      residual_likelihood, residual_consequence, sort_order
    ) values (
      v_id, coalesce(nullif(trim(v_hazard->>'hazard_type'), ''), 'other'),
      trim(v_hazard->>'description'), (v_hazard->>'likelihood')::smallint,
      (v_hazard->>'consequence')::smallint, trim(v_hazard->>'control_measure'),
      nullif(v_hazard->>'residual_likelihood', '')::smallint,
      nullif(v_hazard->>'residual_consequence', '')::smallint,
      coalesce((v_hazard->>'sort_order')::integer, 0)
    );
  end loop;

  delete from public.work_height_ppe_checks where assessment_id = v_id;
  for v_ppe in select * from jsonb_array_elements(coalesce(p_payload->'ppe_checks', '[]'::jsonb)) loop
    insert into public.work_height_ppe_checks (
      assessment_id, item_key, item_label, required, passed, note, checked_by, checked_at
    ) values (
      v_id, trim(v_ppe->>'item_key'), trim(v_ppe->>'item_label'),
      coalesce((v_ppe->>'required')::boolean, true), coalesce((v_ppe->>'passed')::boolean, false),
      nullif(trim(v_ppe->>'note'), ''),
      case when coalesce((v_ppe->>'passed')::boolean, false) then auth.uid() else null end,
      case when coalesce((v_ppe->>'passed')::boolean, false) then now() else null end
    );
  end loop;

  select coalesce(max(risk_score), 0) into v_max
  from public.work_height_hazards where assessment_id = v_id;
  select not exists (
    select 1 from public.work_height_ppe_checks
    where assessment_id = v_id and required and not passed
  ) and exists (
    select 1 from public.work_height_ppe_checks where assessment_id = v_id
  ) into v_ppe_complete;
  update public.work_height_assessments
  set max_risk_score = v_max, ppe_complete = v_ppe_complete, updated_at = now()
  where id = v_id;

  insert into public.work_height_audit(assessment_id, actor_id, actor_name, action, from_status, to_status, snapshot)
  values (v_id, auth.uid(), v_name, case when p_assessment_id is null then 'created' else 'updated' end,
          coalesce(v_existing.status, 'draft'), coalesce(v_existing.status, 'draft'),
          jsonb_build_object('max_risk_score', v_max, 'ppe_complete', v_ppe_complete));
  return v_id;
end;
$$;
revoke all on function public.save_work_height_assessment(uuid, jsonb) from public, anon;
grant execute on function public.save_work_height_assessment(uuid, jsonb) to authenticated;

create or replace function public.transition_work_height_assessment(
  p_assessment_id uuid,
  p_action text,
  p_note text default null
)
returns public.work_height_assessments language plpgsql security definer set search_path = '' as $$
declare
  a public.work_height_assessments%rowtype;
  v_from text;
  v_next text;
  v_actor text := public.work_height_actor_name();
  v_review boolean := public.can_review_work_height();
begin
  select * into a from public.work_height_assessments where id = p_assessment_id for update;
  if a.id is null then raise exception 'assessment_not_found'; end if;
  v_from := a.status;

  if p_action = 'submit' then
    if a.status not in ('draft', 'changes_required') then raise exception 'invalid_transition'; end if;
    if a.created_by <> auth.uid() and a.employee_id <> auth.uid() and not v_review then raise exception 'permission_denied'; end if;
    if not exists (select 1 from public.work_height_hazards where assessment_id = a.id) then raise exception 'hazards_required'; end if;
    if not exists (select 1 from public.work_height_ppe_checks where assessment_id = a.id) then raise exception 'ppe_required'; end if;
    v_next := 'pending_review';
  elsif p_action = 'request_changes' then
    if not v_review or a.status not in ('pending_review', 'hse_approved') then raise exception 'permission_denied'; end if;
    if coalesce(trim(p_note), '') = '' then raise exception 'note_required'; end if;
    v_next := 'changes_required';
  elsif p_action = 'hse_approve' then
    if not v_review or a.status <> 'pending_review' then raise exception 'permission_denied'; end if;
    if a.max_risk_score >= 15 then raise exception 'high_risk_blocked'; end if;
    if not a.ppe_complete then raise exception 'ppe_incomplete'; end if;
    v_next := 'hse_approved';
  elsif p_action = 'management_approve' then
    if not v_review or a.status <> 'hse_approved' then raise exception 'permission_denied'; end if;
    if a.max_risk_score >= 15 then raise exception 'high_risk_blocked'; end if;
    if not a.ppe_complete then raise exception 'ppe_incomplete'; end if;
    v_next := 'management_approved';
  elsif p_action = 'start' then
    if a.status <> 'management_approved' then raise exception 'invalid_transition'; end if;
    if a.employee_id <> auth.uid() and not v_review then raise exception 'permission_denied'; end if;
    if a.max_risk_score >= 15 or not a.ppe_complete then raise exception 'work_blocked'; end if;
    v_next := 'in_progress';
  elsif p_action = 'complete' then
    if a.status <> 'in_progress' then raise exception 'invalid_transition'; end if;
    if a.employee_id <> auth.uid() and not v_review then raise exception 'permission_denied'; end if;
    v_next := 'completed';
  elsif p_action = 'stop' then
    if a.status in ('completed', 'stopped') then raise exception 'invalid_transition'; end if;
    if a.employee_id <> auth.uid() and a.created_by <> auth.uid()
       and not (auth.uid() = any(a.partner_ids)) and not v_review then raise exception 'permission_denied'; end if;
    if coalesce(trim(p_note), '') = '' then raise exception 'note_required'; end if;
    v_next := 'stopped';
  else
    raise exception 'unknown_action';
  end if;

  update public.work_height_assessments set
    status = v_next, updated_at = now(),
    submitted_at = case when v_next = 'pending_review' then now() else submitted_at end,
    hse_approved_at = case when v_next = 'hse_approved' then now() else hse_approved_at end,
    management_approved_at = case when v_next = 'management_approved' then now() else management_approved_at end,
    started_at = case when v_next = 'in_progress' then now() else started_at end,
    completed_at = case when v_next = 'completed' then now() else completed_at end,
    stopped_at = case when v_next = 'stopped' then now() else stopped_at end
  where id = a.id returning * into a;

  if p_action in ('hse_approve', 'management_approve', 'request_changes', 'stop') then
    insert into public.work_height_approvals(assessment_id, stage, decision, approver_id, approver_name, note)
    values (a.id,
      case when p_action = 'management_approve' then 'management' else 'hse' end,
      case when p_action = 'request_changes' then 'changes_required'
           when p_action = 'stop' then 'stopped' else 'approved' end,
      auth.uid(), v_actor, nullif(trim(p_note), ''));
  end if;
  insert into public.work_height_audit(assessment_id, actor_id, actor_name, action, from_status, to_status, note, snapshot)
  values (a.id, auth.uid(), v_actor, p_action, v_from, v_next,
          nullif(trim(p_note), ''), jsonb_build_object('max_risk_score', a.max_risk_score, 'ppe_complete', a.ppe_complete));
  return a;
end;
$$;
revoke all on function public.transition_work_height_assessment(uuid, text, text) from public, anon;
grant execute on function public.transition_work_height_assessment(uuid, text, text) to authenticated;

create or replace function public.report_work_height_incident(p_payload jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := gen_random_uuid();
  v_assessment uuid := nullif(p_payload->>'assessment_id', '')::uuid;
  v_severity text := p_payload->>'severity';
  v_actor text := public.work_height_actor_name();
  v_from text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if v_assessment is not null and not public.can_view_work_height(v_assessment) then raise exception 'permission_denied'; end if;
  if coalesce(trim(p_payload->>'description'), '') = ''
     or coalesce(trim(p_payload->>'location_name'), '') = '' then
    raise exception 'required_fields_missing';
  end if;
  insert into public.work_height_incidents(
    id, assessment_id, reporter_id, reporter_name, incident_type, severity,
    description, location_name, latitude, longitude, occurred_at
  ) values (
    v_id, v_assessment, auth.uid(), v_actor, p_payload->>'incident_type', v_severity,
    trim(p_payload->>'description'), trim(p_payload->>'location_name'),
    nullif(p_payload->>'latitude', '')::double precision,
    nullif(p_payload->>'longitude', '')::double precision,
    coalesce(nullif(p_payload->>'occurred_at', '')::timestamptz, now())
  );
  if v_assessment is not null and v_severity in ('serious', 'critical') then
    select status into v_from from public.work_height_assessments where id = v_assessment for update;
    if v_from not in ('completed', 'stopped') then
      update public.work_height_assessments
      set status = 'stopped', stopped_at = now(), updated_at = now()
      where id = v_assessment;
      insert into public.work_height_audit(assessment_id, actor_id, actor_name, action, from_status, to_status, note, snapshot)
      values (v_assessment, auth.uid(), v_actor, 'incident_auto_stop', v_from, 'stopped',
              trim(p_payload->>'description'), jsonb_build_object('incident_id', v_id, 'severity', v_severity));
    end if;
  end if;
  return v_id;
end;
$$;
revoke all on function public.report_work_height_incident(jsonb) from public, anon;
grant execute on function public.report_work_height_incident(jsonb) to authenticated;

create or replace function public.resolve_work_height_incident(p_incident_id uuid, p_resolution text, p_close boolean default false)
returns public.work_height_incidents language plpgsql security definer set search_path = '' as $$
declare v_row public.work_height_incidents%rowtype;
begin
  if not public.can_review_work_height() then raise exception 'permission_denied'; end if;
  if coalesce(trim(p_resolution), '') = '' then raise exception 'resolution_required'; end if;
  update public.work_height_incidents set
    status = case when p_close then 'closed' else 'resolved' end,
    resolution = trim(p_resolution), resolved_by = auth.uid(), resolved_at = now(), updated_at = now()
  where id = p_incident_id returning * into v_row;
  if v_row.id is null then raise exception 'incident_not_found'; end if;
  return v_row;
end;
$$;
revoke all on function public.resolve_work_height_incident(uuid, text, boolean) from public, anon;
grant execute on function public.resolve_work_height_incident(uuid, text, boolean) to authenticated;

alter table public.work_height_assessments enable row level security;
alter table public.work_height_hazards enable row level security;
alter table public.work_height_ppe_checks enable row level security;
alter table public.work_height_evidence enable row level security;
alter table public.work_height_incidents enable row level security;
alter table public.work_height_audit enable row level security;
alter table public.work_height_approvals enable row level security;

revoke all on public.work_height_assessments, public.work_height_hazards, public.work_height_ppe_checks,
  public.work_height_evidence, public.work_height_incidents, public.work_height_audit,
  public.work_height_approvals from anon, authenticated;
grant select on public.work_height_assessments, public.work_height_hazards, public.work_height_ppe_checks,
  public.work_height_evidence, public.work_height_incidents, public.work_height_audit,
  public.work_height_approvals to authenticated;
grant insert on public.work_height_evidence to authenticated;

create policy work_height_assessment_read on public.work_height_assessments for select to authenticated
  using (employee_id = auth.uid() or created_by = auth.uid() or auth.uid() = any(partner_ids) or public.can_review_work_height());
create policy work_height_hazard_read on public.work_height_hazards for select to authenticated
  using (public.can_view_work_height(assessment_id));
create policy work_height_ppe_read on public.work_height_ppe_checks for select to authenticated
  using (public.can_view_work_height(assessment_id));
create policy work_height_evidence_read on public.work_height_evidence for select to authenticated
  using ((assessment_id is not null and public.can_view_work_height(assessment_id))
    or (incident_id is not null and public.can_view_work_height_incident(incident_id)));
create policy work_height_evidence_insert on public.work_height_evidence for insert to authenticated
  with check (uploaded_by = auth.uid() and (
    (assessment_id is not null and public.can_view_work_height(assessment_id))
    or (incident_id is not null and public.can_view_work_height_incident(incident_id))
  ));
create policy work_height_incident_read on public.work_height_incidents for select to authenticated
  using (reporter_id = auth.uid() or public.can_review_work_height()
         or (assessment_id is not null and public.can_view_work_height(assessment_id)));
create policy work_height_audit_read on public.work_height_audit for select to authenticated
  using (public.can_view_work_height(assessment_id));
create policy work_height_approval_read on public.work_height_approvals for select to authenticated
  using (public.can_view_work_height(assessment_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('work-height-evidence', 'work-height-evidence', false, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists work_height_storage_read on storage.objects;
create policy work_height_storage_read on storage.objects for select to authenticated
  using (bucket_id = 'work-height-evidence'
    and (public.can_view_work_height((storage.foldername(name))[1]::uuid)
      or public.can_view_work_height_incident((storage.foldername(name))[1]::uuid)));
drop policy if exists work_height_storage_insert on storage.objects;
create policy work_height_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'work-height-evidence'
    and (public.can_view_work_height((storage.foldername(name))[1]::uuid)
      or public.can_view_work_height_incident((storage.foldername(name))[1]::uuid)));
drop policy if exists work_height_storage_delete on storage.objects;
create policy work_height_storage_delete on storage.objects for delete to authenticated
  using (bucket_id = 'work-height-evidence'
    and (owner_id = auth.uid()::text or public.can_review_work_height()));

notify pgrst, 'reload schema';
