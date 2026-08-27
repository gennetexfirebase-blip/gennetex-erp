-- Аппын татах хуудасны "Upload хийгдэх хугацаа" тоолуур.
--
-- `/app/uplaod` хуудас нь энэ мөрөөс зорилтот цагийг уншиж, DAYS :
-- HOURS : MINUTES : SECONDS хэлбэрээр буурч тоолно. Татах хуудас нь
-- НЭВТРЭЛТГҮЙ тул `anon` уншина — энд хувийн мэдээлэл байхгүй, зөвхөн
-- зарлах цаг.
--
-- ⚠️ Бичих эрхийг хэнд ч ШУУД өгөхгүй. Зөвхөн `set_upload_countdown`
--    RPC-ээр, PIN шалгасны дараа өөрчилнө. Ингэснээр хуудасны хаягийг
--    мэдсэн хүн ямар ч тохиолдолд цагийг дураараа солихгүй.

create table if not exists public.app_upload_countdown (
  id          text primary key default 'main',
  target_at   timestamptz not null,
  label       text not null default 'Upload хийгдэх хугацаа',
  note        text,
  updated_at  timestamptz not null default now()
);

alter table public.app_upload_countdown enable row level security;

drop policy if exists "app_upload_countdown_read" on public.app_upload_countdown;
create policy "app_upload_countdown_read"
  on public.app_upload_countdown
  for select
  to anon, authenticated
  using (true);

-- `anon_lockdown` migration нь anon-оос бүх эрхийг хассан тул энд
-- зөвхөн ЭНЭ хүснэгтийн уншихыг буцааж олгоно.
grant select on public.app_upload_countdown to anon, authenticated;

insert into public.app_upload_countdown (id, target_at, label)
values ('main', now() + interval '1 day', 'Upload хийгдэх хугацаа')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Тохируулах RPC
-- ---------------------------------------------------------------------
-- PIN нь функцийн дотор — хүснэгтэд хадгалбал `anon` уншиж чадна
-- (RLS нь багана түвшинд ажилладаггүй).
create or replace function public.set_upload_countdown(
  p_pin    text,
  p_target timestamptz,
  p_label  text default null,
  p_note   text default null
)
returns public.app_upload_countdown
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.app_upload_countdown;
begin
  if p_pin is distinct from '284613' then
    raise exception 'invalid_pin' using hint = 'PIN буруу байна.';
  end if;
  if p_target is null then
    raise exception 'target_required' using hint = 'Огноо, цагийг сонгоно уу.';
  end if;

  update public.app_upload_countdown
     set target_at  = p_target,
         label      = coalesce(nullif(trim(p_label), ''), label),
         note       = nullif(trim(p_note), ''),
         updated_at = now()
   where id = 'main'
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.set_upload_countdown(text, timestamptz, text, text)
  to anon, authenticated;

notify pgrst, 'reload schema';
