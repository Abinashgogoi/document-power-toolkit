-- Document Power Toolkit backend foundation.
-- Apply only to the dedicated Document Power Toolkit Supabase project.
create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public;

do $$ begin
  create type public.account_status as enum ('pending', 'approved', 'rejected', 'disabled');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.account_role as enum ('user', 'admin', 'super_admin');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.device_trust as enum ('pending', 'trusted', 'revoked');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  status public.account_status not null default 'pending',
  role public.account_role not null default 'user',
  approved_at timestamptz,
  approved_by uuid references auth.users(id),
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.profiles(id) on delete cascade,
  public_device_id uuid not null unique default gen_random_uuid(),
  display_name text not null,
  platform text not null,
  os_version text,
  app_version text not null,
  trust public.device_trust not null default 'pending',
  last_active_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table if not exists public.operation_history (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.profiles(id) on delete cascade,
  device_id uuid references public.devices(id) on delete set null,
  tool text not null,
  input_bytes bigint check (input_bytes >= 0),
  output_bytes bigint check (output_bytes >= 0),
  duration_ms integer check (duration_ms >= 0),
  verification_passed boolean not null,
  safe_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.diagnostics (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null,
  account_id uuid not null references public.profiles(id) on delete cascade,
  device_id uuid references public.devices(id) on delete set null,
  app_version text not null,
  module text not null,
  error_code text not null,
  safe_message text not null,
  safe_context jsonb not null default '{}'::jsonb,
  occurrence_count integer not null default 1 check (occurrence_count > 0),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (fingerprint, account_id, device_id, app_version)
);

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.profiles(id) on delete cascade,
  device_id uuid references public.devices(id) on delete set null,
  category text not null check (category in ('bug','improvement','wrong_output','feature_request','ui','performance','compatibility','ocr','compression','signature','conversion')),
  subject text not null check (char_length(subject) between 3 and 160),
  body text not null check (char_length(body) between 3 and 5000),
  safe_context jsonb not null default '{}'::jsonb,
  status text not null default 'new' check (status in ('new','confirmed','in_progress','fixed','testing','released','verified','closed','duplicate','wont_fix')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.feature_flags (
  key text primary key,
  enabled boolean not null default false,
  stable_only boolean not null default false,
  description text not null,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid not null references auth.users(id),
  action text not null,
  target_type text not null,
  target_id text not null,
  safe_details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and status = 'approved'
      and role in ('admin', 'super_admin')
  );
$$;

create or replace function private.is_approved_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and status = 'approved'
  );
$$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.protect_profile_admin_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not (select private.is_admin()) then
    if new.id is distinct from old.id
       or new.status is distinct from old.status
       or new.role is distinct from old.role
       or new.approved_at is distinct from old.approved_at
       or new.approved_by is distinct from old.approved_by
       or new.rejection_reason is distinct from old.rejection_reason
       or new.created_at is distinct from old.created_at then
      raise exception 'admin authorization required for protected profile fields';
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.protect_device_admin_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not (select private.is_admin()) then
    if new.id is distinct from old.id
       or new.account_id is distinct from old.account_id
       or new.public_device_id is distinct from old.public_device_id
       or new.platform is distinct from old.platform
       or new.trust is distinct from old.trust
       or new.created_at is distinct from old.created_at
       or new.revoked_at is distinct from old.revoked_at then
      raise exception 'admin authorization required for protected device fields';
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.audit_profile_admin_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare actor uuid := (select auth.uid());
begin
  if actor is not null and (select private.is_admin()) and (
       new.status is distinct from old.status
       or new.role is distinct from old.role
       or new.rejection_reason is distinct from old.rejection_reason
     ) then
    insert into public.admin_audit_log(actor_id, action, target_type, target_id, safe_details)
    values (actor, 'update_account_control', 'profile', new.id::text,
      jsonb_build_object('status', new.status::text, 'role', new.role::text));
  end if;
  return new;
end;
$$;

create or replace function private.audit_device_admin_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare actor uuid := (select auth.uid());
begin
  if actor is not null and (select private.is_admin()) and new.trust is distinct from old.trust then
    insert into public.admin_audit_log(actor_id, action, target_type, target_id, safe_details)
    values (actor, 'update_device_trust', 'device', new.id::text,
      jsonb_build_object('trust', new.trust::text));
  end if;
  return new;
end;
$$;

create or replace function private.audit_feedback_admin_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare actor uuid := (select auth.uid());
begin
  if actor is not null and (select private.is_admin()) and new.status is distinct from old.status then
    insert into public.admin_audit_log(actor_id, action, target_type, target_id, safe_details)
    values (actor, 'update_feedback_status', 'feedback', new.id::text,
      jsonb_build_object('status', new.status));
  end if;
  return new;
end;
$$;

create or replace function private.audit_feature_flag_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  target_key text := coalesce(new.key, old.key);
begin
  if actor is not null and (select private.is_admin()) then
    insert into public.admin_audit_log(actor_id, action, target_type, target_id, safe_details)
    values (actor, lower(tg_op) || '_feature_flag', 'feature_flag', target_key,
      case when tg_op = 'DELETE' then '{}'::jsonb else jsonb_build_object('enabled', new.enabled, 'stable_only', new.stable_only) end);
  end if;
  return coalesce(new, old);
end;
$$;

revoke all on function private.is_admin() from public;
revoke all on function private.is_approved_user() from public;
revoke all on function private.handle_new_user() from public;
revoke all on function private.touch_updated_at() from public;
revoke all on function private.protect_profile_admin_fields() from public;
revoke all on function private.protect_device_admin_fields() from public;
revoke all on function private.audit_profile_admin_change() from public;
revoke all on function private.audit_device_admin_change() from public;
revoke all on function private.audit_feedback_admin_change() from public;
revoke all on function private.audit_feature_flag_change() from public;

grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.is_approved_user() to authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function private.handle_new_user();

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at before update on public.profiles
for each row execute function private.touch_updated_at();

drop trigger if exists protect_profile_admin_fields on public.profiles;
create trigger protect_profile_admin_fields before update on public.profiles
for each row execute function private.protect_profile_admin_fields();

drop trigger if exists audit_profile_admin_change on public.profiles;
create trigger audit_profile_admin_change after update on public.profiles
for each row execute function private.audit_profile_admin_change();

drop trigger if exists protect_device_admin_fields on public.devices;
create trigger protect_device_admin_fields before update on public.devices
for each row execute function private.protect_device_admin_fields();

drop trigger if exists audit_device_admin_change on public.devices;
create trigger audit_device_admin_change after update on public.devices
for each row execute function private.audit_device_admin_change();

drop trigger if exists feedback_touch_updated_at on public.feedback;
create trigger feedback_touch_updated_at before update on public.feedback
for each row execute function private.touch_updated_at();

drop trigger if exists audit_feedback_admin_change on public.feedback;
create trigger audit_feedback_admin_change after update on public.feedback
for each row execute function private.audit_feedback_admin_change();

drop trigger if exists audit_feature_flag_change on public.feature_flags;
create trigger audit_feature_flag_change after insert or update or delete on public.feature_flags
for each row execute function private.audit_feature_flag_change();

alter table public.profiles enable row level security;
alter table public.devices enable row level security;
alter table public.operation_history enable row level security;
alter table public.diagnostics enable row level security;
alter table public.feedback enable row level security;
alter table public.feature_flags enable row level security;
alter table public.admin_audit_log enable row level security;

create policy profile_read_own_or_admin on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select private.is_admin()));
create policy profile_update_own_display on public.profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy profile_admin_update on public.profiles for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));

create policy devices_read_own_or_admin on public.devices for select to authenticated
using (account_id = (select auth.uid()) or (select private.is_admin()));
create policy devices_insert_own on public.devices for insert to authenticated
with check (account_id = (select auth.uid()) and (select private.is_approved_user()));
create policy devices_update_own_safe_fields on public.devices for update to authenticated
using (account_id = (select auth.uid()) and (select private.is_approved_user()))
with check (account_id = (select auth.uid()) and (select private.is_approved_user()));
create policy devices_admin_update on public.devices for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));

create policy history_read_own_or_admin on public.operation_history for select to authenticated
using (account_id = (select auth.uid()) or (select private.is_admin()));
create policy history_insert_own on public.operation_history for insert to authenticated
with check (account_id = (select auth.uid()) and (select private.is_approved_user()));
create policy history_delete_own on public.operation_history for delete to authenticated
using (account_id = (select auth.uid()) and (select private.is_approved_user()));

create policy diagnostics_read_own_or_admin on public.diagnostics for select to authenticated
using (account_id = (select auth.uid()) or (select private.is_admin()));
create policy diagnostics_insert_own on public.diagnostics for insert to authenticated
with check (account_id = (select auth.uid()) and (select private.is_approved_user()));
create policy diagnostics_admin_update on public.diagnostics for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));

create policy feedback_read_own_or_admin on public.feedback for select to authenticated
using (account_id = (select auth.uid()) or (select private.is_admin()));
create policy feedback_insert_own on public.feedback for insert to authenticated
with check (account_id = (select auth.uid()) and (select private.is_approved_user()));
create policy feedback_admin_update on public.feedback for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));

create policy feature_flags_read_approved on public.feature_flags for select to authenticated
using ((select private.is_approved_user()));
create policy feature_flags_admin_write on public.feature_flags for all to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));

create policy audit_admin_read on public.admin_audit_log for select to authenticated
using ((select private.is_admin()));

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.devices from anon, authenticated;
revoke all on table public.operation_history from anon, authenticated;
revoke all on table public.diagnostics from anon, authenticated;
revoke all on table public.feedback from anon, authenticated;
revoke all on table public.feature_flags from anon, authenticated;
revoke all on table public.admin_audit_log from anon, authenticated;

grant select, update on table public.profiles to authenticated;
grant select, insert, update on table public.devices to authenticated;
grant select, insert, delete on table public.operation_history to authenticated;
grant select, insert, update on table public.diagnostics to authenticated;
grant select, insert, update on table public.feedback to authenticated;
grant select, insert, update, delete on table public.feature_flags to authenticated;
grant select on table public.admin_audit_log to authenticated;

create index if not exists devices_account_idx on public.devices (account_id, last_active_at desc);
create index if not exists history_account_created_idx on public.operation_history (account_id, created_at desc);
create index if not exists diagnostics_fingerprint_idx on public.diagnostics (fingerprint, last_seen_at desc);
create index if not exists feedback_status_created_idx on public.feedback (status, created_at desc);

alter default privileges for role postgres in schema public revoke select, insert, update, delete on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated;
alter default privileges for role postgres in schema public revoke usage, select on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public;

-- Realtime is limited to control-plane tables that benefit from immediate updates.
do $$ begin
  alter publication supabase_realtime add table public.profiles;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.devices;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.feature_flags;
exception when duplicate_object then null; end $$;
