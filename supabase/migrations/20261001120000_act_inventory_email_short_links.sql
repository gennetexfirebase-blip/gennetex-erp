-- Act inventory issuing, short public links and email audit support.

alter table public.acts
  add column if not exists public_share_slug text;

create unique index if not exists acts_public_share_slug_idx
  on public.acts (public_share_slug)
  where public_share_slug is not null;

update public.acts
set public_share_slug = left(replace(public_share_token::text, '-', ''), 12)
where public_share_token is not null and public_share_slug is null;

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
      v_slug := left(encode(gen_random_bytes(8), 'hex'), 12);
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

create or replace function public.get_public_act_by_slug(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_token uuid;
begin
  select public_share_token into v_token
  from public.acts
  where public_share_slug = lower(btrim(p_slug))
    and public_share_enabled
    and deleted_at is null
    and status in ('ready', 'approved', 'delivered');
  if v_token is null then raise exception 'public_act_not_found'; end if;
  return public.get_public_act(v_token);
end;
$$;

revoke all on function public.get_public_act_by_slug(text) from public;
grant execute on function public.get_public_act_by_slug(text) to anon, authenticated;

create or replace function public.issue_act_materials(p_act_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_act public.acts%rowtype;
  v_actor text;
  v_item public.inventory%rowtype;
  v_row record;
  v_movement_id uuid;
  v_issued integer := 0;
  v_existing integer := 0;
  v_total numeric := 0;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not public.act_can('edit', p_act_id) or not public.can_manage_inventory() then
    raise exception 'permission_denied';
  end if;

  select * into v_act from public.acts
  where id = p_act_id and deleted_at is null for update;
  if not found then raise exception 'act_not_found'; end if;
  if v_act.status in ('approved', 'delivered', 'cancelled', 'archived') then
    raise exception 'act_inventory_locked';
  end if;

  select coalesce(nullif(btrim(name), ''), email, 'ERP хэрэглэгч') into v_actor
  from public.profiles where id = auth.uid();

  for v_row in
    select m.* from public.act_materials m
    where m.act_id = p_act_id and m.quantity > 0
    order by m.sort_order, m.id
    for update
  loop
    if v_row.source_transaction_id is not null then
      v_existing := v_existing + 1;
      continue;
    end if;
    if v_row.material_id is null then
      raise exception 'act_material_not_linked:%', v_row.material_name;
    end if;

    select * into v_item from public.inventory
    where id = v_row.material_id for update;
    if not found then raise exception 'inventory_item_not_found:%', v_row.material_name; end if;
    if coalesce(v_item.quantity, 0) < v_row.quantity then
      raise exception 'inventory_shortage:%:%:%', v_item.name, coalesce(v_item.quantity, 0), v_row.quantity;
    end if;

    update public.inventory
    set quantity = quantity - v_row.quantity
    where id = v_item.id;

    insert into public.stock_movements (
      item_id, item_name, unit, user_id, user_name, quantity, movement_type,
      issued_by, issued_by_name, unit_price, total_amount,
      service_call_id, site_session_id
    ) values (
      v_item.id, v_item.name, coalesce(v_row.unit, v_item.unit), auth.uid(), v_actor,
      v_row.quantity, 'withdraw', auth.uid(), v_actor,
      greatest(coalesce(v_item.price, 0), 0), greatest(coalesce(v_item.price, 0), 0) * v_row.quantity,
      case when v_act.source_type = 'service_call' then v_act.source_id else null end,
      case when v_act.source_type = 'site_session' then v_act.source_id else null end
    ) returning id into v_movement_id;

    update public.act_materials
    set source_transaction_id = v_movement_id
    where id = v_row.id;
    v_issued := v_issued + 1;
    v_total := v_total + v_row.quantity;
  end loop;

  if v_issued > 0 then
    update public.acts set updated_at = now(), version = version + 1 where id = p_act_id;
    insert into public.act_audit_logs(act_id, actor_id, actor_name, event_type, detail)
    values (p_act_id, auth.uid(), v_actor, 'materials_issued', jsonb_build_object('items', v_issued, 'quantity', v_total));
  end if;

  return jsonb_build_object('issued_count', v_issued, 'already_issued_count', v_existing, 'total_quantity', v_total);
end;
$$;

revoke all on function public.issue_act_materials(uuid) from public, anon;
grant execute on function public.issue_act_materials(uuid) to authenticated;

create or replace function public.log_act_email(p_act_id uuid, p_to_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_actor text;
begin
  if not public.act_can('approve', p_act_id) then raise exception 'permission_denied'; end if;
  select coalesce(nullif(btrim(name), ''), email, 'ERP хэрэглэгч') into v_actor
  from public.profiles where id = auth.uid();
  insert into public.act_audit_logs(act_id, actor_id, actor_name, event_type, detail)
  values (p_act_id, auth.uid(), v_actor, 'email_sent', jsonb_build_object('to', lower(btrim(p_to_email))));
end;
$$;

revoke all on function public.log_act_email(uuid, text) from public, anon;
grant execute on function public.log_act_email(uuid, text) to authenticated;

notify pgrst, 'reload schema';
