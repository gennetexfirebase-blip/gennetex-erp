-- Gennetex AI (ai.gennetex.com) — харилцан яриа ба мэдлэгийн сан
--
-- Гурван хүснэгт:
--   ai_conversations  нэг зочны нэг яриа
--   ai_messages       тухайн яриан дахь мөр бүр
--   ai_knowledge      "сурсан" зүйлс — асуулт/хариултын хос, админ засна
--
-- ⚠️ Загвар (qwen3) ЭНД ажиллахгүй. Edge Function нь зөвхөн контекст
--    бэлдэж, гадаад загварын сервер рүү дамжуулж, үр дүнг хадгална.

create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- Яриа
-- ---------------------------------------------------------------------------
create table if not exists public.ai_conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  -- Нэвтрээгүй зочныг ялгах түлхүүр (браузерт хадгалагдана).
  guest_key   text,
  title       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists ai_conversations_updated_idx
  on public.ai_conversations (updated_at desc);

-- ---------------------------------------------------------------------------
-- Мөр бүр
-- ---------------------------------------------------------------------------
create table if not exists public.ai_messages (
  id               bigserial primary key,
  conversation_id  uuid not null references public.ai_conversations(id) on delete cascade,
  role             text not null check (role in ('user', 'assistant', 'system')),
  content          text not null,
  -- Хариу үүсгэхэд зарцуулсан хугацаа, ашигласан загвар — чанарын хяналтад.
  model            text,
  duration_ms      integer,
  created_at       timestamptz not null default now()
);

create index if not exists ai_messages_conversation_idx
  on public.ai_messages (conversation_id, created_at);

-- ---------------------------------------------------------------------------
-- Мэдлэг — "сурсан" зүйл
--
-- Ярианаас гарсан сайн хариулт, эсвэл админы гараар оруулсан баримт.
-- Хайлт нь монгол кирилл болон латин галиг ХОЁУЛАНГ нь барихын тулд
-- `search_text` дотор аль алиныг нь хадгална.
-- ---------------------------------------------------------------------------
create table if not exists public.ai_knowledge (
  id           uuid primary key default gen_random_uuid(),
  question     text not null,
  answer       text not null,
  -- Кирилл + галиг хосолсон хайлтын талбар (`ai_knowledge_sync` бөглөнө).
  search_text  text not null default '',
  tags         text[] not null default '{}',
  source       text not null default 'manual' check (source in ('manual', 'conversation')),
  approved     boolean not null default false,
  hits         integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists ai_knowledge_search_idx
  on public.ai_knowledge using gin (search_text gin_trgm_ops);
create index if not exists ai_knowledge_approved_idx
  on public.ai_knowledge (approved);

-- ---------------------------------------------------------------------------
-- Латин галиг → кирилл рүү ойролцоо буулгах
--
-- Зорилго нь төгс хөрвүүлэг БИШ, харин "sain baina uu" гэж бичсэн хүнийг
-- "сайн байна уу" гэсэн мэдлэгтэй ТААРУУЛАХ. Тиймээс хоёр талыг нь
-- нэг мөрөнд нийлүүлж хадгалаад trigram-аар хайна.
--
-- Урт хослолыг ЭХЛЭЭД солино (ch нь c+h болж задрахаас сэргийлнэ).
-- ---------------------------------------------------------------------------
create or replace function public.mn_latin_to_cyrillic(src text)
returns text
language sql
immutable
as $$
  select translate(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(
                regexp_replace(lower(coalesce(src, '')), 'sh', 'ш', 'g'),
              'ch', 'ч', 'g'),
            'ts', 'ц', 'g'),
          'ya', 'я', 'g'),
        'yo', 'ё', 'g'),
      'yu', 'ю', 'g'),
    'kh', 'х', 'g'),
    'abvgdejzijklmnoprstufhcwy',
    'абвгдежзийклмнопрстуфхцщы'
  );
$$;

-- Хайлтын талбарыг автоматаар бөглөнө.
create or replace function public.ai_knowledge_sync()
returns trigger
language plpgsql
as $$
begin
  new.search_text :=
    lower(new.question) || ' ' ||
    lower(new.answer) || ' ' ||
    public.mn_latin_to_cyrillic(new.question) || ' ' ||
    array_to_string(new.tags, ' ');
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists ai_knowledge_sync_trg on public.ai_knowledge;
create trigger ai_knowledge_sync_trg
  before insert or update on public.ai_knowledge
  for each row execute function public.ai_knowledge_sync();

-- ---------------------------------------------------------------------------
-- Хайлт — Edge Function үүнийг дуудна
--
-- Асуултыг кирилл ба галиг хоёр хэлбэрээр нь зэрэг хайж, хамгийн ойрын
-- батлагдсан мэдлэгүүдийг буцаана.
-- ---------------------------------------------------------------------------
create or replace function public.ai_search_knowledge(q text, max_rows integer default 4)
returns table (question text, answer text, score real)
language sql
stable
security definer
set search_path = public
as $$
  with needle as (
    select lower(coalesce(q, '')) as cyr,
           public.mn_latin_to_cyrillic(q) as lat
  )
  select k.question,
         k.answer,
         greatest(
           similarity(k.search_text, n.cyr),
           similarity(k.search_text, n.lat)
         ) as score
  from public.ai_knowledge k, needle n
  where k.approved
    and (k.search_text % n.cyr or k.search_text % n.lat)
  order by score desc
  limit greatest(1, least(max_rows, 10));
$$;

-- ---------------------------------------------------------------------------
-- Эрх
--
-- Зочин (anon) нь ЭДГЭЭР хүснэгтэд ШУУД хандахгүй — бүх бичилт Edge
-- Function дотор service-role түлхүүрээр явна. Админ л уншиж, мэдлэгээ засна.
-- ---------------------------------------------------------------------------
alter table public.ai_conversations enable row level security;
alter table public.ai_messages      enable row level security;
alter table public.ai_knowledge     enable row level security;

drop policy if exists ai_conversations_admin on public.ai_conversations;
create policy ai_conversations_admin on public.ai_conversations
  for all to authenticated
  using (public.is_admin_user() or user_id = auth.uid())
  with check (public.is_admin_user() or user_id = auth.uid());

drop policy if exists ai_messages_admin on public.ai_messages;
create policy ai_messages_admin on public.ai_messages
  for all to authenticated
  using (
    public.is_admin_user()
    or exists (
      select 1 from public.ai_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  )
  with check (public.is_admin_user());

drop policy if exists ai_knowledge_admin on public.ai_knowledge;
create policy ai_knowledge_admin on public.ai_knowledge
  for all to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

grant select, insert, update, delete on public.ai_conversations to authenticated;
grant select, insert, update, delete on public.ai_messages      to authenticated;
grant select, insert, update, delete on public.ai_knowledge     to authenticated;
grant usage, select on sequence public.ai_messages_id_seq to authenticated;

revoke all on function public.ai_search_knowledge(text, integer) from public, anon;
grant execute on function public.ai_search_knowledge(text, integer) to authenticated, service_role;
