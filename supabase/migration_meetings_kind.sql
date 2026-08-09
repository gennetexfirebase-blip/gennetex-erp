-- Live stream vs Хурал тусгаарлах
alter table public.meetings
  add column if not exists kind text not null default 'live';

do $$
begin
  alter table public.meetings drop constraint if exists meetings_kind_check;
  alter table public.meetings
    add constraint meetings_kind_check check (kind in ('live', 'meeting'));
exception when others then null;
end $$;

create index if not exists meetings_kind_status_idx
  on public.meetings (kind, status, started_at desc);

notify pgrst, 'reload schema';
