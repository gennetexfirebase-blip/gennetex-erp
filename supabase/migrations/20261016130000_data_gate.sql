-- ============================================================================
-- data.gennetex.com/data/ — бүх өгөгдлийн сан, зөвхөн superadmin (≤3)
-- ============================================================================
--
--   Нэвтрэх 4 шат (edge function `data-gate`):
--     1. Утасны дугаар — verify.mn (ажилтан өөрийн утаснаас код илгээнэ)
--     2. Gmail-д ирсэн 6 оронтой код
--     3. Google-ээр нэвтрэх (1-р шатны дугаартай ижил superadmin байх ёстой)
--     4. Өөрийн нууц үг (анх удаа тохируулна)
--   Дөрвүүлээ амжилттай бол 8 цагийн data session олгоно.
--
--   Эдгээр хүснэгтэд RLS бодлого байхгүй — зөвхөн service role (edge function).
-- ============================================================================

create table if not exists public.data_gate_attempts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  stage           text not null check (stage in ('phone', 'email', 'google', 'password')),
  phone_session   text,
  email_code_hash text,
  tries           int not null default 0,
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null default now() + interval '15 minutes'
);
alter table public.data_gate_attempts enable row level security;

create table if not exists public.data_passwords (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  salt       text not null,
  hash       text not null,
  iterations int not null,
  fails      int not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.data_passwords enable row level security;

create table if not exists public.data_sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
alter table public.data_sessions enable row level security;

create table if not exists public.data_access_log (
  id         bigserial primary key,
  user_id    uuid references public.profiles(id) on delete set null,
  action     text not null,
  detail     jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.data_access_log enable row level security;

revoke all on public.data_gate_attempts, public.data_passwords, public.data_sessions, public.data_access_log from anon, authenticated;

/** Public схемийн хүснэгтүүд (ойролцоо мөрийн тоотой) — зөвхөн service role. */
create or replace function public.data_tables()
returns table (name text, approx_rows bigint, has_created_at boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select c.relname::text,
         greatest(c.reltuples, 0)::bigint,
         exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'created_at' and not a.attisdropped)
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and c.relname not like 'data\_%'
    and c.relname not in ('report_access_keys', 'attendance_widget_tokens')
  order by c.relname;
$$;
revoke all on function public.data_tables() from public, anon, authenticated;
grant execute on function public.data_tables() to service_role;

notify pgrst, 'reload schema';
