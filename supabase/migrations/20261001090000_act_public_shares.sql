alter table public.acts
  add column if not exists public_share_enabled boolean not null default false,
  add column if not exists public_share_token uuid unique,
  add column if not exists public_shared_at timestamptz;

create index if not exists acts_public_share_token_idx
  on public.acts (public_share_token)
  where public_share_enabled and deleted_at is null;

create or replace function public.set_act_public_share(p_act_id uuid, p_enabled boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token uuid;
  v_status text;
  v_actor text;
begin
  if not public.act_can('approve', p_act_id) then raise exception 'permission_denied'; end if;
  select status, public_share_token into v_status, v_token
  from public.acts where id = p_act_id and deleted_at is null for update;
  if not found then raise exception 'act_not_found'; end if;
  if p_enabled and v_status not in ('ready', 'approved', 'delivered') then
    raise exception 'share_requires_ready';
  end if;
  if p_enabled and v_token is null then v_token := gen_random_uuid(); end if;
  update public.acts set
    public_share_enabled = p_enabled,
    public_share_token = v_token,
    public_shared_at = case when p_enabled then now() else public_shared_at end,
    updated_at = now()
  where id = p_act_id;
  select coalesce(nullif(btrim(name), ''), email, 'ERP хэрэглэгч') into v_actor
  from public.profiles where id = auth.uid();
  insert into public.act_audit_logs(act_id, actor_id, actor_name, event_type)
  values (p_act_id, auth.uid(), v_actor, case when p_enabled then 'public_share_enabled' else 'public_share_disabled' end);
  return v_token;
end;
$$;

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
      'receivers', coalesce((select jsonb_agg(to_jsonb(r) - 'employee_id' order by r.sort_order) from public.act_receivers r where r.act_id = a.id), '[]'::jsonb),
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

revoke all on function public.set_act_public_share(uuid, boolean) from public, anon;
grant execute on function public.set_act_public_share(uuid, boolean) to authenticated;
revoke all on function public.get_public_act(uuid) from public;
grant execute on function public.get_public_act(uuid) to anon, authenticated;

create policy act_files_public_shared_select on storage.objects
for select to anon, authenticated
using (
  bucket_id = 'act-files'
  and exists (
    select 1 from public.acts a
    where a.id::text = (storage.foldername(name))[1]
      and a.public_share_enabled
      and a.deleted_at is null
      and a.status in ('ready', 'approved', 'delivered')
  )
);

notify pgrst, 'reload schema';
