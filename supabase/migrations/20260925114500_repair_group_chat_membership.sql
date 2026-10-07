-- Групп үүсгэх үед pending ажилтан сонговол conversation_members-ийн
-- багц insert бүхэлдээ унаж, conversation дангаараа үлддэг байсан.
-- Үүсгэгчийг буцаан гишүүн болгож одоо байгаа эвдэрсэн группүүдийг сэргээнэ.
insert into public.conversation_members (conversation_id, user_id, user_name)
select
  c.id,
  c.created_by,
  coalesce(nullif(trim(p.name), ''), p.email, 'Групп үүсгэгч')
from public.conversations c
left join public.profiles p on p.id = c.created_by
where c.is_group is true
  and c.created_by is not null
on conflict (conversation_id, user_id) do nothing;

-- Гишүүнчлэлийн хуучин өгөгдөл дутуу байсан ч группийн үүсгэгч өөрийн
-- группдээ мессеж илгээх эрхтэй байна. Шинэ группүүд клиент талд мөн
-- гишүүнчлэл амжилттай хадгалагдсан эсэхийг заавал шалгана.
drop policy if exists "messages_insert" on public.messages;
create policy "messages_insert" on public.messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()::text
    and (
      room = 'general'
      or public.is_conversation_member(room)
      or exists (
        select 1
        from public.conversations c
        where c.id::text = room
          and c.created_by = auth.uid()
      )
    )
  );

notify pgrst, 'reload schema';
