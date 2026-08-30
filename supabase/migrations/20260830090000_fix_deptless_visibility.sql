-- Хэлтэс тохируулаагүй ажилтан админд харагдахгүй байсныг зассан.
--
-- coalesce(p.department_id, a.department_id) = actor_dept нь ажилтны
-- хэлтэс null үед (null = uuid) -> NULL -> false болж, мөрийг чимээгүй
-- хасдаг байв. 6 ажилтны 5 нь хэлтэсгүй байсан тул хэлтэстэй
-- админуудад бараг хэн ч харагдахгүй болов (superadmin шүүлтээс
-- чөлөөтэй тул удаан үл ажиглагдав).
--
-- Функцийн 22 баганатай signature-ыг ХӨНДӨӨГҮЙ: DB-ээс уншиж зөвхөн
-- шүүлтийн мөрийг нэмэв.

CREATE OR REPLACE FUNCTION public.admin_list_authorized_users()
 RETURNS TABLE(record_id text, user_id uuid, email text, name text, last_name text, "position" text, phone text, address text, role text, registered boolean, created_at timestamp with time zone, avatar_url text, latitude double precision, longitude double precision, last_seen timestamp with time zone, department_id uuid, department_name text, department_kind text, permissions jsonb, pin_set_at timestamp with time zone, pin_reset_required boolean, active boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor_role text;
  actor_rank int;
  actor_dept uuid;
begin
  select p.role, p.department_id
    into actor_role, actor_dept
  from public.profiles p where p.id = auth.uid();

  actor_rank := public.role_rank(actor_role);
  if actor_rank < 1 then
    raise exception 'forbidden';
  end if;

  return query
  select
    coalesce(a.linked_user_id::text, 'pending:' || a.email),
    a.linked_user_id,
    a.email,
    coalesce(p.name, a.name),
    coalesce(p.last_name, a.last_name),
    coalesce(p.position, a.position),
    coalesce(p.phone, a.phone),
    coalesce(p.address, a.address),
    a.role,
    a.linked_user_id is not null,
    a.created_at,
    p.avatar_url,
    p.latitude,
    p.longitude,
    p.last_seen,
    coalesce(p.department_id, a.department_id),
    d.name,
    d.kind,
    coalesce(p.permissions, '{}'::jsonb),
    p.pin_set_at,
    coalesce(p.pin_reset_required, false),
    coalesce(a.active, false)
  from public.authorized_users a
  left join public.profiles p    on p.id = a.linked_user_id
  left join public.departments d on d.id = coalesce(p.department_id, a.department_id)
  where (actor_role = 'superadmin' or public.role_rank(a.role) < actor_rank)
    and (
      actor_role = 'superadmin'
      or actor_dept is null
      -- Хэлтэс ТОХИРУУЛААГҮЙ хүн БҮХ админд харагдана. Нуувал
      -- системд бүртгэлтэй мөртлөө хэн ч удирдах боломжгүй болно.
      or coalesce(p.department_id, a.department_id) is null
      or coalesce(p.department_id, a.department_id) = actor_dept
    )
  order by a.created_at;
end;
$function$
;

notify pgrst, 'reload schema';
