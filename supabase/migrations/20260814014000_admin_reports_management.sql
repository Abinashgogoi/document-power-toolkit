create or replace function public.admin_set_feedback_status(target_id uuid,new_status text)
returns public.feedback language plpgsql security definer set search_path=''
as $function$
declare actor_id uuid := (select auth.uid()); actor_profile public.profiles; result_feedback public.feedback;
begin
  if actor_id is null then raise exception 'authentication required'; end if;
  select * into actor_profile from public.profiles where id=actor_id;
  if actor_profile.id is null or actor_profile.status <> 'approved' or actor_profile.role not in ('admin','super_admin') then raise exception 'admin authorization required'; end if;
  if new_status not in ('new','confirmed','in_progress','fixed','testing','released','verified','closed','duplicate','wont_fix') then raise exception 'invalid feedback status'; end if;
  update public.feedback set status=new_status where id=target_id returning * into result_feedback;
  if result_feedback.id is null then raise exception 'feedback report not found'; end if;
  return result_feedback;
end;$function$;
revoke all on function public.admin_set_feedback_status(uuid,text) from public;
grant execute on function public.admin_set_feedback_status(uuid,text) to authenticated;

create or replace function public.admin_set_diagnostic_resolution(target_id uuid,is_resolved boolean)
returns public.diagnostics language plpgsql security definer set search_path=''
as $function$
declare actor_id uuid := (select auth.uid()); actor_profile public.profiles; result_diagnostic public.diagnostics;
begin
  if actor_id is null then raise exception 'authentication required'; end if;
  select * into actor_profile from public.profiles where id=actor_id;
  if actor_profile.id is null or actor_profile.status <> 'approved' or actor_profile.role not in ('admin','super_admin') then raise exception 'admin authorization required'; end if;
  update public.diagnostics set resolved_at=case when is_resolved then now() else null end where id=target_id returning * into result_diagnostic;
  if result_diagnostic.id is null then raise exception 'diagnostic report not found'; end if;
  insert into public.admin_audit_log(actor_id,action,target_type,target_id,safe_details) values(actor_id,case when is_resolved then 'resolve_diagnostic' else 'reopen_diagnostic' end,'diagnostic',target_id::text,jsonb_build_object('resolved',is_resolved));
  return result_diagnostic;
end;$function$;
revoke all on function public.admin_set_diagnostic_resolution(uuid,boolean) from public;
grant execute on function public.admin_set_diagnostic_resolution(uuid,boolean) to authenticated;
