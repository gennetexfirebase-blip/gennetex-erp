-- ХААБ (Хөдөлмөрийн аюулгүй байдал) заавар + өдөр бүрийн гарын үсэг

create table if not exists public.ohaab_instruction (
  id int primary key default 1 check (id = 1),
  title text not null default 'ХААБ заавар',
  body text not null default '',
  updated_at timestamptz default now(),
  updated_by uuid references auth.users(id) on delete set null,
  updated_by_name text
);

insert into public.ohaab_instruction (id, title, body)
values (1, 'ХААБ заавар', 'Админ энд аюулгүй ажиллагааны заавар оруулна.')
on conflict (id) do nothing;

create table if not exists public.ohaab_daily_ack (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_name text,
  ack_date date not null default (timezone('Asia/Ulaanbaatar', now()))::date,
  signature_url text,
  instruction_updated_at timestamptz,
  signed_at timestamptz default now(),
  unique (user_id, ack_date)
);

create index if not exists ohaab_daily_ack_date_idx
  on public.ohaab_daily_ack (ack_date desc);

create index if not exists ohaab_daily_ack_user_idx
  on public.ohaab_daily_ack (user_id, ack_date desc);

alter table public.ohaab_instruction enable row level security;
alter table public.ohaab_daily_ack enable row level security;

drop policy if exists "ohaab_instruction_all" on public.ohaab_instruction;
create policy "ohaab_instruction_all" on public.ohaab_instruction
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "ohaab_daily_ack_all" on public.ohaab_daily_ack;
create policy "ohaab_daily_ack_all" on public.ohaab_daily_ack
  for all to anon, authenticated using (true) with check (true);

grant select, insert, update, delete on public.ohaab_instruction to anon, authenticated;
grant select, insert, update, delete on public.ohaab_daily_ack to anon, authenticated;

notify pgrst, 'reload schema';
