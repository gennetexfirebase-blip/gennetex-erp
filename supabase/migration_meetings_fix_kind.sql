-- Буруу default-оор live болсон хурлуудыг засна
update public.meetings
set kind = 'meeting'
where status = 'active'
  and (title ilike '%хурал%' or title ilike '%Хурал%')
  and (kind is distinct from 'meeting');

update public.meetings
set kind = 'live'
where status = 'active'
  and title ilike '%Live%'
  and title not ilike '%хурал%'
  and (kind is distinct from 'live');

notify pgrst, 'reload schema';
