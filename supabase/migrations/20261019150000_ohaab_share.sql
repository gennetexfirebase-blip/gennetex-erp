-- ============================================================================
-- haab.gennetex.com — ХААБ гарын үсгийн хуудсыг нийтэд хуваалцах
-- ============================================================================
--
--   Админ тухайн өдрийн хуудсанд нэг холбоос (token) үүсгэнэ; холбоостой хэн ч
--   (нэвтрэлтгүй) тэр өдрийн заавар + гарын үсгийг харна. Хүснэгт нь зөвхөн
--   доорх security definer функцээр — шууд хандалтгүй.
--
--   ohaab_share_link(date)  → uuid    (админ; өдөр бүрт нэг токен, дахин дуудвал ижлийг)
--   ohaab_share_view(uuid)  → jsonb   (anon; заавар, нийт ажилтан, гарын үсгүүд)
--   ohaab_share_revoke(date)          (админ; холбоосыг хүчингүй болгоно)
-- ============================================================================

create table if not exists public.ohaab_shares (
  token      uuid primary key default gen_random_uuid(),
  ack_date   date not null unique,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.ohaab_shares enable row level security;
revoke all on public.ohaab_shares from anon, authenticated;

create or replace function public.ohaab_share_link(p_date date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  t uuid;
begin
  if not public.is_admin_user() then raise exception 'forbidden'; end if;
  select s.token into t from public.ohaab_shares s where s.ack_date = p_date;
  if t is null then
    insert into public.ohaab_shares (ack_date, created_by) values (p_date, auth.uid()) returning token into t;
  end if;
  return t;
end;
$$;
revoke all on function public.ohaab_share_link(date) from public, anon;
grant execute on function public.ohaab_share_link(date) to authenticated;

create or replace function public.ohaab_share_revoke(p_date date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin_user() then raise exception 'forbidden'; end if;
  delete from public.ohaab_shares s where s.ack_date = p_date;
end;
$$;
revoke all on function public.ohaab_share_revoke(date) from public, anon;
grant execute on function public.ohaab_share_revoke(date) to authenticated;

create or replace function public.ohaab_share_view(p_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  d date;
begin
  select s.ack_date into d from public.ohaab_shares s where s.token = p_token;
  if d is null then raise exception 'not_found'; end if;
  return jsonb_build_object(
    'date', d,
    'instruction', (select jsonb_build_object('title', i.title, 'body', i.body, 'updated_at', i.updated_at)
                    from public.ohaab_instruction i where i.id = 1),
    'total', (select count(*) from public.profiles p where p.role is distinct from 'superadmin'),
    'acks', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', a.id,
               'user_id', a.user_id,
               'name', coalesce(nullif(trim(coalesce(p.last_name, '') || ' ' || coalesce(p.name, '')), ''), a.user_name, 'Ажилтан'),
               'department', dep.name,
               'avatar_url', p.avatar_url,
               'signed_at', a.signed_at,
               'signature_url', a.signature_url,
               'instruction_updated_at', a.instruction_updated_at
             ) order by a.signed_at)
      from public.ohaab_daily_ack a
      left join public.profiles p on p.id = a.user_id
      left join public.departments dep on dep.id = p.department_id
      where a.ack_date = d), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.ohaab_share_view(uuid) from public;
grant execute on function public.ohaab_share_view(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
