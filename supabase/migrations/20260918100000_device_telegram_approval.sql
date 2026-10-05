-- Track each Telegram alert once and require server-side approval of new devices.
alter table public.device_approvals
  add column if not exists telegram_notified_at timestamptz;

drop policy if exists "device_approvals_insert" on public.device_approvals;
create policy "device_approvals_insert" on public.device_approvals
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and decided_at is null
    and decided_by is null
    and telegram_notified_at is null
  );

-- The Telegram webhook uses the service-role key after verifying both the
-- Telegram secret header and the approver's Telegram identity. The trigger
-- must allow that trusted server-side update while retaining the app rule.
create or replace function public.protect_device_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role text;
begin
  if new.status is distinct from old.status then
    if current_setting('request.jwt.claim.role', true) = 'service_role' then
      return new;
    end if;
    select p.role into actor_role from public.profiles p where p.id = auth.uid();
    if coalesce(actor_role, '') <> 'superadmin' then
      raise exception 'device_status_denied';
    end if;
  end if;
  return new;
end;
$$;

notify pgrst, 'reload schema';
