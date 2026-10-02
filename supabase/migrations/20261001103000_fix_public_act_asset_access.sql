create or replace function public.act_public_asset_access(p_act_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.acts a
    where a.id::text = p_act_id
      and a.public_share_enabled
      and a.deleted_at is null
      and a.status in ('ready', 'approved', 'delivered')
  );
$$;

revoke all on function public.act_public_asset_access(text) from public;
grant execute on function public.act_public_asset_access(text) to anon, authenticated;

drop policy if exists act_files_public_shared_select on storage.objects;
create policy act_files_public_shared_select on storage.objects
for select to anon, authenticated
using (
  bucket_id = 'act-files'
  and public.act_public_asset_access((storage.foldername(name))[1])
);

notify pgrst, 'reload schema';
