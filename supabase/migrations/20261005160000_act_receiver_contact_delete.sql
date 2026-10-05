-- Хүлээлцэх хүмүүсийн лавлах:
-- 1. "Идэвхтэй"-г унтраахад баталгаажаагүй (draft, ready) актуудаас тухайн хүн
--    нуугдаж, дахин асаахад буцаж гарна. Баталгаажсан акт хэвээр үлдэнэ.
-- 2. Лавлахаас хүн устгах — зөвхөн superadmin. Баталгаажаагүй актуудаас нуугдана;
--    act_receivers.contact_id нь "on delete set null" тул баталгаажсан актууд
--    тухайн хүний нэр, албан тушаал, гарын үсгийг хэвээр хадгална.

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
  if new.is_active is distinct from old.is_active then
    update public.act_receivers r
       set is_enabled = new.is_active
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
  after update of name, position, organization, is_active on public.act_receiver_contacts
  for each row execute function public.sync_act_receivers_from_contact();

-- Өмнө нь идэвхгүй болгосон хүмүүсийг баталгаажаагүй актуудаас нуух.
update public.act_receivers r
   set is_enabled = false
  from public.act_receiver_contacts c, public.acts a
 where r.contact_id = c.id
   and not c.is_active
   and a.id = r.act_id
   and a.deleted_at is null
   and a.status in ('draft', 'ready');

create or replace function public.delete_act_receiver_contact(p_contact_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not public.is_superadmin() then raise exception 'permission_denied'; end if;
  update public.act_receivers r
     set is_enabled = false
    from public.acts a
   where r.contact_id = p_contact_id
     and a.id = r.act_id
     and a.deleted_at is null
     and a.status in ('draft', 'ready');
  delete from public.act_receiver_contacts where id = p_contact_id;
end;
$$;

revoke all on function public.delete_act_receiver_contact(uuid) from public;
grant execute on function public.delete_act_receiver_contact(uuid) to authenticated;
