-- Public вэбсайтын текст — админ засварлах

create table if not exists public.public_site_content (
  id text primary key default 'main',
  content jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

alter table public.public_site_content enable row level security;

drop policy if exists "public_site_content_read" on public.public_site_content;
create policy "public_site_content_read" on public.public_site_content
  for select to anon, authenticated using (true);

drop policy if exists "public_site_content_admin_write" on public.public_site_content;
drop policy if exists "public_site_content_admin_insert" on public.public_site_content;
drop policy if exists "public_site_content_admin_update" on public.public_site_content;
drop policy if exists "public_site_content_admin_delete" on public.public_site_content;

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin','superadmin')
  );
$$;

revoke all on function public.is_app_admin() from public;
grant execute on function public.is_app_admin() to authenticated;

create policy "public_site_content_admin_insert" on public.public_site_content
  for insert to authenticated with check (public.is_app_admin());

create policy "public_site_content_admin_update" on public.public_site_content
  for update to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());

create policy "public_site_content_admin_delete" on public.public_site_content
  for delete to authenticated using (public.is_app_admin());

create or replace function public.upsert_public_site_content(p_content jsonb)
returns public.public_site_content
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.public_site_content;
begin
  if not public.is_app_admin() then
    raise exception 'admin_required';
  end if;
  insert into public.public_site_content (id, content, updated_at)
  values ('main', coalesce(p_content, '{}'::jsonb), now())
  on conflict (id) do update
    set content = excluded.content, updated_at = excluded.updated_at
  returning * into result;
  return result;
end;
$$;

revoke all on function public.upsert_public_site_content(jsonb) from public;
grant execute on function public.upsert_public_site_content(jsonb) to authenticated;

grant select on public.public_site_content to anon;
grant select, insert, update, delete on public.public_site_content to authenticated;

notify pgrst, 'reload schema';
