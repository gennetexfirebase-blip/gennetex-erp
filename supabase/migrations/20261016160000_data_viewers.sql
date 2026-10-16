-- data.gennetex.com / bayasgalan.gennetex.com — «зөвхөн харах» эрх.
--
-- Superadmin нь data сайтын «Харах эрх» хэсгээс ажилтан нэмнэ. Тэр хүн мөн
-- 4 шатаар (утас → Gmail код → Google → нууц үг) нэвтэрч, хүснэгт ба файлыг
-- зөвхөн харна (data сайт юу ч өөрчилдөггүй). Эрх олгох/хасахыг зөвхөн superadmin.

create table if not exists public.data_viewers (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now()
);
alter table public.data_viewers enable row level security;
revoke all on public.data_viewers from anon, authenticated;
-- Бодлого байхгүй — зөвхөн edge function (service role).
