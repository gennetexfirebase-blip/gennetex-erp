-- ============================================================================
-- adiyasuren.gennetex.com/system/admin/ — verify.mn орлого (зөвхөн эзэмшигч)
-- ============================================================================
--   verify.mn: баталгаажсан дугаар бүрт хөгжүүлэгч 40₮ авна (хэрэглэгч 150₮ төлнө).
--   Сесс бүр phone_verification_sessions-д (admin-gate, data-gate, хуучин
--   /api/verify-phone). Зөвхөн adiyasuren1003@gmail.com-ээр нэвтэрсэн хүн уншина.
--   Өмнөх gate-ийн баталгаажуулалт (энэ бүртгэлээс өмнөх) data_access_log-оос тоологдоно.
-- ============================================================================

create or replace function public.owner_verify_income()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  per_verify constant int := 40;
  logged_since timestamptz := coalesce((select min(created_at) from public.phone_verification_sessions where subject_type in ('admin_gate', 'data_gate')), now());
  earlier int;
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'adiyasuren1003@gmail.com' then
    raise exception 'not_found';
  end if;

  select count(*) into earlier from public.data_access_log l
  where l.action in ('phone_ok', 'admin:phone_ok') and l.created_at < logged_since;

  return jsonb_build_object(
    'per_verify', per_verify,
    'earlier', earlier,
    'verified', coalesce((select jsonb_agg(jsonb_build_object(
        'phone', s.phone, 'at', s.verified_at, 'source', s.subject_type,
        'name', nullif(trim(coalesce(p.last_name, '') || ' ' || coalesce(p.name, '')), ''))
        order by s.verified_at desc)
      from public.phone_verification_sessions s
      left join public.profiles p on p.id = s.created_by
      where s.session_status = 'VERIFIED'), '[]'::jsonb),
    'pending', (select count(*) from public.phone_verification_sessions where session_status = 'PENDING' and expires_at > now()),
    'expired', (select count(*) from public.phone_verification_sessions where session_status = 'EXPIRED' or (session_status = 'PENDING' and expires_at <= now()))
  );
end;
$$;
revoke all on function public.owner_verify_income() from public, anon;
grant execute on function public.owner_verify_income() to authenticated;

notify pgrst, 'reload schema';
