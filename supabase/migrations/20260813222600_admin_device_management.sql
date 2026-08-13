create or replace function public.admin_set_device_trust(
  target_id uuid,
  new_trust public.device_trust
)
returns public.devices
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := (select auth.uid());
  actor_profile public.profiles;
  target_device public.devices;
  target_profile public.profiles;
  result_device public.devices;
begin
  if actor_id is null then raise exception 'authentication required'; end if;
  select * into actor_profile from public.profiles where id = actor_id;
  if actor_profile.id is null or actor_profile.status <> 'approved' or actor_profile.role not in ('admin','super_admin') then raise exception 'admin authorization required'; end if;
  select * into target_device from public.devices where id = target_id;
  if target_device.id is null then raise exception 'target device not found'; end if;
  select * into target_profile from public.profiles where id = target_device.account_id;
  if target_profile.id is null then raise exception 'target account not found'; end if;
  if actor_profile.role <> 'super_admin' and target_profile.role in ('admin','super_admin') then raise exception 'super admin authorization required for administrator devices'; end if;
  if target_profile.status <> 'approved' and new_trust = 'trusted' then raise exception 'only devices belonging to approved accounts can be trusted'; end if;
  update public.devices set trust = new_trust, revoked_at = case when new_trust = 'revoked' then now() else null end where id = target_id returning * into result_device;
  return result_device;
end;
$function$;
revoke all on function public.admin_set_device_trust(uuid, public.device_trust) from public;
grant execute on function public.admin_set_device_trust(uuid, public.device_trust) to authenticated;
