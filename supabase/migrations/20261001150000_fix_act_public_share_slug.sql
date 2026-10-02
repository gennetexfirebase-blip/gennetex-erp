-- SECURITY DEFINER functions use an empty search_path.  Generate the short
-- share slug from gen_random_uuid(), which PostgreSQL resolves safely there,
-- instead of calling the extension-only gen_random_bytes without a schema.

create or replace function public.set_act_public_share(p_act_id uuid, p_enabled boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token uuid;
  v_slug text;
  v_status text;
  v_actor text;
begin
  if not public.act_can('approve', p_act_id) then raise exception 'permission_denied'; end if;
  select status, public_share_token, public_share_slug into v_status, v_token, v_slug
  from public.acts where id = p_act_id and deleted_at is null for update;
  if not found then raise exception 'act_not_found'; end if;
  if p_enabled and v_status not in ('ready', 'approved', 'delivered') then
    raise exception 'share_requires_ready';
  end if;
  if p_enabled and v_token is null then v_token := gen_random_uuid(); end if;
  if p_enabled and v_slug is null then
    loop
      v_slug := left(replace(gen_random_uuid()::text, '-', ''), 12);
      exit when not exists (select 1 from public.acts where public_share_slug = v_slug);
    end loop;
  end if;
  update public.acts set
    public_share_enabled = p_enabled,
    public_share_token = v_token,
    public_share_slug = v_slug,
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

revoke all on function public.set_act_public_share(uuid, boolean) from public, anon;
grant execute on function public.set_act_public_share(uuid, boolean) to authenticated;

notify pgrst, 'reload schema';
