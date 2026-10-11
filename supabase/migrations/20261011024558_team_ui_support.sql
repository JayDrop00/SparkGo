/*
 * FILE:     supabase/migrations/20261011024558_team_ui_support.sql
 * PURPOSE:  Add team rename support and resolve Phase 1/2 advisor findings.
 * FLOWS:    G (docs/prompts/team-collab.md sections 8.1 and 10).
 * SECURITY: S2, S5, S6, S9, S10, S17, S20, S22.
 * DEBUG:    Check caller's Admin membership and the updated teams.name value.
 */

create index if not exists teams_owner_id_idx on public.teams (owner_id);
create index if not exists team_activity_log_actor_id_idx on public.team_activity_log (actor_id);

drop policy if exists team_invites_select_team_admins_and_invitee on public.team_invites;
create policy team_invites_select_team_admins_and_invitee
on public.team_invites for select to authenticated
using (
  private.has_team_role(team_id, array['admin', 'manager']::public.team_role[])
  or email = lower(btrim(coalesce((select auth.jwt()) ->> 'email', '')))
);

/*
 * FILE:     supabase/migrations/20261011024558_team_ui_support.sql
 * PURPOSE:  Rename a team after verifying caller identity and Admin role.
 * FLOWS:    G.2-G.3 (docs/prompts/team-collab.md section 10).
 * SECURITY: S2, S5, S9, S10, S12.
 * DEBUG:    Verify team row lock, private.team_role_of(), and the normalized name.
 */
create or replace function private.impl_rename_team(p_team_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text := btrim(coalesce(p_name, ''));
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_team_id is null or char_length(v_name) not between 1 and 60 then
    raise exception 'INVALID_INPUT';
  end if;

  -- SECURITY (S11): serialize renames against deletes and ownership transitions.
  perform 1 from public.teams t where t.id = p_team_id for update;
  if not found or not private.is_team_member(p_team_id) then
    raise exception 'NOT_FOUND';
  end if;
  if private.team_role_of(p_team_id) <> 'admin' then
    raise exception 'FORBIDDEN';
  end if;

  update public.teams set name = v_name where id = p_team_id;
end;
$$;

create or replace function public.rename_team(p_team_id uuid, p_name text)
returns void
language sql
security invoker
set search_path = ''
as $$ select private.impl_rename_team(p_team_id, p_name) $$;

revoke execute on function private.impl_rename_team(uuid, text) from public, anon, authenticated;
grant execute on function private.impl_rename_team(uuid, text) to authenticated;
revoke execute on function public.rename_team(uuid, text) from public, anon;
grant execute on function public.rename_team(uuid, text) to authenticated;
