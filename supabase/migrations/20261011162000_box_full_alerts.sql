-- «Дүүрсэн бокс»: ажилтан дүүрсэн боксны зургийг авахад GPS байршил шууд
-- хадгалагдана. Дараа нь хэн нэгэн ажлын үеэр тэр байршилд ойртоход (≈150 м)
-- «Энэ бокс дүүрэн байна» гэсэн зурагтай push очно. Бокс хоосорсны дараа
-- «Шийдсэн» болгоход мэдэгдэл зогсоно.

alter table public.field_work_records drop constraint if exists field_work_records_kind_check;
alter table public.field_work_records
  add constraint field_work_records_kind_check check (kind in ('box_tag', 'transfer', 'box_full'));
alter table public.field_work_records alter column after_path drop not null;
alter table public.field_work_records
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by uuid references public.profiles(id) on delete set null,
  add column if not exists resolved_by_name text;

alter table public.field_work_records drop constraint if exists field_work_records_photos_check;
alter table public.field_work_records
  add constraint field_work_records_photos_check check (kind = 'box_full' or after_path is not null);

create index if not exists field_work_records_box_full_idx
  on public.field_work_records (latitude, longitude)
  where kind = 'box_full' and resolved_at is null;

-- Дүүрсэн боксыг бүх ажилтан харна (ойртоход мэдэгдэл авч, очиж шийдэх).
drop policy if exists field_work_select on public.field_work_records;
create policy field_work_select on public.field_work_records for select to authenticated
using (created_by = auth.uid() or kind = 'box_full' or public.field_work_viewer_rank() >= 1);

-- «Шийдсэн» болгох — RPC-ээр (зөвхөн resolved_* талбарыг өөрчилнө).
create or replace function public.resolve_full_box(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_name text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select coalesce(nullif(btrim(name), ''), email) into v_name from public.profiles where id = auth.uid();
  update public.field_work_records
     set resolved_at = now(), resolved_by = auth.uid(), resolved_by_name = v_name
   where id = p_id and kind = 'box_full' and resolved_at is null;
end;
$$;

revoke all on function public.resolve_full_box(uuid) from public, anon;
grant execute on function public.resolve_full_box(uuid) to authenticated;

-- Хэнд аль бокс мэдэгдсэн — давтан push явуулахгүй.
create table if not exists public.box_full_alerts (
  record_id   uuid not null references public.field_work_records(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  notified_at timestamptz not null default now(),
  primary key (record_id, user_id)
);
alter table public.box_full_alerts enable row level security;
revoke all on public.box_full_alerts from anon, authenticated;

/**
 * Ойролцоох шийдэгдээгүй дүүрсэн боксууд. Буцаасан мөрийг «мэдэгдсэн»
 * гэж тэмдэглэнэ — тухайн хүнд 12 цагт нэгээс олон удаа ирэхгүй.
 */
create or replace function public.full_boxes_near(p_lat double precision, p_lng double precision, p_radius_m double precision default 150)
returns table(id uuid, box_code text, note text, before_path text, created_by_name text, created_at timestamptz, distance_m double precision)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_deg double precision := greatest(p_radius_m, 30) / 111000.0;
begin
  if v_uid is null or p_lat is null or p_lng is null then return; end if;
  return query
  with near as (
    select r.id, r.box_code, r.note, r.before_path, r.created_by_name, r.created_at,
           public.tracking_distance(p_lat, p_lng, r.latitude, r.longitude) as d
    from public.field_work_records r
    where r.kind = 'box_full' and r.resolved_at is null
      and r.latitude between p_lat - v_deg and p_lat + v_deg
      and r.longitude between p_lng - v_deg * 1.6 and p_lng + v_deg * 1.6
      and r.created_by is distinct from v_uid
      and not exists (
        select 1 from public.box_full_alerts a
        where a.record_id = r.id and a.user_id = v_uid and a.notified_at > now() - interval '12 hours'
      )
  ), hit as (
    select * from near where near.d <= p_radius_m
  ), mark as (
    insert into public.box_full_alerts(record_id, user_id, notified_at)
    select hit.id, v_uid, now() from hit
    on conflict (record_id, user_id) do update set notified_at = excluded.notified_at
  )
  select hit.id, hit.box_code, hit.note, hit.before_path, hit.created_by_name, hit.created_at, hit.d from hit;
end;
$$;

revoke all on function public.full_boxes_near(double precision, double precision, double precision) from public, anon;
grant execute on function public.full_boxes_near(double precision, double precision, double precision) to authenticated;

-- Зураг: дүүрсэн боксны зураг `box_full/<user_id>/...` — бүх ажилтан харна
-- (push-д зураг хавсаргана).
drop policy if exists field_work_photos_select on storage.objects;
create policy field_work_photos_select on storage.objects for select to authenticated
using (bucket_id = 'field-work-photos'
       and ((storage.foldername(name))[1] = auth.uid()::text
            or (storage.foldername(name))[1] = 'box_full'
            or public.field_work_viewer_rank() >= 1));

drop policy if exists field_work_photos_insert on storage.objects;
create policy field_work_photos_insert on storage.objects for insert to authenticated
with check (bucket_id = 'field-work-photos'
            and ((storage.foldername(name))[1] = auth.uid()::text
                 or ((storage.foldername(name))[1] = 'box_full' and (storage.foldername(name))[2] = auth.uid()::text)));

notify pgrst, 'reload schema';
