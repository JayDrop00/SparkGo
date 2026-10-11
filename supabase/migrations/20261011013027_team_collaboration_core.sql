/*
 * FILE:     supabase/migrations/20261011013027_team_collaboration_core.sql
 * PURPOSE:  Phase 1 team and membership schema, RLS, core RPCs, profiles and activity logging.
 * FLOWS:    Team creation and core membership management (team-collab.md sections 5, 8, 14).
 * SECURITY: S1, S2, S5, S6, S7, S9, S10, S11, S13, S17, S20, S22.
 * DEBUG:    Check role grants, RLS helper results, and matching team_activity_log rows first.
 */
-- Phase 1: team core, membership, teammate profile visibility, activity log.
-- SECURITY: public RPCs are SECURITY INVOKER wrappers around private SECURITY DEFINER
-- implementations. This preserves callable PostgREST names without public definer endpoints.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create type public.team_role as enum ('admin', 'manager', 'member');

/*
 * FILE:     supabase/migrations/20261011013027_team_collaboration_core.sql
 * PURPOSE:  Phase 1 database function private.team_limit.
 * FLOWS:    Team creation, team membership, ownership and teammate visibility (team-collab.md sections 5 and 8).
 * SECURITY: S1, S2, S5, S7, S9, S10, S11, S13, S17.
 * DEBUG:    Check auth.uid(), team membership, execute grants and the team_activity_log row for this team.
 */
create or replace function private.team_limit(p_key text)
returns integer language sql immutable set search_path = ''
as $$
  select case p_key
    when 'max_owned_teams' then 5
    when 'max_team_members' then 50
    when 'max_pending_invites' then 50
    when 'max_invites_per_hour' then 20
    when 'max_tags_per_team' then 30
    when 'max_tags_per_member' then 5
    when 'max_assignees_per_task' then 20
    else null
  end
$$;

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  owner_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.team_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);
create index team_members_user_idx on public.team_members (user_id);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) <= 80),
  avatar_url text check (avatar_url is null or char_length(avatar_url) <= 2048),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.team_activity_log (
  id bigint generated always as identity primary key,
  team_id uuid not null references public.teams(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (action in (
    'team.created', 'member.invited', 'invite.revoked', 'invite.accepted', 'invite.declined',
    'member.role_changed', 'member.removed', 'member.left', 'team.ownership_transferred',
    'task.assigned', 'completion.requested', 'completion.approved', 'completion.rejected',
    'completion.cancelled', 'task.completed_directly'
  )),
  target_type text,
  target_id uuid,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index team_activity_team_time_idx on public.team_activity_log (team_id, created_at desc);

-- SECURITY (S5): policy helpers are narrowly scoped definer functions with an empty path.
/*
 * FILE:     supabase/migrations/20261011013027_team_collaboration_core.sql
 * PURPOSE:  Phase 1 database function private.team_role_of.
 * FLOWS:    Team creation, team membership, ownership and teammate visibility (team-collab.md sections 5 and 8).
 * SECURITY: S1, S2, S5, S7, S9, S10, S11, S13, S17.
 * DEBUG:    Check auth.uid(), team membership, execute grants and the team_activity_log row for this team.
 */
create or replace function private.team_role_of(p_team_id uuid)
returns public.team_role language plpgsql stable security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then return null; end if;
  return (select tm.role from public.team_members tm
          where tm.team_id = p_team_id and tm.user_id = (select auth.uid()));
end;
$$;

/*
 * FILE:     supabase/migrations/20261011013027_team_collaboration_core.sql
 * PURPOSE:  Phase 1 database function private.is_team_member.
 * FLOWS:    Team creation, team membership, ownership and teammate visibility (team-collab.md sections 5 and 8).
 * SECURITY: S1, S2, S5, S7, S9, S10, S11, S13, S17.
 * DEBUG:    Check auth.uid(), team membership, execute grants and the team_activity_log row for this team.
 */
create or replace function private.is_team_member(p_team_id uuid)
returns boolean language plpgsql stable security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then return false; end if;
  return exists (
    select 1 from public.team_members tm
    where tm.team_id = p_team_id and tm.user_id = (select auth.uid())
  );
end;
$$;

/*
 * FILE:     supabase/migrations/20261011013027_team_collaboration_core.sql
 * PURPOSE:  Phase 1 database function private.has_team_role.
 * FLOWS:    Team creation, team membership, ownership and teammate visibility (team-collab.md sections 5 and 8).
 * SECURITY: S1, S2, S5, S7, S9, S10, S11, S13, S17.
 * DEBUG:    Check auth.uid(), team membership, execute grants and the team_activity_log row for this team.
 */
create or replace function private.has_team_role(p_team_id uuid, p_roles public.team_role[])
returns boolean language plpgsql stable security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then return false; end if;
  return exists (
    select 1 from public.team_members tm
    where tm.team_id = p_team_id and tm.user_id = (select auth.uid())
      and tm.role = any (p_roles)
  );
end;
$$;

/*
 * FILE:     supabase/migrations/20261011013027_team_collaboration_core.sql
 * PURPOSE:  Phase 1 database function private.shares_team_with.
 * FLOWS:    Team creation, team membership, ownership and teammate visibility (team-collab.md sections 5 and 8).
 * SECURITY: S1, S2, S5, S7, S9, S10, S11, S13, S17.
 * DEBUG:    Check auth.uid(), team membership, execute grants and the team_activity_log row for this team.
 */
create or replace function private.shares_team_with(p_other uuid)
returns boolean language plpgsql stable security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then return false; end if;
  return exists (
    select 1 from public.team_members mine
    join public.team_members theirs on theirs.team_id = mine.team_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = p_other
  );
end;
$$;

-- The auth trigger creates empty profiles for new accounts; backfill existing accounts too.
/*
 * FILE:     supabase/migrations/20261011013027_team_collaboration_core.sql
 * PURPOSE:  Phase 1 Auth signup trigger function private.handle_new_auth_user.
 * FLOWS:    Team creation, team membership, ownership and teammate visibility (team-collab.md sections 5 and 8).
 * SECURITY: S1, S5, S22. Auth invokes this trusted trigger without an end-user JWT;
 *            it uses only NEW.id and never reads user metadata or sets authorization.
 * DEBUG:    Check auth.uid(), team membership, execute grants and the team_activity_log row for this team.
 */
create or replace function private.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;
insert into public.profiles (id)
select u.id from auth.users u
on conflict (id) do nothing;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function private.handle_new_auth_user();

/*
 * FILE:     supabase/migrations/20261011013027_team_collaboration_core.sql
 * PURPOSE:  Phase 1 database function public.set_profile_updated_at.
 * FLOWS:    Team creation, team membership, ownership and teammate visibility (team-collab.md sections 5 and 8).
 * SECURITY: S1, S2, S5, S7, S9, S10, S11, S13, S17.
 * DEBUG:    Check auth.uid(), team membership, execute grants and the team_activity_log row for this team.
 */
create or replace function public.set_profile_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger set_profile_updated_at
before update on public.profiles
for each row execute function public.set_profile_updated_at();

-- SECURITY (S9, S13): privileged implementations derive identity from JWT claims,
-- hide foreign team ids, serialize owner-team limit checks, and log ids only.
/*
 * FILE:     supabase/migrations/20261011013027_team_collaboration_core.sql
 * PURPOSE:  Phase 1 database function private.impl_create_team.
 * FLOWS:    Team creation, team membership, ownership and teammate visibility (team-collab.md sections 5 and 8).
 * SECURITY: S1, S2, S5, S7, S9, S10, S11, S13, S17.
 * DEBUG:    Check auth.uid(), team membership, execute grants and the team_activity_log row for this team.
 */
create or replace function private.impl_create_team(p_name text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text := btrim(coalesce(p_name, ''));
  v_team_id uuid;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if char_length(v_name) not between 1 and 60 then raise exception 'INVALID_INPUT'; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('team.owner:' || v_uid::text, 0)
  );
  if (select count(*) from public.teams t where t.owner_id = v_uid)
      >= private.team_limit('max_owned_teams') then
    raise exception 'LIMIT_REACHED';
  end if;

  insert into public.teams (name, owner_id) values (v_name, v_uid)
  returning id into v_team_id;
  -- INVARIANT: a team owner is always an Admin member.
  insert into public.team_members (team_id, user_id, role)
  values (v_team_id, v_uid, 'admin');
  insert into public.team_activity_log (team_id, actor_id, action, target_type, target_id)
  values (v_team_id, v_uid, 'team.created', 'team', v_team_id);
  return v_team_id;
end;
$$;

/*
 * FILE:     supabase/migrations/20261011013027_team_collaboration_core.sql
 * PURPOSE:  Phase 1 database function private.impl_transfer_team_ownership.
 * FLOWS:    Team creation, team membership, ownership and teammate visibility (team-collab.md sections 5 and 8).
 * SECURITY: S1, S2, S5, S7, S9, S10, S11, S13, S17.
 * DEBUG:    Check auth.uid(), team membership, execute grants and the team_activity_log row for this team.
 */
create or replace function private.impl_transfer_team_ownership(p_team_id uuid, p_new_owner_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_owner_id uuid;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select t.owner_id into v_owner_id from public.teams t where t.id = p_team_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_owner_id <> v_uid then
    if private.is_team_member(p_team_id) then raise exception 'FORBIDDEN'; end if;
    raise exception 'NOT_FOUND';
  end if;
  if p_new_owner_id is null or p_new_owner_id = v_uid then raise exception 'INVALID_INPUT'; end if;

  perform 1 from public.team_members tm
  where tm.team_id = p_team_id and tm.user_id = p_new_owner_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;

  update public.team_members set role = 'admin'
  where team_id = p_team_id and user_id = p_new_owner_id;
  update public.teams set owner_id = p_new_owner_id where id = p_team_id;
  insert into public.team_activity_log (team_id, actor_id, action, target_type, target_id, meta)
  values (p_team_id, v_uid, 'team.ownership_transferred', 'member', p_new_owner_id,
          pg_catalog.jsonb_build_object('previous_owner_id', v_uid));
end;
$$;

/*
 * FILE:     supabase/migrations/20261011013027_team_collaboration_core.sql
 * PURPOSE:  Phase 1 database function private.impl_delete_team.
 * FLOWS:    Team creation, team membership, ownership and teammate visibility (team-collab.md sections 5 and 8).
 * SECURITY: S1, S2, S5, S7, S9, S10, S11, S13, S17.
 * DEBUG:    Check auth.uid(), team membership, execute grants and the team_activity_log row for this team.
 */
create or replace function private.impl_delete_team(p_team_id uuid, p_confirm_name text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_owner_id uuid;
  v_name text;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select t.owner_id, t.name into v_owner_id, v_name
  from public.teams t where t.id = p_team_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_owner_id <> v_uid then
    if private.is_team_member(p_team_id) then raise exception 'FORBIDDEN'; end if;
    raise exception 'NOT_FOUND';
  end if;
  if p_confirm_name is distinct from v_name then raise exception 'INVALID_INPUT'; end if;
  delete from public.teams where id = p_team_id;
end;
$$;

/*
 * FILE:     supabase/migrations/20261011013027_team_collaboration_core.sql
 * PURPOSE:  Phase 1 database function private.impl_change_member_role.
 * FLOWS:    Team creation, team membership, ownership and teammate visibility (team-collab.md sections 5 and 8).
 * SECURITY: S1, S2, S5, S7, S9, S10, S11, S13, S17.
 * DEBUG:    Check auth.uid(), team membership, execute grants and the team_activity_log row for this team.
 */
create or replace function private.impl_change_member_role(
  p_team_id uuid, p_user_id uuid, p_new_role public.team_role
)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_caller_role public.team_role;
  v_target_role public.team_role;
  v_owner_id uuid;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_new_role is null or p_user_id is null then raise exception 'INVALID_INPUT'; end if;

  -- SECURITY (S11): lock affected membership rows in stable user-id order.
  perform 1 from public.team_members tm
  where tm.team_id = p_team_id and tm.user_id in (v_uid, p_user_id)
  order by tm.user_id for update;

  select tm.role into v_caller_role from public.team_members tm
  where tm.team_id = p_team_id and tm.user_id = v_uid;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_caller_role <> 'admin' then raise exception 'FORBIDDEN'; end if;
  select tm.role into v_target_role from public.team_members tm
  where tm.team_id = p_team_id and tm.user_id = p_user_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  select t.owner_id into v_owner_id from public.teams t where t.id = p_team_id;

  if p_user_id = v_owner_id then raise exception 'OWNER_PROTECTED'; end if;
  if p_user_id = v_uid then raise exception 'FORBIDDEN'; end if;
  if (v_target_role = 'admin' or p_new_role = 'admin') and v_owner_id <> v_uid then
    raise exception 'FORBIDDEN';
  end if;

  update public.team_members set role = p_new_role
  where team_id = p_team_id and user_id = p_user_id;
  insert into public.team_activity_log (team_id, actor_id, action, target_type, target_id, meta)
  values (p_team_id, v_uid, 'member.role_changed', 'member', p_user_id,
          pg_catalog.jsonb_build_object('role', p_new_role));
end;
$$;

-- Completion tables are created in Phase 6; this extension point is replaced there.
/*
 * FILE:     supabase/migrations/20261011013027_team_collaboration_core.sql
 * PURPOSE:  Phase 1 database function private.cleanup_member_state.
 * FLOWS:    Team creation, team membership, ownership and teammate visibility (team-collab.md sections 5 and 8).
 * SECURITY: S1, S2, S5, S7, S9, S10, S11, S13, S17.
 * DEBUG:    Check auth.uid(), team membership, execute grants and the team_activity_log row for this team.
 */
create or replace function private.cleanup_member_state(p_team_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'NOT_AUTHENTICATED'; end if;
  return;
end;
$$;

/*
 * FILE:     supabase/migrations/20261011013027_team_collaboration_core.sql
 * PURPOSE:  Phase 1 database function private.impl_remove_member.
 * FLOWS:    Team creation, team membership, ownership and teammate visibility (team-collab.md sections 5 and 8).
 * SECURITY: S1, S2, S5, S7, S9, S10, S11, S13, S17.
 * DEBUG:    Check auth.uid(), team membership, execute grants and the team_activity_log row for this team.
 */
create or replace function private.impl_remove_member(p_team_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_caller_role public.team_role;
  v_target_role public.team_role;
  v_owner_id uuid;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_user_id is null then raise exception 'INVALID_INPUT'; end if;
  perform 1 from public.team_members tm
  where tm.team_id = p_team_id and tm.user_id in (v_uid, p_user_id)
  order by tm.user_id for update;

  select tm.role into v_caller_role from public.team_members tm
  where tm.team_id = p_team_id and tm.user_id = v_uid;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_caller_role <> 'admin' then raise exception 'FORBIDDEN'; end if;
  select tm.role into v_target_role from public.team_members tm
  where tm.team_id = p_team_id and tm.user_id = p_user_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  select t.owner_id into v_owner_id from public.teams t where t.id = p_team_id;

  if p_user_id = v_owner_id then raise exception 'OWNER_PROTECTED'; end if;
  if p_user_id = v_uid then raise exception 'FORBIDDEN'; end if;
  if v_target_role = 'admin' and v_owner_id <> v_uid then raise exception 'FORBIDDEN'; end if;

  perform private.cleanup_member_state(p_team_id, p_user_id);
  delete from public.team_members where team_id = p_team_id and user_id = p_user_id;
  insert into public.team_activity_log (team_id, actor_id, action, target_type, target_id)
  values (p_team_id, v_uid, 'member.removed', 'member', p_user_id);
end;
$$;

/*
 * FILE:     supabase/migrations/20261011013027_team_collaboration_core.sql
 * PURPOSE:  Phase 1 database function private.impl_leave_team.
 * FLOWS:    Team creation, team membership, ownership and teammate visibility (team-collab.md sections 5 and 8).
 * SECURITY: S1, S2, S5, S7, S9, S10, S11, S13, S17.
 * DEBUG:    Check auth.uid(), team membership, execute grants and the team_activity_log row for this team.
 */
create or replace function private.impl_leave_team(p_team_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_owner_id uuid;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  perform 1 from public.team_members tm
  where tm.team_id = p_team_id and tm.user_id = v_uid for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  select t.owner_id into v_owner_id from public.teams t where t.id = p_team_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_owner_id = v_uid then raise exception 'OWNER_PROTECTED'; end if;

  perform private.cleanup_member_state(p_team_id, v_uid);
  delete from public.team_members where team_id = p_team_id and user_id = v_uid;
  insert into public.team_activity_log (team_id, actor_id, action, target_type, target_id)
  values (p_team_id, v_uid, 'member.left', 'member', v_uid);
end;
$$;

-- Public API wrappers are invoker functions. Their private callees recheck auth.
/*
 * FILE:     supabase/migrations/20261011013027_team_collaboration_core.sql
 * PURPOSE:  Phase 1 database function public.create_team.
 * FLOWS:    Team creation, team membership, ownership and teammate visibility (team-collab.md sections 5 and 8).
 * SECURITY: S1, S2, S5, S7, S9, S10, S11, S13, S17.
 * DEBUG:    Check auth.uid(), team membership, execute grants and the team_activity_log row for this team.
 */
create or replace function public.create_team(p_name text)
returns uuid language sql security invoker set search_path = ''
as $$ select private.impl_create_team(p_name) $$;
/*
 * FILE:     supabase/migrations/20261011013027_team_collaboration_core.sql
 * PURPOSE:  Phase 1 database function public.transfer_team_ownership.
 * FLOWS:    Team creation, team membership, ownership and teammate visibility (team-collab.md sections 5 and 8).
 * SECURITY: S1, S2, S5, S7, S9, S10, S11, S13, S17.
 * DEBUG:    Check auth.uid(), team membership, execute grants and the team_activity_log row for this team.
 */
create or replace function public.transfer_team_ownership(p_team_id uuid, p_new_owner_id uuid)
returns void language sql security invoker set search_path = ''
as $$ select private.impl_transfer_team_ownership(p_team_id, p_new_owner_id) $$;
/*
 * FILE:     supabase/migrations/20261011013027_team_collaboration_core.sql
 * PURPOSE:  Phase 1 database function public.delete_team.
 * FLOWS:    Team creation, team membership, ownership and teammate visibility (team-collab.md sections 5 and 8).
 * SECURITY: S1, S2, S5, S7, S9, S10, S11, S13, S17.
 * DEBUG:    Check auth.uid(), team membership, execute grants and the team_activity_log row for this team.
 */
create or replace function public.delete_team(p_team_id uuid, p_confirm_name text)
returns void language sql security invoker set search_path = ''
as $$ select private.impl_delete_team(p_team_id, p_confirm_name) $$;
/*
 * FILE:     supabase/migrations/20261011013027_team_collaboration_core.sql
 * PURPOSE:  Phase 1 database function public.change_member_role.
 * FLOWS:    Team creation, team membership, ownership and teammate visibility (team-collab.md sections 5 and 8).
 * SECURITY: S1, S2, S5, S7, S9, S10, S11, S13, S17.
 * DEBUG:    Check auth.uid(), team membership, execute grants and the team_activity_log row for this team.
 */
create or replace function public.change_member_role(
  p_team_id uuid, p_user_id uuid, p_new_role public.team_role
)
returns void language sql security invoker set search_path = ''
as $$ select private.impl_change_member_role(p_team_id, p_user_id, p_new_role) $$;
/*
 * FILE:     supabase/migrations/20261011013027_team_collaboration_core.sql
 * PURPOSE:  Phase 1 database function public.remove_member.
 * FLOWS:    Team creation, team membership, ownership and teammate visibility (team-collab.md sections 5 and 8).
 * SECURITY: S1, S2, S5, S7, S9, S10, S11, S13, S17.
 * DEBUG:    Check auth.uid(), team membership, execute grants and the team_activity_log row for this team.
 */
create or replace function public.remove_member(p_team_id uuid, p_user_id uuid)
returns void language sql security invoker set search_path = ''
as $$ select private.impl_remove_member(p_team_id, p_user_id) $$;
/*
 * FILE:     supabase/migrations/20261011013027_team_collaboration_core.sql
 * PURPOSE:  Phase 1 database function public.leave_team.
 * FLOWS:    Team creation, team membership, ownership and teammate visibility (team-collab.md sections 5 and 8).
 * SECURITY: S1, S2, S5, S7, S9, S10, S11, S13, S17.
 * DEBUG:    Check auth.uid(), team membership, execute grants and the team_activity_log row for this team.
 */
create or replace function public.leave_team(p_team_id uuid)
returns void language sql security invoker set search_path = ''
as $$ select private.impl_leave_team(p_team_id) $$;

alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.profiles enable row level security;
alter table public.team_activity_log enable row level security;

create policy teams_select_member on public.teams
for select to authenticated using (private.is_team_member(id));
create policy team_members_select_member on public.team_members
for select to authenticated using (private.is_team_member(team_id));
create policy profiles_select_self_or_teammate on public.profiles
for select to authenticated
using (id = (select auth.uid()) or private.shares_team_with(id));
create policy profiles_update_self on public.profiles
for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));
create policy team_activity_log_select_admin_manager on public.team_activity_log
for select to authenticated
using (private.has_team_role(team_id, array['admin', 'manager']::public.team_role[]));

-- SECURITY (S1, S7, S17): revoke direct mutations; activity contains ids, never PII.
revoke all on public.teams, public.team_members, public.profiles, public.team_activity_log
from public, anon, authenticated;
grant select on public.teams, public.team_members to authenticated;
grant select (id, display_name, avatar_url), update (display_name, avatar_url)
on public.profiles to authenticated;
grant select on public.team_activity_log to authenticated;

revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.team_role_of(uuid) to authenticated;
grant execute on function private.is_team_member(uuid) to authenticated;
grant execute on function private.has_team_role(uuid, public.team_role[]) to authenticated;
grant execute on function private.shares_team_with(uuid) to authenticated;
grant execute on function private.impl_create_team(text) to authenticated;
grant execute on function private.impl_transfer_team_ownership(uuid, uuid) to authenticated;
grant execute on function private.impl_delete_team(uuid, text) to authenticated;
grant execute on function private.impl_change_member_role(uuid, uuid, public.team_role) to authenticated;
grant execute on function private.impl_remove_member(uuid, uuid) to authenticated;
grant execute on function private.impl_leave_team(uuid) to authenticated;
alter default privileges in schema private revoke execute on functions from public, anon;

revoke execute on function public.create_team(text) from public, anon;
revoke execute on function public.transfer_team_ownership(uuid, uuid) from public, anon;
revoke execute on function public.delete_team(uuid, text) from public, anon;
revoke execute on function public.change_member_role(uuid, uuid, public.team_role) from public, anon;
revoke execute on function public.remove_member(uuid, uuid) from public, anon;
revoke execute on function public.leave_team(uuid) from public, anon;
grant execute on function public.create_team(text) to authenticated;
grant execute on function public.transfer_team_ownership(uuid, uuid) to authenticated;
grant execute on function public.delete_team(uuid, text) to authenticated;
grant execute on function public.change_member_role(uuid, uuid, public.team_role) to authenticated;
grant execute on function public.remove_member(uuid, uuid) to authenticated;
grant execute on function public.leave_team(uuid) to authenticated;

revoke execute on function private.handle_new_auth_user() from public, anon, authenticated;
revoke execute on function public.set_profile_updated_at() from public, anon, authenticated;

