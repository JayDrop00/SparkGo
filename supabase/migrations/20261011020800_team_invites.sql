/*
 * FILE:     supabase/migrations/20261011020800_team_invites.sql
 * PURPOSE:  Add in-app team invitations with verified-email acceptance.
 * FLOWS:    B, C (docs/prompts/team-collab.md sections 8.2 and 10).
 * SECURITY: S1, S2, S5, S6, S7, S9, S10, S11, S12, S17, S19, S20, S21, S22.
 * DEBUG:    Check JWT email/confirmation, invite status, membership, and activity log.
 */

create type public.invite_status as enum ('pending', 'accepted', 'declined', 'revoked');

create table public.team_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  team_name text not null check (char_length(team_name) <= 60),
  email text not null check (
    email = lower(btrim(email)) and char_length(email) between 3 and 254
  ),
  role public.team_role not null default 'member' check (role in ('manager', 'member')),
  status public.invite_status not null default 'pending',
  invited_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  responded_by uuid references auth.users(id) on delete set null
);

create unique index team_invites_one_pending
  on public.team_invites (team_id, email) where status = 'pending';
create index team_invites_email_pending
  on public.team_invites (email) where status = 'pending';
create index team_invites_team_status_expiry
  on public.team_invites (team_id, expires_at) where status = 'pending';
create index team_invites_inviter_created
  on public.team_invites (invited_by, created_at desc);
create index team_invites_responded_by_idx on public.team_invites (responded_by);

/*
 * FILE:     supabase/migrations/20261011020800_team_invites.sql
 * PURPOSE:  Privileged invite creation with team and inviter rate limits.
 * FLOWS:    B.3-B.5 (docs/prompts/team-collab.md section 10).
 * SECURITY: S2, S5, S9, S10, S11, S12, S17.
 * DEBUG:    Verify membership, normalized email, limits, then the member.invited log.
 */
create or replace function private.impl_invite_to_team(
  p_team_id uuid, p_email text, p_role public.team_role
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_role public.team_role;
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_team_name text;
  v_invite_id uuid;
  v_pending_count integer;
  v_member_count integer;
  v_recent_count integer;
begin
  -- SECURITY (S2): identify the caller exclusively from the verified request JWT.
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;

  if p_team_id is null or p_role is null
     or p_role not in ('manager', 'member')
     or char_length(v_email) not between 3 and 254
     or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'INVALID_INPUT';
  end if;

  -- SECURITY (S11): serialize this inviter's hourly limit across teams.
  perform 1 from auth.users u where u.id = v_uid for update;
  if not found then raise exception 'NOT_AUTHENTICATED'; end if;

  -- SECURITY (S11): team lock serializes invite limits and concurrent membership changes.
  select t.name into v_team_name
  from public.teams t
  where t.id = p_team_id
  for update;
  if not found or not private.is_team_member(p_team_id) then
    raise exception 'NOT_FOUND';
  end if;

  v_role := private.team_role_of(p_team_id);
  if v_role is null then raise exception 'NOT_FOUND'; end if;
  if v_role not in ('admin', 'manager')
     or (v_role = 'manager' and p_role <> 'member') then
    raise exception 'FORBIDDEN';
  end if;

  -- Expiration is derived from pending + expires_at; retire a stale matching row so
  -- the partial unique index permits the replacement invitation.
  update public.team_invites i
     set status = 'revoked', responded_at = now(), responded_by = null
   where i.team_id = p_team_id and i.email = v_email
     and i.status = 'pending' and i.expires_at <= now();

  if exists (
    select 1
    from public.team_members tm
    join auth.users u on u.id = tm.user_id
    where tm.team_id = p_team_id and lower(btrim(u.email)) = v_email
  ) then
    raise exception 'ALREADY_MEMBER';
  end if;
  if exists (
    select 1 from public.team_invites i
    where i.team_id = p_team_id and i.email = v_email
      and i.status = 'pending' and i.expires_at > now()
  ) then
    raise exception 'ALREADY_INVITED';
  end if;

  select count(*)::integer into v_recent_count
  from public.team_invites i
  where i.invited_by = v_uid and i.created_at > now() - interval '1 hour';
  if v_recent_count >= private.team_limit('max_invites_per_hour') then
    raise exception 'RATE_LIMITED';
  end if;

  select count(*)::integer into v_pending_count
  from public.team_invites i
  where i.team_id = p_team_id and i.status = 'pending' and i.expires_at > now();
  select count(*)::integer into v_member_count
  from public.team_members tm where tm.team_id = p_team_id;
  if v_pending_count >= private.team_limit('max_pending_invites')
     or v_member_count >= private.team_limit('max_team_members') then
    raise exception 'LIMIT_REACHED';
  end if;

  insert into public.team_invites (team_id, team_name, email, role, invited_by)
  values (p_team_id, v_team_name, v_email, p_role, v_uid)
  returning id into v_invite_id;

  insert into public.team_activity_log (team_id, actor_id, action, target_type, target_id)
  values (p_team_id, v_uid, 'member.invited', 'invite', v_invite_id);
  return v_invite_id;
end;
$$;

/*
 * FILE:     supabase/migrations/20261011020800_team_invites.sql
 * PURPOSE:  Accept or decline an invite bound to a confirmed matching email.
 * FLOWS:    C.3-C.5 (docs/prompts/team-collab.md section 10).
 * SECURITY: S2, S5, S9, S10, S11, S17, S21.
 * DEBUG:    Check invite email match, auth.users.email_confirmed_at, status, and team cap.
 */
create or replace function private.impl_respond_to_invite(p_invite_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_email text := lower(btrim(coalesce(auth.jwt() ->> 'email', '')));
  v_invite public.team_invites%rowtype;
  v_confirmed_at timestamptz;
  v_member_count integer;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_invite_id is null or p_accept is null then raise exception 'INVALID_INPUT'; end if;

  -- SECURITY (S11): the invite lock prevents two concurrent responses.
  select * into v_invite
  from public.team_invites i
  where i.id = p_invite_id
  for update;

  -- SECURITY (S9): unknown ids and invitations for a different email are identical.
  if not found or v_invite.email <> v_email then raise exception 'NOT_FOUND'; end if;

  select u.email_confirmed_at into v_confirmed_at
  from auth.users u where u.id = v_uid;
  if v_confirmed_at is null then raise exception 'EMAIL_NOT_CONFIRMED'; end if;

  if v_invite.status <> 'pending' then raise exception 'INVALID_STATE'; end if;
  if v_invite.expires_at <= now() then raise exception 'INVITE_EXPIRED'; end if;

  if p_accept then
    -- Serialize the team member cap with other invite acceptances and membership RPCs.
    perform 1 from public.teams t where t.id = v_invite.team_id for update;
    if not found then raise exception 'NOT_FOUND'; end if;

    select count(*)::integer into v_member_count
    from public.team_members tm where tm.team_id = v_invite.team_id;
    if v_member_count >= private.team_limit('max_team_members') then
      raise exception 'LIMIT_REACHED';
    end if;

    insert into public.team_members (team_id, user_id, role)
    values (v_invite.team_id, v_uid, v_invite.role)
    on conflict (team_id, user_id) do nothing;

    update public.team_invites
       set status = 'accepted', responded_at = now(), responded_by = v_uid
     where id = v_invite.id;
    insert into public.team_activity_log (team_id, actor_id, action, target_type, target_id)
    values (v_invite.team_id, v_uid, 'invite.accepted', 'invite', v_invite.id);
  else
    update public.team_invites
       set status = 'declined', responded_at = now(), responded_by = v_uid
     where id = v_invite.id;
    insert into public.team_activity_log (team_id, actor_id, action, target_type, target_id)
    values (v_invite.team_id, v_uid, 'invite.declined', 'invite', v_invite.id);
  end if;
end;
$$;

/*
 * FILE:     supabase/migrations/20261011020800_team_invites.sql
 * PURPOSE:  Revoke a pending invitation with role-scoped authority.
 * FLOWS:    Team invitation management (docs/prompts/team-collab.md section 8.2).
 * SECURITY: S2, S5, S9, S10, S11, S17.
 * DEBUG:    Compare caller's team role and invited_by before checking pending status.
 */
create or replace function private.impl_revoke_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_invite public.team_invites%rowtype;
  v_role public.team_role;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_invite_id is null then raise exception 'INVALID_INPUT'; end if;

  -- SECURITY (S11): lock before checking status to prevent double revocation.
  select * into v_invite
  from public.team_invites i where i.id = p_invite_id for update;
  if not found or not private.is_team_member(v_invite.team_id) then
    raise exception 'NOT_FOUND';
  end if;

  v_role := private.team_role_of(v_invite.team_id);
  if v_role = 'admin' then
    null;
  elsif v_role = 'manager' then
    if v_invite.invited_by <> v_uid then raise exception 'FORBIDDEN'; end if;
  else
    raise exception 'FORBIDDEN';
  end if;

  if v_invite.status <> 'pending' then raise exception 'INVALID_STATE'; end if;

  update public.team_invites
     set status = 'revoked', responded_at = now(), responded_by = v_uid
   where id = v_invite.id;
  insert into public.team_activity_log (team_id, actor_id, action, target_type, target_id)
  values (v_invite.team_id, v_uid, 'invite.revoked', 'invite', v_invite.id);
end;
$$;

/*
 * FILE:     supabase/migrations/20261011020800_team_invites.sql
 * PURPOSE:  Return invite emails only to the authorized creator.
 * FLOWS:    Invitation management UI (docs/prompts/team-collab.md sections 8.2 and 10).
 * SECURITY: S2, S5, S9, S22.
 * DEBUG:    Confirm the result is limited to pending invitations created by this caller.
 */
create or replace function private.impl_list_my_team_invites(p_team_id uuid)
returns table (
  id uuid, email text, role public.team_role, status public.invite_status,
  expires_at timestamptz, created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_team_id is null or not private.is_team_member(p_team_id) then
    raise exception 'NOT_FOUND';
  end if;
  if not private.has_team_role(p_team_id, array['admin', 'manager']::public.team_role[]) then
    raise exception 'FORBIDDEN';
  end if;

  return query
  select i.id, i.email, i.role, i.status, i.expires_at, i.created_at
  from public.team_invites i
  where i.team_id = p_team_id and i.invited_by = v_uid
    and i.status = 'pending' and i.expires_at > now()
  order by i.created_at desc;
end;
$$;

-- Public PostgREST functions remain SECURITY INVOKER; only private functions own the privileged writes.
create or replace function public.invite_to_team(
  p_team_id uuid, p_email text, p_role public.team_role
)
returns uuid language sql security invoker set search_path = ''
as $$ select private.impl_invite_to_team(p_team_id, p_email, p_role) $$;

create or replace function public.respond_to_invite(p_invite_id uuid, p_accept boolean)
returns void language sql security invoker set search_path = ''
as $$ select private.impl_respond_to_invite(p_invite_id, p_accept) $$;

create or replace function public.revoke_invite(p_invite_id uuid)
returns void language sql security invoker set search_path = ''
as $$ select private.impl_revoke_invite(p_invite_id) $$;

create or replace function public.list_my_team_invites(p_team_id uuid)
returns table (
  id uuid, email text, role public.team_role, status public.invite_status,
  expires_at timestamptz, created_at timestamptz
)
language sql security invoker set search_path = ''
as $$ select * from private.impl_list_my_team_invites(p_team_id) $$;

alter table public.team_invites enable row level security;
create policy team_invites_select_team_admins_and_invitee
on public.team_invites for select to authenticated
using (
  private.has_team_role(team_id, array['admin', 'manager']::public.team_role[])
  or email = lower(btrim(coalesce(auth.jwt() ->> 'email', '')))
);

-- SECURITY (S1, S7, S22): invitees can read banner fields but never the email column;
-- creators retrieve their own invite emails through list_my_team_invites.
revoke all on public.team_invites from public, anon, authenticated;
grant select (id, team_id, team_name, role, status, invited_by, expires_at, created_at, responded_at, responded_by)
  on public.team_invites to authenticated;

revoke execute on function private.impl_invite_to_team(uuid, text, public.team_role)
  from public, anon, authenticated;
revoke execute on function private.impl_respond_to_invite(uuid, boolean)
  from public, anon, authenticated;
revoke execute on function private.impl_revoke_invite(uuid)
  from public, anon, authenticated;
revoke execute on function private.impl_list_my_team_invites(uuid)
  from public, anon, authenticated;
grant execute on function private.impl_invite_to_team(uuid, text, public.team_role) to authenticated;
grant execute on function private.impl_respond_to_invite(uuid, boolean) to authenticated;
grant execute on function private.impl_revoke_invite(uuid) to authenticated;
grant execute on function private.impl_list_my_team_invites(uuid) to authenticated;

revoke execute on function public.invite_to_team(uuid, text, public.team_role) from public, anon;
revoke execute on function public.respond_to_invite(uuid, boolean) from public, anon;
revoke execute on function public.revoke_invite(uuid) from public, anon;
revoke execute on function public.list_my_team_invites(uuid) from public, anon;
grant execute on function public.invite_to_team(uuid, text, public.team_role) to authenticated;
grant execute on function public.respond_to_invite(uuid, boolean) to authenticated;
grant execute on function public.revoke_invite(uuid) to authenticated;
grant execute on function public.list_my_team_invites(uuid) to authenticated;
