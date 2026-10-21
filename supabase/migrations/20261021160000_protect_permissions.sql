-- Модулийн эрхийг (profiles.permissions) зөвхөн системийн админ (superadmin) өөрчилнө.
--
-- Цоорхой: profiles_self_update / profiles_admin_update RLS нь мөрийг шууд засахыг зөвшөөрдөг тул
-- админ (эсвэл ажилтан өөрөө) REST-ээр permissions-оо өөрчилж, системийн админы хаасан эрхийг
-- (ж: цалин) эргүүлж нээх боломжтой байв. Одоо:
--   • superadmin (admin_set_user_permissions, апп/вэб) — зөвшөөрнө
--   • auth.uid() байхгүй (service role: adiyasuren.gennetex.com/system/admin-ийн admin-gate) — зөвшөөрнө
--   • бусад хэн ч — хориглоно.
-- Системийн админы профайлыг (role, нэр …) бусад хүн өөрчлөхийг protect_superadmin_profile аль хэдийн хориглодог.

create or replace function public.protect_profile_permissions()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if new.permissions is distinct from old.permissions
     and auth.uid() is not null
     and not public.is_superadmin() then
    raise exception 'permissions_superadmin_only';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_permissions on public.profiles;
create trigger protect_profile_permissions
before update of permissions on public.profiles
for each row execute function public.protect_profile_permissions();
