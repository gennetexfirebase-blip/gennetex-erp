-- Орлогын хуудас: бүртгэл (phone_verification_sessions) эхлэхээс өмнөх gate-ийн
-- баталгаажуулалтуудын дугаарыг аудит логийн user_id → profiles.phone-оор сэргээж харуулна.
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
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'adiyasuren1003@gmail.com' then
    raise exception 'not_found';
  end if;

  return jsonb_build_object(
    'per_verify', per_verify,
    'earlier', 0,
    'verified', coalesce((select jsonb_agg(v order by v->>'at' desc) from (
        select jsonb_build_object('phone', s.phone, 'at', s.verified_at, 'source', s.subject_type,
                                  'name', nullif(trim(coalesce(p.last_name, '') || ' ' || coalesce(p.name, '')), '')) v
        from public.phone_verification_sessions s
        left join public.profiles p on p.id = s.created_by
        where s.session_status = 'VERIFIED'
        union all
        select jsonb_build_object('phone', coalesce(nullif(regexp_replace(coalesce(p.phone, ''), '[^0-9]', '', 'g'), ''), '—'),
                                  'at', l.created_at,
                                  'source', case when l.action like 'admin:%' then 'admin_gate' else 'data_gate' end,
                                  'name', nullif(trim(coalesce(p.last_name, '') || ' ' || coalesce(p.name, '')), ''))
        from public.data_access_log l
        left join public.profiles p on p.id = l.user_id
        where l.action in ('phone_ok', 'admin:phone_ok') and l.created_at < logged_since
      ) q), '[]'::jsonb),
    'pending', (select count(*) from public.phone_verification_sessions where session_status = 'PENDING' and expires_at > now()),
    'expired', (select count(*) from public.phone_verification_sessions where session_status = 'EXPIRED' or (session_status = 'PENDING' and expires_at <= now()))
  );
end;
$$;
revoke all on function public.owner_verify_income() from public, anon;
grant execute on function public.owner_verify_income() to authenticated;
notify pgrst, 'reload schema';
