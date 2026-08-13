create or replace function public.report_diagnostic(
  p_fingerprint text,
  p_device_id uuid,
  p_app_version text,
  p_module text,
  p_error_code text,
  p_safe_message text,
  p_safe_context jsonb default '{}'::jsonb
)
returns public.diagnostics
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := (select auth.uid());
  actor_profile public.profiles;
  existing_id uuid;
  result_row public.diagnostics;
  clean_fingerprint text := trim(p_fingerprint);
  clean_app_version text := left(trim(p_app_version), 64);
  clean_module text := left(trim(p_module), 100);
  clean_error_code text := left(trim(p_error_code), 120);
  clean_message text := left(trim(p_safe_message), 1000);
  clean_context jsonb := coalesce(p_safe_context, '{}'::jsonb);
begin
  if actor_id is null then raise exception 'authentication required'; end if;
  select * into actor_profile from public.profiles where id = actor_id;
  if actor_profile.id is null or actor_profile.status <> 'approved' then raise exception 'approved account required'; end if;
  if char_length(clean_fingerprint) < 8 or char_length(clean_fingerprint) > 200 then raise exception 'invalid diagnostic fingerprint'; end if;
  if clean_app_version = '' or clean_module = '' or clean_error_code = '' or clean_message = '' then raise exception 'diagnostic fields cannot be empty'; end if;
  if jsonb_typeof(clean_context) <> 'object' then raise exception 'safe context must be a JSON object'; end if;
  if pg_column_size(clean_context) > 16384 then raise exception 'safe context too large'; end if;
  if p_device_id is not null and not exists (select 1 from public.devices where id = p_device_id and account_id = actor_id) then
    raise exception 'device does not belong to authenticated account';
  end if;
  select d.id into existing_id
  from public.diagnostics d
  where d.fingerprint = clean_fingerprint
    and d.account_id = actor_id
    and d.device_id is not distinct from p_device_id
    and d.app_version = clean_app_version
  order by d.last_seen_at desc limit 1;
  if existing_id is not null then
    update public.diagnostics
    set module = clean_module,
        error_code = clean_error_code,
        safe_message = clean_message,
        safe_context = clean_context,
        occurrence_count = occurrence_count + 1,
        last_seen_at = now(),
        resolved_at = null
    where id = existing_id
    returning * into result_row;
  else
    insert into public.diagnostics(fingerprint, account_id, device_id, app_version, module, error_code, safe_message, safe_context)
    values (clean_fingerprint, actor_id, p_device_id, clean_app_version, clean_module, clean_error_code, clean_message, clean_context)
    returning * into result_row;
  end if;
  return result_row;
end;
$function$;
revoke all on function public.report_diagnostic(text, uuid, text, text, text, text, jsonb) from public;
grant execute on function public.report_diagnostic(text, uuid, text, text, text, text, jsonb) to authenticated;
revoke insert on table public.diagnostics from authenticated;
do $$ begin alter publication supabase_realtime add table public.diagnostics; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.feedback; exception when duplicate_object then null; end $$;
