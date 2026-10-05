-- Женнетексийн Захирлын тамга — зөвхөн Захирал (bayasgalan.gennetex@gmail.com)
-- өөрөө актыг баталгаажуулахад Захирлын гарын үсгийн хэсэгт автоматаар орно.
-- Бусад хүн баталгаажуулбал нэр нь л гарна, тамгагүй.

create or replace function public.apply_act_director_stamp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'approved'
     and old.status is distinct from 'approved'
     and exists (
       select 1 from public.profiles p
       where p.id = new.approved_by
         and lower(btrim(p.email)) = 'bayasgalan.gennetex@gmail.com'
     ) then
    update public.act_receivers r
       set stamp_url = c.stamp_url
      from public.act_receiver_contacts c
     where r.act_id = new.id
       and r.contact_id = c.id
       and c.preset_group = 'gennetex_handover'
       and c.position ilike '%захирал%'
       and nullif(btrim(c.stamp_url), '') is not null;
  end if;
  return new;
end;
$$;

revoke all on function public.apply_act_director_stamp() from public, anon, authenticated;

drop trigger if exists acts_director_stamp_on_approve on public.acts;
create trigger acts_director_stamp_on_approve
  after update of status on public.acts
  for each row execute function public.apply_act_director_stamp();
