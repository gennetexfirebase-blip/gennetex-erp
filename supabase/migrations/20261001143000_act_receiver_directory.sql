-- Reusable handover/receiver directory.  The directory is master data and can
-- only be maintained by superadmins; acts keep an immutable text snapshot.

create table if not exists public.act_receiver_contacts (
  id uuid primary key default gen_random_uuid(),
  audience_type text not null default 'organization'
    check (audience_type in ('household', 'organization')),
  organization text,
  name text not null,
  position text,
  employee_id uuid references public.profiles(id) on delete set null,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists act_receiver_contacts_lookup_idx
  on public.act_receiver_contacts (audience_type, is_active, organization, name);

alter table public.act_receivers
  add column if not exists contact_id uuid references public.act_receiver_contacts(id) on delete set null,
  add column if not exists audience_type text not null default 'organization',
  add column if not exists is_enabled boolean not null default true;

alter table public.act_receivers drop constraint if exists act_receivers_type_check;
alter table public.act_receivers
  add constraint act_receivers_type_check
  check (type in ('customer', 'site', 'contractor', 'nextmind', 'custom'));

alter table public.act_receivers drop constraint if exists act_receivers_audience_type_check;
alter table public.act_receivers
  add constraint act_receivers_audience_type_check
  check (audience_type in ('household', 'organization'));

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
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not public.is_superadmin() then raise exception 'permission_denied'; end if;
  if v_name is null then raise exception 'receiver_name_required'; end if;
  if v_audience not in ('household', 'organization') then raise exception 'invalid_receiver_audience'; end if;

  insert into public.act_receiver_contacts (
    id, audience_type, organization, name, position, employee_id,
    is_active, created_by
  ) values (
    v_id, v_audience, nullif(btrim(p_payload ->> 'organization'), ''),
    v_name, nullif(btrim(p_payload ->> 'position'), ''),
    nullif(p_payload ->> 'employee_id', '')::uuid,
    coalesce((p_payload ->> 'is_active')::boolean, true), auth.uid()
  )
  on conflict (id) do update set
    audience_type = excluded.audience_type,
    organization = excluded.organization,
    name = excluded.name,
    position = excluded.position,
    employee_id = excluded.employee_id,
    is_active = excluded.is_active,
    updated_at = now();
  return v_id;
end;
$$;

-- save_act intentionally continues to own all receiver snapshot rows.  This
-- small second pass adds directory metadata without duplicating that function.
create or replace function public.set_act_receiver_metadata(
  p_act_id uuid,
  p_receivers jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_order integer := 0;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not public.act_can('edit', p_act_id) then raise exception 'permission_denied'; end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_receivers, '[]'::jsonb)) loop
    update public.act_receivers set
      contact_id = nullif(v_item ->> 'contact_id', '')::uuid,
      audience_type = case
        when v_item ->> 'audience_type' in ('household', 'organization') then v_item ->> 'audience_type'
        else 'organization'
      end,
      is_enabled = coalesce((v_item ->> 'is_enabled')::boolean, true)
    where act_id = p_act_id and sort_order = v_order;
    v_order := v_order + 1;
  end loop;
end;
$$;

alter table public.act_receiver_contacts enable row level security;

drop policy if exists act_receiver_contacts_select on public.act_receiver_contacts;
create policy act_receiver_contacts_select
  on public.act_receiver_contacts for select to authenticated
  using (is_active or public.is_superadmin());

revoke all on public.act_receiver_contacts from anon, authenticated;
grant select on public.act_receiver_contacts to authenticated;

revoke all on function public.save_act_receiver_contact(uuid, jsonb) from public, anon;
grant execute on function public.save_act_receiver_contact(uuid, jsonb) to authenticated;
revoke all on function public.set_act_receiver_metadata(uuid, jsonb) from public, anon;
grant execute on function public.set_act_receiver_metadata(uuid, jsonb) to authenticated;

-- Keep directory identifiers out of anonymous/public document payloads.
create or replace function public.get_public_act(p_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_result jsonb;
begin
  select
    (to_jsonb(a) - 'created_by' - 'approved_by' - 'deleted_at' - 'source_id')
    || jsonb_build_object(
      'template', to_jsonb(t),
      'materials', coalesce((select jsonb_agg(to_jsonb(m) order by m.sort_order) from public.act_materials m where m.act_id = a.id), '[]'::jsonb),
      'checklists', coalesce((select jsonb_agg(to_jsonb(c) order by c.sort_order) from public.act_checklists c where c.act_id = a.id), '[]'::jsonb),
      'receivers', coalesce((select jsonb_agg(to_jsonb(r) - 'employee_id' - 'contact_id' order by r.sort_order) from public.act_receivers r where r.act_id = a.id), '[]'::jsonb),
      'photos', coalesce((select jsonb_agg(to_jsonb(p) - 'taken_by_employee_id' - 'taken_by_employee_name' - 'source_id' order by p.sort_order) from public.act_photos p where p.act_id = a.id), '[]'::jsonb),
      'audit', '[]'::jsonb
    ) into v_result
  from public.acts a
  left join public.act_templates t on t.id = a.template_id
  where a.public_share_token = p_token
    and a.public_share_enabled
    and a.deleted_at is null
    and a.status in ('ready', 'approved', 'delivered');
  if v_result is null then raise exception 'public_act_not_found'; end if;
  return v_result;
end;
$$;

notify pgrst, 'reload schema';
