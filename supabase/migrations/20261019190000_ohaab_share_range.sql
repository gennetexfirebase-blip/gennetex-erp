-- ============================================================================
-- haab.gennetex.com — нийтийн холбоосыг хугацааны хүрээтэй болгоно (өдөр/сар/он/бүгд)
-- ============================================================================
--   ohaab_share_link(from, to)  → uuid   (админ; хүрээ бүрт нэг токен)
--   ohaab_share_view(uuid)      → jsonb  (anon; хүрээний гарын үсгүүд, огноотой)
--   ohaab_share_revoke(from, to)
-- ============================================================================

alter table public.ohaab_shares add column if not exists date_to date;
update public.ohaab_shares set date_to = ack_date where date_to is null;
alter table public.ohaab_shares alter column date_to set not null;
alter table public.ohaab_shares drop constraint if exists ohaab_shares_ack_date_key;
create unique index if not exists ohaab_shares_range_key on public.ohaab_shares (ack_date, date_to);

drop function if exists public.ohaab_share_link(date);
drop function if exists public.ohaab_share_revoke(date);

create or replace function public.ohaab_share_link(p_from date, p_to date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  t uuid;
begin
  if not public.is_admin_user() then raise exception 'forbidden'; end if;
  if p_from is null or p_to is null or p_to < p_from then raise exception 'invalid_range'; end if;
  select s.token into t from public.ohaab_shares s where s.ack_date = p_from and s.date_to = p_to;
  if t is null then
    insert into public.ohaab_shares (ack_date, date_to, created_by) values (p_from, p_to, auth.uid()) returning token into t;
  end if;
  return t;
end;
$$;
revoke all on function public.ohaab_share_link(date, date) from public, anon;
grant execute on function public.ohaab_share_link(date, date) to authenticated;

create or replace function public.ohaab_share_revoke(p_from date, p_to date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin_user() then raise exception 'forbidden'; end if;
  delete from public.ohaab_shares s where s.ack_date = p_from and s.date_to = p_to;
end;
$$;
revoke all on function public.ohaab_share_revoke(date, date) from public, anon;
grant execute on function public.ohaab_share_revoke(date, date) to authenticated;

create or replace function public.ohaab_share_view(p_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  d_from date;
  d_to date;
begin
  select s.ack_date, s.date_to into d_from, d_to from public.ohaab_shares s where s.token = p_token;
  if d_from is null then raise exception 'not_found'; end if;
  return jsonb_build_object(
    'date', d_from,
    'date_to', d_to,
    'instruction', (select jsonb_build_object('title', i.title, 'body', i.body, 'updated_at', i.updated_at)
                    from public.ohaab_instruction i where i.id = 1),
    'total', (select count(*) from public.profiles p where p.role is distinct from 'superadmin'),
    'acks', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', a.id,
               'user_id', a.user_id,
               'ack_date', a.ack_date,
               'name', coalesce(nullif(trim(coalesce(p.last_name, '') || ' ' || coalesce(p.name, '')), ''), a.user_name, 'Ажилтан'),
               'department', dep.name,
               'avatar_url', p.avatar_url,
               'signed_at', a.signed_at,
               'signature_url', a.signature_url,
               'instruction_updated_at', a.instruction_updated_at
             ) order by a.ack_date, a.signed_at)
      from public.ohaab_daily_ack a
      left join public.profiles p on p.id = a.user_id
      left join public.departments dep on dep.id = p.department_id
      where a.ack_date between d_from and d_to), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.ohaab_share_view(uuid) from public;
grant execute on function public.ohaab_share_view(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
