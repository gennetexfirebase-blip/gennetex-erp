-- Авсан сургалтын сертификат.
--
--   • Сургалт өөрөө сертификат олгодог бол админ тэр сертификатын зургийг
--     ажилтны сургалтын мөрөнд оруулна (`certificate_path`).
--   • Сертификатгүй сургалт хамрагдсан бол апп Женнетексийн загвараар
--     (тамга, Захирлын нэртэй) сертификатыг өөрөө үүсгэнэ — DB-д юу ч
--     хадгалахгүй.
--
-- Зураг: хувийн `training-certificates` bucket, зам `<assignment_id>/<file>`.
-- Ажилтан өөрийнхөө, удирдагч удирдах ажилтныхаа сертификатыг харна.

alter table public.employee_training_assignments
  add column if not exists certificate_path text,
  add column if not exists certificate_uploaded_at timestamptz;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('training-certificates', 'training-certificates', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp']::text[])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.training_certificate_access(p_folder text, p_manage boolean)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.employee_training_assignments t
    where t.id::text = p_folder
      and (
        public.can_manage_employee_training(t.employee_email)
        or (not p_manage and lower(t.employee_email) = lower(coalesce(auth.jwt() ->> 'email', '')))
      )
  );
$$;

revoke all on function public.training_certificate_access(text, boolean) from public, anon;
grant execute on function public.training_certificate_access(text, boolean) to authenticated;

drop policy if exists training_certificates_select on storage.objects;
create policy training_certificates_select on storage.objects for select to authenticated
using (bucket_id = 'training-certificates'
       and public.training_certificate_access((storage.foldername(name))[1], false));

drop policy if exists training_certificates_insert on storage.objects;
create policy training_certificates_insert on storage.objects for insert to authenticated
with check (bucket_id = 'training-certificates'
            and public.training_certificate_access((storage.foldername(name))[1], true));

drop policy if exists training_certificates_update on storage.objects;
create policy training_certificates_update on storage.objects for update to authenticated
using (bucket_id = 'training-certificates'
       and public.training_certificate_access((storage.foldername(name))[1], true))
with check (bucket_id = 'training-certificates'
            and public.training_certificate_access((storage.foldername(name))[1], true));

drop policy if exists training_certificates_delete on storage.objects;
create policy training_certificates_delete on storage.objects for delete to authenticated
using (bucket_id = 'training-certificates'
       and public.training_certificate_access((storage.foldername(name))[1], true));

notify pgrst, 'reload schema';
