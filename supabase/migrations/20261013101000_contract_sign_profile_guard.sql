-- Гарын үсэг зурахад employee_id-г зөвхөн profiles-д бичлэгтэй үед бөглөнө
-- (профайлгүй шинэ хэрэглэгч FK алдаанаас болж гарын үсэг зурж чадахгүй байв).
create or replace function public.sign_employment_contract(p_id uuid, p_signature_path text)
returns public.employment_contracts
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.employment_contracts%rowtype;
  me uuid := auth.uid();
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if not public.is_contract_party(p_id) then raise exception 'permission_denied'; end if;
  if p_signature_path is null or p_signature_path not like p_id::text || '/%' then
    raise exception 'invalid_signature';
  end if;
  update public.employment_contracts c
     set status = 'signed', employee_signature_path = p_signature_path, employee_signed_at = now(),
         employee_id = coalesce(c.employee_id, (select p.id from public.profiles p where p.id = me))
   where c.id = p_id and c.status = 'sent'
  returning * into result;
  if result.id is null then raise exception 'invalid_status'; end if;
  return result;
end;
$$;

revoke all on function public.sign_employment_contract(uuid, text) from public, anon;
grant execute on function public.sign_employment_contract(uuid, text) to authenticated;
