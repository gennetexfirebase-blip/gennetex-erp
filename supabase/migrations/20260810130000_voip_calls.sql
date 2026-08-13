-- ============================================================================
-- VoIP дуудлагын систем — өгөгдлийн сангийн суурь
-- ============================================================================
--
-- ОДОО БАЙГАА ЗҮЙЛСИЙГ ЭВДЭХГҮЙ:
--   • `call_sessions` хүснэгт хэвээр үлдэнэ (Jitsi горим ажилласаар байна).
--     Шинэ `calls` хүснэгт нь WebRTC урсгалд зориулагдсан — зэрэгцэн орших
--     бөгөөд шилжилт дууссаны дараа хуучныг цэвэрлэнэ.
--   • `push_tokens` хүснэгтийг УСТГАХГҮЙ, өргөтгөнө.
--
-- ЯАГААД ШИНЭ ХҮСНЭГТ:
--   `call_sessions` нь `room` (Jitsi өрөөний нэр) төвтэй, статус нь 4 утгатай,
--   хугацааны талбаргүй, RLS-гүй. WebRTC-д хэрэгтэй state machine, дуудлагын
--   төрөл, үргэлжлэх хугацаа, дуусгасан тал зэргийг агуулж чадахгүй.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. Төхөөрөмжийн token
-- ---------------------------------------------------------------------------
-- Одоогийн `push_tokens` нь (user_id, token) төвтэй бөгөөд VoIP token-ыг
-- ялгаж хадгалж чадахгүй. iOS дээр PushKit нь ЭНГИЙН push-аас ӨӨР token
-- ашигладаг тул хоёуланг нь нэг мөрөнд хадгалах шаардлагатай.

create table if not exists public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null check (platform in ('ios', 'android', 'web')),
  -- Энгийн мэдэгдэл (FCM / Expo)
  fcm_token text,
  -- iOS PushKit VoIP token — CallKit-ийг сэрээхэд ЗӨВХӨН энэ ажиллана
  voip_token text,
  -- Тогтвортой төхөөрөмжийн ID (ANDROID_ID / idForVendor)
  device_id text,
  device_name text,
  app_version text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  -- Ядаж нэг token байх ёстой
  constraint device_tokens_has_token check (fcm_token is not null or voip_token is not null)
);

-- Нэг хэрэглэгч · нэг төхөөрөмж = нэг мөр.
-- device_id null байвал (хуучин клиент) fcm_token-оор ялгана.
create unique index if not exists device_tokens_user_device_uniq
  on public.device_tokens (user_id, device_id)
  where device_id is not null;

create unique index if not exists device_tokens_user_fcm_uniq
  on public.device_tokens (user_id, fcm_token)
  where device_id is null and fcm_token is not null;

create index if not exists device_tokens_user_active_idx
  on public.device_tokens (user_id, is_active);


-- ---------------------------------------------------------------------------
-- 2. Дуудлага
-- ---------------------------------------------------------------------------

create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  caller_id uuid not null references public.profiles(id) on delete cascade,
  callee_id uuid not null references public.profiles(id) on delete cascade,
  type text not null default 'audio' check (type in ('audio', 'video')),
  status text not null default 'initiated' check (status in (
    'initiated',   -- backend үүсгэсэн, push илгээгээгүй
    'ringing',     -- push хүрсэн, callee дуугарч байна
    'accepted',    -- хариулсан
    'declined',    -- татгалзсан
    'busy',        -- callee өөр дуудлага дээр
    'missed',      -- хугацаа дууссан
    'cancelled',   -- caller цуцалсан
    'failed',      -- техникийн алдаа
    'ended',       -- хэвийн дууссан
    'unreachable'  -- идэвхтэй төхөөрөмж олдсонгүй
  )),
  created_at timestamptz not null default now(),
  ringing_at timestamptz,
  answered_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  ended_by uuid references public.profiles(id) on delete set null,
  failure_reason text,
  -- Аль төхөөрөмж хариулсныг тэмдэглэнэ — бусад төхөөрөмжийн дуугаралт зогсооно
  answered_device_id text,
  constraint calls_no_self check (caller_id <> callee_id),
  constraint calls_duration_nonneg check (duration_seconds is null or duration_seconds >= 0)
);

create index if not exists calls_caller_idx  on public.calls (caller_id, created_at desc);
create index if not exists calls_callee_idx  on public.calls (callee_id, created_at desc);
create index if not exists calls_status_idx  on public.calls (status);
create index if not exists calls_created_idx on public.calls (created_at desc);

-- Идэвхтэй дуудлага хайхад (завгүй эсэхийг шалгах)
create index if not exists calls_active_idx
  on public.calls (callee_id, status)
  where status in ('initiated', 'ringing', 'accepted');


-- ---------------------------------------------------------------------------
-- 3. RLS
-- ---------------------------------------------------------------------------

alter table public.device_tokens enable row level security;
alter table public.calls         enable row level security;

-- --- device_tokens ---
-- Хэрэглэгч ЗӨВХӨН өөрийн token-оо удирдана.
-- ⚠️ Push илгээхийн тулд ӨӨР хүний token уншихыг клиентэд ЗӨВШӨӨРӨХГҮЙ —
--    тэр нь Edge Function дээр service role-оор хийгдэнэ.

drop policy if exists "device_tokens_own_select" on public.device_tokens;
create policy "device_tokens_own_select" on public.device_tokens
  for select using (user_id = auth.uid());

drop policy if exists "device_tokens_own_insert" on public.device_tokens;
create policy "device_tokens_own_insert" on public.device_tokens
  for insert with check (user_id = auth.uid());

drop policy if exists "device_tokens_own_update" on public.device_tokens;
create policy "device_tokens_own_update" on public.device_tokens
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "device_tokens_own_delete" on public.device_tokens;
create policy "device_tokens_own_delete" on public.device_tokens
  for delete using (user_id = auth.uid());

-- --- calls ---
-- Зөвхөн оролцогч талууд харна.
drop policy if exists "calls_participant_select" on public.calls;
create policy "calls_participant_select" on public.calls
  for select using (caller_id = auth.uid() or callee_id = auth.uid());

-- ⚠️ INSERT-ийг клиентэд ЗӨВШӨӨРӨХГҮЙ.
--    Өмнөх `call_sessions` дээр клиент өөрөө caller_id илгээдэг байсан тул
--    хэн ч өөр хүний нэрээр дуудлага үүсгэж чаддаг байв. Дуудлага үүсгэх нь
--    зөвхөн доорх `call_start` функцээр (security definer) явна.

-- Төлөв солих — оролцогч тал, гэхдээ зөвхөн зөвшөөрөгдсөн шилжилт.
-- Бодит шалгалт нь доорх функцүүдэд байгаа тул шууд UPDATE-ийг хаана.
drop policy if exists "calls_participant_update" on public.calls;


-- ---------------------------------------------------------------------------
-- 4. Дуудлага эхлүүлэх — АЮУЛГҮЙ
-- ---------------------------------------------------------------------------
-- caller_id-г auth.uid()-аас ӨӨРӨӨ тодорхойлно. Клиентээс ирсэнд итгэхгүй.

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

  -- Callee өөр дуудлага дээр байна уу?
  select count(*) into v_active
  from public.calls c
  where c.callee_id = p_callee_id
    and c.status in ('ringing', 'accepted');
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


-- ---------------------------------------------------------------------------
-- 5. Төлөв солих — зөвшөөрөгдсөн шилжилт бүрд нэг функц
-- ---------------------------------------------------------------------------
-- Санамсаргүй давхар дуудалтад тэсвэртэй (idempotent): аль хэдийн тухайн
-- төлөвт байвал алдаа шидэхгүй, одоогийн мөрийг буцаана.

create or replace function public.call_transition(
  p_call_id uuid,
  p_status text,
  p_device_id text default null,
  p_reason text default null
)
returns public.calls
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.calls%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select * into v_row from public.calls c where c.id = p_call_id for update;
  if v_row.id is null then raise exception 'call_not_found'; end if;

  -- Зөвхөн оролцогч тал
  if v_uid <> v_row.caller_id and v_uid <> v_row.callee_id then
    raise exception 'forbidden';
  end if;

  -- Аль хэдийн энэ төлөвт байвал чимээгүй буцаана (давхар push/tap)
  if v_row.status = p_status then return v_row; end if;

  -- Дууссан дуудлагыг дахин өөрчлөхгүй — хоцорсон push ирэхэд хамгаална
  if v_row.status in ('ended','declined','missed','cancelled','failed','busy','unreachable') then
    return v_row;
  end if;

  if p_status = 'ringing' then
    update public.calls set status = 'ringing', ringing_at = coalesce(ringing_at, now())
     where id = p_call_id returning * into v_row;

  elsif p_status = 'accepted' then
    -- Зөвхөн хүлээн авагч хариулна
    if v_uid <> v_row.callee_id then raise exception 'only_callee_can_accept'; end if;
    update public.calls
       set status = 'accepted', answered_at = now(), answered_device_id = p_device_id
     where id = p_call_id returning * into v_row;

  elsif p_status = 'declined' then
    if v_uid <> v_row.callee_id then raise exception 'only_callee_can_decline'; end if;
    update public.calls set status = 'declined', ended_at = now(), ended_by = v_uid
     where id = p_call_id returning * into v_row;

  elsif p_status = 'cancelled' then
    if v_uid <> v_row.caller_id then raise exception 'only_caller_can_cancel'; end if;
    update public.calls set status = 'cancelled', ended_at = now(), ended_by = v_uid
     where id = p_call_id returning * into v_row;

  elsif p_status = 'ended' then
    -- Үргэлжлэх хугацааг СЕРВЕРИЙН цагаар тооцно — клиентээс ирсэнд итгэхгүй
    update public.calls
       set status = 'ended',
           ended_at = now(),
           ended_by = v_uid,
           duration_seconds = case
             when answered_at is not null
               then greatest(0, extract(epoch from (now() - answered_at))::integer)
             else 0
           end
     where id = p_call_id returning * into v_row;

  elsif p_status in ('missed','failed','busy','unreachable') then
    update public.calls
       set status = p_status, ended_at = now(), failure_reason = p_reason
     where id = p_call_id returning * into v_row;

  else
    raise exception 'invalid_status';
  end if;

  return v_row;
end;
$$;

revoke execute on function public.call_transition(uuid, text, text, text) from public, anon;
grant  execute on function public.call_transition(uuid, text, text, text) to authenticated;


-- ---------------------------------------------------------------------------
-- 6. Дуудлагын түүх
-- ---------------------------------------------------------------------------

create or replace function public.call_history(p_limit int default 100)
returns table (
  id uuid,
  direction text,
  other_id uuid,
  other_name text,
  other_avatar text,
  type text,
  status text,
  created_at timestamptz,
  answered_at timestamptz,
  duration_seconds integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  return query
  select
    c.id,
    case when c.caller_id = v_uid then 'outgoing' else 'incoming' end,
    case when c.caller_id = v_uid then c.callee_id else c.caller_id end,
    p.name,
    p.avatar_url,
    c.type,
    c.status,
    c.created_at,
    c.answered_at,
    c.duration_seconds
  from public.calls c
  left join public.profiles p
    on p.id = case when c.caller_id = v_uid then c.callee_id else c.caller_id end
  where c.caller_id = v_uid or c.callee_id = v_uid
  order by c.created_at desc
  limit least(coalesce(p_limit, 100), 500);
end;
$$;

revoke execute on function public.call_history(int) from public, anon;
grant  execute on function public.call_history(int) to authenticated;


-- ---------------------------------------------------------------------------
-- 7. Хугацаа хэтэрсэн дуудлагыг цэвэрлэх
-- ---------------------------------------------------------------------------
-- Зөвхөн утасны timer-т найдвал апп хаагдахад дуудлага үүрд "ringing"
-- төлөвт үлдэнэ. Үүнийг Edge Function эсвэл cron-оор дуудна.

create or replace function public.call_expire_stale(p_seconds int default 45)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  update public.calls
     set status = 'missed',
         ended_at = now(),
         failure_reason = 'timeout'
   where status in ('initiated', 'ringing')
     and created_at < now() - make_interval(secs => greatest(10, p_seconds));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.call_expire_stale(int) from public, anon;

notify pgrst, 'reload schema';
