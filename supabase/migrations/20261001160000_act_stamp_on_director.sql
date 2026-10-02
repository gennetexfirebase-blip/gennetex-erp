-- The company stamp belongs to the director's signature row, not to the whole
-- handover group or the engineering rows.

insert into public.act_receiver_contacts (
  audience_type, organization, name, position, preset_group,
  receiver_type, sort_order, stamp_url
)
select
  'organization', 'Женнетекс ХХК', 'Б.Баясгалан', 'Захирал',
  'gennetex_handover', 'contractor', 10,
  'https://zkftykocmqzrgdhgwluu.supabase.co/storage/v1/object/public/act-brand-assets/gennetex-company-stamp.jpg'
where not exists (
  select 1 from public.act_receiver_contacts
  where lower(coalesce(organization, '')) = lower('Женнетекс ХХК')
    and lower(name) = lower('Б.Баясгалан')
);

update public.act_receiver_contacts
set stamp_url = null,
    sort_order = case
      when lower(name) = lower('Мөнхбат') then 20
      when lower(name) = lower('Баярхүү') then 30
      else sort_order
    end,
    updated_at = now()
where preset_group = 'gennetex_handover';

update public.act_receiver_contacts
set audience_type = 'organization',
    organization = 'Женнетекс ХХК',
    position = 'Захирал',
    preset_group = 'gennetex_handover',
    receiver_type = 'contractor',
    sort_order = 10,
    is_active = true,
    stamp_url = 'https://zkftykocmqzrgdhgwluu.supabase.co/storage/v1/object/public/act-brand-assets/gennetex-company-stamp.jpg',
    updated_at = now()
where lower(coalesce(organization, '')) = lower('Женнетекс ХХК')
  and lower(name) = lower('Б.Баясгалан');

-- Correct editable snapshots created before this rule. Approved/delivered acts
-- remain immutable.
update public.act_receivers r
set stamp_url = null
from public.acts a
where a.id = r.act_id
  and a.status in ('draft', 'ready')
  and r.type = 'contractor'
  and lower(coalesce(r.organization, '')) = lower('Женнетекс ХХК')
  and lower(coalesce(r.name, '')) <> lower('Б.Баясгалан');

update public.act_receivers r
set contact_id = c.id,
    organization = c.organization,
    position = c.position,
    audience_type = c.audience_type,
    is_enabled = true,
    stamp_url = c.stamp_url
from public.acts a, public.act_receiver_contacts c
where a.id = r.act_id
  and a.status in ('draft', 'ready')
  and c.preset_group = 'gennetex_handover'
  and lower(c.name) = lower('Б.Баясгалан')
  and r.type = 'contractor'
  and lower(coalesce(r.organization, '')) = lower('Женнетекс ХХК')
  and lower(coalesce(r.name, '')) = lower('Б.Баясгалан');

with targets as (
  select a.id as act_id, min(r.sort_order) as first_order
  from public.acts a
  join public.act_receivers r on r.act_id = a.id
  where a.status in ('draft', 'ready')
    and r.type = 'contractor'
    and lower(coalesce(r.organization, '')) = lower('Женнетекс ХХК')
    and not exists (
      select 1 from public.act_receivers d
      where d.act_id = a.id
        and d.type = 'contractor'
        and lower(coalesce(d.organization, '')) = lower('Женнетекс ХХК')
        and lower(coalesce(d.name, '')) = lower('Б.Баясгалан')
    )
  group by a.id
), shifted as (
  update public.act_receivers r
  set sort_order = r.sort_order + 1
  from targets t
  where r.act_id = t.act_id and r.sort_order >= t.first_order
  returning r.act_id
)
insert into public.act_receivers (
  act_id, type, organization, name, position, signature_mode, sort_order,
  contact_id, audience_type, is_enabled, stamp_url
)
select
  t.act_id, 'contractor', c.organization, c.name, c.position, 'none', t.first_order,
  c.id, c.audience_type, true, c.stamp_url
from targets t
cross join public.act_receiver_contacts c
where c.preset_group = 'gennetex_handover'
  and lower(c.name) = lower('Б.Баясгалан');

notify pgrst, 'reload schema';
