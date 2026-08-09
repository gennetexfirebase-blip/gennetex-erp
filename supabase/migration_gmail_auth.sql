-- Gmail allowlist + server-authoritative profile provisioning.
-- Internal role value remains "superadmin" for compatibility; UI label is "Хөгжүүлэгч".

alter table public.profiles add column if not exists last_name text;
alter table public.profiles add column if not exists address text;

create table if not exists public.authorized_users (
  email text primary key,
  linked_user_id uuid unique references auth.users(id) on delete set null,
  name text not null,
  last_name text,
  "position" text,
  phone text,
  address text,
  role text not null default 'employee' check (role in ('employee', 'admin', 'superadmin')),
  active boolean not null default true,
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint authorized_users_email_normalized check (email = lower(trim(email))),
  constraint authorized_users_email_shape check (position('@' in email) > 1)
);

alter table public.authorized_users enable row level security;

drop policy if exists "authorized_users_admin_read" on public.authorized_users;
create policy "authorized_users_admin_read"
on public.authorized_users
for select
to authenticated
using (
  lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or exists (
    select 1
    from public.profiles actor
    where actor.id = auth.uid()
      and actor.role in ('admin', 'superadmin')
  )
);

drop policy if exists "authorized_users_auth_hook_read" on public.authorized_users;
create policy "authorized_users_auth_hook_read"
on public.authorized_users
for select
to supabase_auth_admin
using (active);

grant usage on schema public to supabase_auth_admin;
grant select on table public.authorized_users to supabase_auth_admin;

create or replace function public.hook_require_authorized_email(event jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  requested_email text := lower(trim(coalesce(event -> 'user' ->> 'email', '')));
begin
  if requested_email = '' or not exists (
    select 1
    from public.authorized_users approved
    where approved.email = requested_email
      and approved.active
  ) then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'Энэ Gmail хаяг Gennetex ERP-д зөвшөөрөгдөөгүй байна.'
      )
    );
  end if;

  return '{}'::jsonb;
end;
$$;

grant execute on function public.hook_require_authorized_email(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_require_authorized_email(jsonb) from public, anon, authenticated;

create or replace function public.handle_new_authorized_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  approved public.authorized_users%rowtype;
begin
  select * into approved
  from public.authorized_users
  where email = lower(trim(new.email))
    and active;

  if not found then
    raise exception 'gmail_not_authorized';
  end if;

  insert into public.profiles (
    id, email, name, last_name, role, position, phone, address, must_change_password
  ) values (
    new.id,
    approved.email,
    approved.name,
    approved.last_name,
    approved.role,
    approved.position,
    approved.phone,
    approved.address,
    false
  )
  on conflict (id) do update set
    email = excluded.email,
    name = excluded.name,
    last_name = excluded.last_name,
    role = excluded.role,
    position = excluded.position,
    phone = excluded.phone,
    address = excluded.address,
    must_change_password = false;

  update public.authorized_users
  set linked_user_id = new.id, updated_at = now()
  where email = approved.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_authorized_user();

create or replace function public.claim_authorized_profile()
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  account auth.users%rowtype;
  approved public.authorized_users%rowtype;
  result public.profiles%rowtype;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into account from auth.users where id = uid;
  select * into approved
  from public.authorized_users
  where email = lower(trim(account.email))
    and active;

  if not found then
    raise exception 'gmail_not_authorized';
  end if;

  insert into public.profiles (
    id, email, name, last_name, role, position, phone, address, must_change_password
  ) values (
    uid,
    approved.email,
    approved.name,
    approved.last_name,
    approved.role,
    approved.position,
    approved.phone,
    approved.address,
    false
  )
  on conflict (id) do update set
    email = excluded.email,
    name = coalesce(public.profiles.name, excluded.name),
    last_name = coalesce(public.profiles.last_name, excluded.last_name),
    position = coalesce(public.profiles.position, excluded.position),
    phone = coalesce(public.profiles.phone, excluded.phone),
    address = coalesce(public.profiles.address, excluded.address),
    role = approved.role,
    must_change_password = false
  returning * into result;

  update public.authorized_users
  set linked_user_id = uid, updated_at = now()
  where email = approved.email;

  return result;
end;
$$;

revoke execute on function public.claim_authorized_profile() from public, anon;
grant execute on function public.claim_authorized_profile() to authenticated;

create or replace function public.bootstrap_profile()
returns public.profiles
language sql
security definer
set search_path = ''
as $$
  select public.claim_authorized_profile();
$$;

revoke execute on function public.bootstrap_profile() from public, anon;
grant execute on function public.bootstrap_profile() to authenticated;

create or replace function public.admin_authorize_gmail(
  p_email text,
  p_name text,
  p_last_name text default null,
  p_position text default null,
  p_phone text default null,
  p_address text default null,
  p_role text default 'employee'
)
returns public.authorized_users
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role text;
  normalized_email text := lower(trim(coalesce(p_email, '')));
  safe_role text := coalesce(p_role, 'employee');
  existing_user_id uuid;
  result public.authorized_users%rowtype;
begin
  select role into actor_role from public.profiles where id = auth.uid();
  if actor_role not in ('admin', 'superadmin') then
    raise exception 'forbidden';
  end if;
  if normalized_email = '' or position('@' in normalized_email) <= 1 then
    raise exception 'invalid_email';
  end if;
  if trim(coalesce(p_name, '')) = '' then
    raise exception 'name_required';
  end if;
  if safe_role not in ('employee', 'admin', 'superadmin') then
    raise exception 'invalid_role';
  end if;
  if actor_role <> 'superadmin' and safe_role <> 'employee' then
    raise exception 'role_forbidden';
  end if;

  select id into existing_user_id
  from auth.users
  where lower(email) = normalized_email
  limit 1;

  insert into public.authorized_users (
    email, linked_user_id, name, last_name, position, phone, address, role, active, added_by
  ) values (
    normalized_email,
    existing_user_id,
    trim(p_name),
    nullif(trim(coalesce(p_last_name, '')), ''),
    nullif(trim(coalesce(p_position, '')), ''),
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_address, '')), ''),
    safe_role,
    true,
    auth.uid()
  )
  on conflict (email) do update set
    linked_user_id = coalesce(public.authorized_users.linked_user_id, excluded.linked_user_id),
    name = excluded.name,
    last_name = excluded.last_name,
    position = excluded.position,
    phone = excluded.phone,
    address = excluded.address,
    role = excluded.role,
    active = true,
    updated_at = now()
  returning * into result;

  if existing_user_id is not null then
    insert into public.profiles (
      id, email, name, last_name, role, position, phone, address, must_change_password
    ) values (
      existing_user_id,
      result.email,
      result.name,
      result.last_name,
      result.role,
      result.position,
      result.phone,
      result.address,
      false
    )
    on conflict (id) do update set
      email = excluded.email,
      name = excluded.name,
      last_name = excluded.last_name,
      role = excluded.role,
      position = excluded.position,
      phone = excluded.phone,
      address = excluded.address,
      must_change_password = false;
  end if;

  return result;
end;
$$;

revoke execute on function public.admin_authorize_gmail(text, text, text, text, text, text, text) from public, anon;
grant execute on function public.admin_authorize_gmail(text, text, text, text, text, text, text) to authenticated;

create or replace function public.admin_list_authorized_users()
returns table (
  record_id text,
  user_id uuid,
  email text,
  name text,
  last_name text,
  "position" text,
  phone text,
  address text,
  role text,
  registered boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role text;
begin
  select p.role into actor_role from public.profiles p where p.id = auth.uid();
  if actor_role not in ('admin', 'superadmin') then
    raise exception 'forbidden';
  end if;

  return query
  select
    coalesce(a.linked_user_id::text, 'pending:' || a.email),
    a.linked_user_id,
    a.email,
    coalesce(p.name, a.name),
    coalesce(p.last_name, a.last_name),
    coalesce(p.position, a.position),
    coalesce(p.phone, a.phone),
    coalesce(p.address, a.address),
    a.role,
    a.linked_user_id is not null,
    a.created_at
  from public.authorized_users a
  left join public.profiles p on p.id = a.linked_user_id
  where a.active
    and (actor_role = 'superadmin' or a.role = 'employee')
  order by a.created_at;
end;
$$;

revoke execute on function public.admin_list_authorized_users() from public, anon;
grant execute on function public.admin_list_authorized_users() to authenticated;

-- Replace the old permissive self-provisioning policy. Profiles now come only
-- from the trusted allowlist trigger/functions above.
drop policy if exists "profiles_insert" on public.profiles;

-- First developer account. The first Google login creates its auth user/profile.
insert into public.authorized_users (email, name, role, active)
values ('adiyasuren1003@gmail.com', 'Adiyasuren', 'superadmin', true)
on conflict (email) do update set
  role = 'superadmin',
  active = true,
  updated_at = now();

notify pgrst, 'reload schema';
