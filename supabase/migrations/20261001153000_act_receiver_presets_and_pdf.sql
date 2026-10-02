-- Receiver presets and PDF delivery support.

update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']::text[]
where id = 'act-files';

alter table public.act_receiver_contacts
  add column if not exists preset_group text,
  add column if not exists receiver_type text not null default 'custom',
  add column if not exists sort_order integer not null default 0,
  add column if not exists signature_url text,
  add column if not exists stamp_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'act-brand-assets', 'act-brand-assets', true, 10485760,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists act_brand_assets_public_select on storage.objects;
create policy act_brand_assets_public_select on storage.objects
for select to public using (bucket_id = 'act-brand-assets');

drop policy if exists act_brand_assets_superadmin_insert on storage.objects;
create policy act_brand_assets_superadmin_insert on storage.objects
for insert to authenticated with check (bucket_id = 'act-brand-assets' and public.is_superadmin());

drop policy if exists act_brand_assets_superadmin_update on storage.objects;
create policy act_brand_assets_superadmin_update on storage.objects
for update to authenticated using (bucket_id = 'act-brand-assets' and public.is_superadmin())
with check (bucket_id = 'act-brand-assets' and public.is_superadmin());

alter table public.act_receiver_contacts drop constraint if exists act_receiver_contacts_receiver_type_check;
alter table public.act_receiver_contacts
  add constraint act_receiver_contacts_receiver_type_check
  check (receiver_type in ('customer', 'site', 'contractor', 'nextmind', 'custom'));

create index if not exists act_receiver_contacts_preset_idx
  on public.act_receiver_contacts (preset_group, sort_order)
  where preset_group is not null and is_active;

insert into public.act_receiver_contacts
  (audience_type, organization, name, position, preset_group, receiver_type, sort_order)
select v.audience_type, v.organization, v.name, v.position, v.preset_group, v.receiver_type, v.sort_order
from (values
  ('organization', 'Юнивишн ХХК', 'Ч. Ням-Осор', 'Техник хэлтсийн менежер', 'univision_organization', 'customer', 10),
  ('organization', 'Юнивишн ХХК', 'Э.Чүлтэмдорж', 'Гүйцэтгэл хариуцсан инженер', 'univision_organization', 'customer', 20),
  ('household', 'Юнивишн ХХК Төвийн бүс', 'А.Хонгор', 'Ашиглалт төлөвлөлтийн ахлах инженер', 'univision_household', 'site', 10),
  ('household', 'Юнивишн ХХК Төвийн бүс', 'Б.Баясгалан', 'Ашиглалт төлөвлөлтийн инженер', 'univision_household', 'site', 20),
  ('household', 'Юнивишн ХХК Төвийн бүс', 'Э.Зориг', 'Ашиглалт төлөвлөлтийн инженер', 'univision_household', 'site', 30),
  ('organization', 'Женнетекс ХХК', 'Мөнхбат', 'Ерөнхий инженер', 'gennetex_handover', 'contractor', 10),
  ('organization', 'Женнетекс ХХК', 'Баярхүү', 'Ахлах инженер', 'gennetex_handover', 'contractor', 20)
) as v(audience_type, organization, name, position, preset_group, receiver_type, sort_order)
where not exists (
  select 1 from public.act_receiver_contacts c
  where lower(coalesce(c.organization, '')) = lower(v.organization)
    and lower(c.name) = lower(v.name)
    and c.audience_type = v.audience_type
);

-- Ensure an existing matching master row is also connected to its preset.
update public.act_receiver_contacts c set
  preset_group = v.preset_group,
  receiver_type = v.receiver_type,
  sort_order = v.sort_order,
  is_active = true,
  updated_at = now()
from (values
  ('organization', 'Юнивишн ХХК', 'Ч. Ням-Осор', 'univision_organization', 'customer', 10),
  ('organization', 'Юнивишн ХХК', 'Э.Чүлтэмдорж', 'univision_organization', 'customer', 20),
  ('household', 'Юнивишн ХХК Төвийн бүс', 'А.Хонгор', 'univision_household', 'site', 10),
  ('household', 'Юнивишн ХХК Төвийн бүс', 'Б.Баясгалан', 'univision_household', 'site', 20),
  ('household', 'Юнивишн ХХК Төвийн бүс', 'Э.Зориг', 'univision_household', 'site', 30),
  ('organization', 'Женнетекс ХХК', 'Мөнхбат', 'gennetex_handover', 'contractor', 10),
  ('organization', 'Женнетекс ХХК', 'Баярхүү', 'gennetex_handover', 'contractor', 20)
) as v(audience_type, organization, name, preset_group, receiver_type, sort_order)
where c.audience_type = v.audience_type
  and lower(coalesce(c.organization, '')) = lower(v.organization)
  and lower(c.name) = lower(v.name);

update public.act_receiver_contacts
set stamp_url = 'https://zkftykocmqzrgdhgwluu.supabase.co/storage/v1/object/public/act-brand-assets/gennetex-company-stamp.jpg',
    updated_at = now()
where preset_group = 'gennetex_handover';

create or replace function public.save_act_receiver_contact(
  p_contact_id uuid,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := coalesce(p_contact_id, gen_random_uuid());
  v_name text := nullif(btrim(p_payload ->> 'name'), '');
  v_audience text := coalesce(nullif(p_payload ->> 'audience_type', ''), 'organization');
  v_receiver_type text := coalesce(nullif(p_payload ->> 'receiver_type', ''), 'custom');
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not public.is_superadmin() then raise exception 'permission_denied'; end if;
  if v_name is null then raise exception 'receiver_name_required'; end if;
  if v_audience not in ('household', 'organization') then raise exception 'invalid_receiver_audience'; end if;
  if v_receiver_type not in ('customer', 'site', 'contractor', 'nextmind', 'custom') then v_receiver_type := 'custom'; end if;

  insert into public.act_receiver_contacts (
    id, audience_type, organization, name, position, employee_id,
    is_active, preset_group, receiver_type, sort_order, signature_url, stamp_url, created_by
  ) values (
    v_id, v_audience, nullif(btrim(p_payload ->> 'organization'), ''),
    v_name, nullif(btrim(p_payload ->> 'position'), ''),
    nullif(p_payload ->> 'employee_id', '')::uuid,
    coalesce((p_payload ->> 'is_active')::boolean, true),
    nullif(p_payload ->> 'preset_group', ''), v_receiver_type,
    coalesce((p_payload ->> 'sort_order')::integer, 0),
    nullif(p_payload ->> 'signature_url', ''), nullif(p_payload ->> 'stamp_url', ''), auth.uid()
  )
  on conflict (id) do update set
    audience_type = excluded.audience_type,
    organization = excluded.organization,
    name = excluded.name,
    position = excluded.position,
    employee_id = excluded.employee_id,
    is_active = excluded.is_active,
    preset_group = excluded.preset_group,
    receiver_type = excluded.receiver_type,
    sort_order = excluded.sort_order,
    signature_url = excluded.signature_url,
    stamp_url = excluded.stamp_url,
    updated_at = now();
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
  insert into public.act_receivers(
    act_id, type, organization, employee_id, name, position, signature_mode,
    sort_order, contact_id, audience_type, is_enabled
  )
    select v_new, type, organization, employee_id, name, position, 'none',
      sort_order, contact_id, audience_type, is_enabled
    from public.act_receivers where act_id = p_act_id;
  insert into public.act_audit_logs(act_id, actor_id, actor_name, event_type, detail)
    values (v_new, v_uid, v_actor, 'duplicated', jsonb_build_object('source_act_id', p_act_id));
  return v_new;
end;
$$;

revoke all on function public.save_act_receiver_contact(uuid, jsonb) from public, anon;
grant execute on function public.save_act_receiver_contact(uuid, jsonb) to authenticated;
revoke all on function public.duplicate_act(uuid) from public, anon;
grant execute on function public.duplicate_act(uuid) to authenticated;

notify pgrst, 'reload schema';
