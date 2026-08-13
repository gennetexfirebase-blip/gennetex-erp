-- ---------------------------------------------------------------------------
-- Хугацаа хэтэрсэн дуудлагыг автоматаар хаах
-- ---------------------------------------------------------------------------
-- Утасны timer-т найдаж болохгүй: апп хаагдах, батерей дуусах, сүлжээ тасрах
-- зэрэгт дуудлага үүрд `ringing` төлөвт үлдэнэ. Тэгвэл тухайн хэрэглэгч
-- "завгүй" гэж тооцогдож, дараагийн дуудлага бүр `callee_busy` алдаа өгнө —
-- өөрөөр хэлбэл нэг тасарсан дуудлага хэрэглэгчийг бүрмөсөн хаана.
--
-- Тиймээс сервер тал ӨӨРӨӨ цэвэрлэнэ.

do $$
begin
  -- pg_cron нь Supabase дээр байдаг ч зарим төлөвлөгөөнд идэвхгүй байж
  -- болно. Байхгүй бол migration бүхэлдээ унах ёсгүй — цэвэрлэгээ нь
  -- call-notify доторх дуудалтаар ажилласаар байна.
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;

    -- Хуучин хуваарийг устгаад дахин үүсгэнэ — migration дахин ажиллахад
    -- давхардсан ажил үүсэхээс сэргийлнэ.
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'gennetex_expire_stale_calls';

    perform cron.schedule(
      'gennetex_expire_stale_calls',
      '* * * * *',                       -- минут тутам
      $cron$select public.call_expire_stale(45);$cron$
    );
  else
    raise notice 'pg_cron байхгүй — дуудлагын цэвэрлэгээг Edge Function хийнэ.';
  end if;
exception
  when insufficient_privilege then
    raise notice 'pg_cron дээр эрх хүрэлцэхгүй — дуудлагын цэвэрлэгээг Edge Function хийнэ.';
end;
$$;

-- ---------------------------------------------------------------------------
-- Давхар хамгаалалт: шинэ дуудлага эхлэхийн ӨМНӨ хуучныг цэвэрлэнэ
-- ---------------------------------------------------------------------------
-- cron ажиллахгүй байсан ч хэрэглэгч дуудлага хийх бүрд хуучирсан мөрүүд
-- хаагдана. Цэвэрлэгээ нь "завгүй" шалгалтаас ӨМНӨ явагдах ёстой —
-- эсрэгээр бол тасарсан хуучин дуудлага энэ дуудлагыг хаачихна.
--
-- Мөн "завгүй" шалгалтад `ringing`-ийн хугацааг нэмж шалгав: цэвэрлэгээ
-- ямар нэг шалтгаанаар алдвал ч 45 секундээс хэтэрсэн дуудлага
-- хэрэглэгчийг завгүй болгохгүй.

create or replace function public.call_start(p_callee_id uuid, p_type text default 'audio')
returns public.calls
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_callee public.profiles%rowtype;
  v_active int;
  v_row public.calls%rowtype;
begin
  if v_caller is null then raise exception 'not_authenticated'; end if;
  if p_type not in ('audio', 'video') then raise exception 'invalid_type'; end if;
  if p_callee_id = v_caller then raise exception 'cannot_call_self'; end if;

  select * into v_callee from public.profiles p where p.id = p_callee_id;
  if v_callee.id is null then raise exception 'callee_not_found'; end if;

  -- Хугацаа хэтэрсэн дуудлагыг эхлээд хаана
  perform public.call_expire_stale(45);

  -- Callee өөр дуудлага дээр байна уу?
  select count(*) into v_active
  from public.calls c
  where c.callee_id = p_callee_id
    and (
      c.status = 'accepted'
      or (c.status = 'ringing' and c.created_at > now() - interval '45 seconds')
    );
  if v_active > 0 then raise exception 'callee_busy'; end if;

  -- Caller өөрөө өөр дуудлага дээр байвал эхлээд түүнийгээ дуусгана
  update public.calls c
     set status = 'ended', ended_at = now(), ended_by = v_caller
   where c.caller_id = v_caller
     and c.status in ('initiated', 'ringing');

  insert into public.calls (caller_id, callee_id, type, status)
  values (v_caller, p_callee_id, p_type, 'initiated')
  returning * into v_row;

  return v_row;
end;
$$;

revoke execute on function public.call_start(uuid, text) from public, anon;
grant  execute on function public.call_start(uuid, text) to authenticated;
