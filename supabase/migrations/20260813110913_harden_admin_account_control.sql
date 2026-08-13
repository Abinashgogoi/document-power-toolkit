create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    coalesce(nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), ''), 'User'),
    new.email
  )
  on conflict (id) do update
    set email = excluded.email,
        display_name = case
          when nullif(trim(public.profiles.display_name), '') is null then excluded.display_name
          else public.profiles.display_name
        end;
  return new;
end;
$function$;

create or replace function private.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and status = 'approved'
      and role = 'super_admin'
  );
$function$;

drop policy if exists profile_admin_update on public.profiles;

create or replace function public.admin_set_account_control(
  target_id uuid,
  new_status public.account_status,
  new_role public.account_role default null,
  new_rejection_reason text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := (select auth.uid());
  actor_profile public.profiles;
  target_profile public.profiles;
  effective_role public.account_role;
  result_profile public.profiles;
  approved_super_admins integer;
begin
  if actor_id is null then
    raise exception 'authentication required';
  end if;

  select * into actor_profile from public.profiles where id = actor_id;
  if actor_profile.id is null
     or actor_profile.status <> 'approved'
     or actor_profile.role not in ('admin', 'super_admin') then
    raise exception 'admin authorization required';
  end if;

  select * into target_profile from public.profiles where id = target_id;
  if target_profile.id is null then
    raise exception 'target account not found';
  end if;

  effective_role := coalesce(new_role, target_profile.role);

  if actor_profile.role <> 'super_admin' then
    if target_profile.role = 'super_admin' or effective_role in ('admin', 'super_admin') then
      raise exception 'super admin authorization required';
    end if;
  end if;

  if target_id = actor_id then
    if new_status <> 'approved' or effective_role <> actor_profile.role then
      raise exception 'you cannot disable, reject, pend, or change the role of your own admin account';
    end if;
  end if;

  if target_profile.role = 'super_admin'
     and (new_status <> 'approved' or effective_role <> 'super_admin') then
    select count(*) into approved_super_admins
    from public.profiles
    where status = 'approved' and role = 'super_admin';

    if approved_super_admins <= 1 then
      raise exception 'at least one approved super admin must remain';
    end if;
  end if;

  update public.profiles
  set status = new_status,
      role = effective_role,
      approved_at = case when new_status = 'approved' then now() else null end,
      approved_by = case when new_status = 'approved' then actor_id else null end,
      rejection_reason = case
        when new_status = 'rejected' then nullif(trim(coalesce(new_rejection_reason, '')), '')
        else null
      end
  where id = target_id
  returning * into result_profile;

  return result_profile;
end;
$function$;

revoke all on function public.admin_set_account_control(uuid, public.account_status, public.account_role, text) from public;
grant execute on function public.admin_set_account_control(uuid, public.account_status, public.account_role, text) to authenticated;
