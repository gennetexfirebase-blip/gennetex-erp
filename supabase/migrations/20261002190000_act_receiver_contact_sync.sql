-- Хүлээлцэх хүмүүсийн лавлахад (Нексмайнд, Юнивишн, Женнетекс) superadmin
-- нэр / албан тушаал / байгууллагыг өөрчлөхөд баталгаажаагүй (draft, ready)
-- актууд дагаад шинэчлэгдэнэ. Баталгаажсан / хүлээлгэн өгсөн акт түүхэн
-- хэвээрээ үлдэнэ.

create or replace function public.sync_act_receivers_from_contact()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.name is distinct from old.name
     or new.position is distinct from old.position
     or new.organization is distinct from old.organization then
    update public.act_receivers r
       set name = new.name,
           position = new.position,
           organization = btrim(new.organization)
      from public.acts a
     where r.contact_id = new.id
       and a.id = r.act_id
       and a.deleted_at is null
       and a.status in ('draft', 'ready');
  end if;
  return new;
end;
$$;

revoke all on function public.sync_act_receivers_from_contact() from public, anon, authenticated;

drop trigger if exists act_receiver_contacts_sync on public.act_receiver_contacts;
create trigger act_receiver_contacts_sync
  after update of name, position, organization on public.act_receiver_contacts
  for each row execute function public.sync_act_receivers_from_contact();

-- Нексмайнд ХХК-ийн нэрийн төгсгөлд үлдсэн мөр шилжилтийг цэвэрлэнэ.
update public.act_receiver_contacts
   set organization = btrim(organization, E' \r\n\t'), updated_at = now()
 where organization ~ E'[\\r\\n]';
