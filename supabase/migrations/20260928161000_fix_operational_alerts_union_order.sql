-- PostgreSQL only allows result-column names/ordinals directly after a UNION.
-- Wrap the feed so the final ordering can safely reference qualified columns.

create or replace function public.get_operational_alerts()
returns table (
  alert_type text,
  severity text,
  title text,
  detail text,
  due_date date,
  entity_id text,
  days_remaining integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  cfg public.company_settings%rowtype;
  today date := (now() at time zone 'Asia/Ulaanbaatar')::date;
  max_days integer;
begin
  if not public.is_admin_user() then
    raise exception 'permission_denied';
  end if;

  select * into cfg
  from public.company_settings
  where singleton = true;

  max_days := coalesce((select max(d) from unnest(cfg.reminder_days) d), 30);

  return query
  select
    alerts.alert_type,
    alerts.severity,
    alerts.title,
    alerts.detail,
    alerts.due_date,
    alerts.entity_id,
    alerts.days_remaining
  from (
    select
      'low_stock'::text as alert_type,
      case when coalesce(i.quantity, 0) <= 0 then 'danger' else 'warning' end as severity,
      i.name::text as title,
      format(
        'Үлдэгдэл %s %s · доод хэмжээ %s',
        coalesce(i.quantity, 0),
        coalesce(i.unit, 'ширхэг'),
        coalesce(i.min_stock, cfg.default_min_stock)
      )::text as detail,
      null::date as due_date,
      i.id::text as entity_id,
      null::integer as days_remaining
    from public.inventory i
    where cfg.low_stock_alert_enabled
      and coalesce(i.quantity, 0) <= coalesce(i.min_stock, cfg.default_min_stock)

    union all

    select
      'training'::text,
      case when t.due_date < today then 'danger'
           when t.due_date <= today + 1 then 'danger' else 'warning' end,
      t.training_name::text,
      format(
        '%s · %s',
        t.employee_email,
        case when t.due_date < today then 'хугацаа хэтэрсэн'
             else t.due_date::text || ' хүртэл' end
      )::text,
      t.due_date,
      t.id::text,
      (t.due_date - today)::integer
    from public.employee_training_assignments t
    where cfg.training_alert_enabled
      and t.status = 'required'
      and t.due_date is not null
      and t.due_date <= today + max_days

    union all

    select
      'vehicle_inspection'::text,
      case when v.inspection_expiry < today then 'danger'
           when v.inspection_expiry <= today + 1 then 'danger' else 'warning' end,
      (v.plate_number || ' · Техникийн үзлэг')::text,
      case when v.inspection_expiry < today then 'Хугацаа хэтэрсэн'
           else v.inspection_expiry::text || ' хүртэл' end,
      v.inspection_expiry,
      v.vehicle_id::text,
      (v.inspection_expiry - today)::integer
    from public.vehicle_compliance_snapshots v
    where cfg.vehicle_alert_enabled
      and v.inspection_expiry is not null
      and v.inspection_expiry <= today + max_days

    union all

    select
      'vehicle_insurance'::text,
      case when v.insurance_expiry < today then 'danger'
           when v.insurance_expiry <= today + 1 then 'danger' else 'warning' end,
      (v.plate_number || ' · Даатгал')::text,
      case when v.insurance_expiry < today then 'Хугацаа хэтэрсэн'
           else v.insurance_expiry::text || ' хүртэл' end,
      v.insurance_expiry,
      v.vehicle_id::text,
      (v.insurance_expiry - today)::integer
    from public.vehicle_compliance_snapshots v
    where cfg.vehicle_alert_enabled
      and v.insurance_expiry is not null
      and v.insurance_expiry <= today + max_days
  ) alerts
  order by alerts.severity, alerts.days_remaining nulls first, alerts.alert_type, alerts.title;
end;
$$;

revoke all on function public.get_operational_alerts() from public, anon;
grant execute on function public.get_operational_alerts() to authenticated;

notify pgrst, 'reload schema';
