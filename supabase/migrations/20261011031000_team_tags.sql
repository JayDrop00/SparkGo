/*
 * FILE:     supabase/migrations/20261011031000_team_tags.sql
 * PURPOSE:  Add role-gated team tags and same-team member tag assignments.
 * FLOWS:    Tags tab and edit member tags (docs/prompts/team-collab.md sections 5, 7, 10).
 * SECURITY: S1, S2, S5, S6, S7, S9, S10, S12, S17, S20, S22.
 * DEBUG:    Check private.has_team_role, RLS, composite foreign keys and cap triggers.
 */

create table public.team_tags (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 30),
  color text check (color is null or color ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now(),
  unique (id, team_id)
);
create unique index team_tags_name_unique on public.team_tags (team_id, lower(btrim(name)));

create table public.member_tags (
  team_id uuid not null,
  user_id uuid not null,
  tag_id uuid not null,
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (team_id, user_id, tag_id),
  foreign key (team_id, user_id) references public.team_members (team_id, user_id) on delete cascade,
  foreign key (tag_id, team_id) references public.team_tags (id, team_id) on delete cascade
);
create index member_tags_tag_team_idx on public.member_tags (tag_id, team_id);

create or replace function private.enforce_team_tag_limits()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_limit integer;
begin
  if tg_table_name = 'team_tags' then
    perform 1 from public.teams t where t.id = new.team_id for update;
    select count(*) into v_limit from public.team_tags tt where tt.team_id = new.team_id;
    if v_limit >= private.team_limit('max_tags_per_team') then raise exception 'LIMIT_REACHED'; end if;
  else
    perform 1 from public.team_members tm where tm.team_id = new.team_id and tm.user_id = new.user_id for update;
    select count(*) into v_limit from public.member_tags mt where mt.team_id = new.team_id and mt.user_id = new.user_id;
    if v_limit >= private.team_limit('max_tags_per_member') then raise exception 'LIMIT_REACHED'; end if;
  end if;
  return new;
end;
$$;
create trigger team_tags_enforce_limit before insert on public.team_tags
for each row execute function private.enforce_team_tag_limits();
create trigger member_tags_enforce_limit before insert on public.member_tags
for each row execute function private.enforce_team_tag_limits();

alter table public.team_tags enable row level security;
alter table public.member_tags enable row level security;

create policy team_tags_select_member on public.team_tags
for select to authenticated using (private.is_team_member(team_id));
create policy team_tags_insert_admin_manager on public.team_tags
for insert to authenticated with check (private.has_team_role(team_id, array['admin','manager']::public.team_role[]));
create policy team_tags_update_admin_manager on public.team_tags
for update to authenticated using (private.has_team_role(team_id, array['admin','manager']::public.team_role[]))
with check (private.has_team_role(team_id, array['admin','manager']::public.team_role[]));
create policy team_tags_delete_admin_manager on public.team_tags
for delete to authenticated using (private.has_team_role(team_id, array['admin','manager']::public.team_role[]));

create policy member_tags_select_member on public.member_tags
for select to authenticated using (private.is_team_member(team_id));
create policy member_tags_insert_admin_manager on public.member_tags
for insert to authenticated with check (private.has_team_role(team_id, array['admin','manager']::public.team_role[]));
create policy member_tags_delete_admin_manager on public.member_tags
for delete to authenticated using (private.has_team_role(team_id, array['admin','manager']::public.team_role[]));

revoke all on public.team_tags, public.member_tags from public, anon, authenticated;
grant select, insert, update, delete on public.team_tags to authenticated;
grant select, insert, delete on public.member_tags to authenticated;
revoke execute on function private.enforce_team_tag_limits() from public, anon, authenticated;

/*
 * FILE:     supabase/migrations/20261011031000_team_tags.sql
 * PURPOSE:  Atomically replace a member's tags after role and team checks.
 * FLOWS:    Tag assignment dialog (docs/prompts/team-collab.md section 10).
 * SECURITY: S2, S5, S9, S10, S11, S12, S17, S20, S22.
 * DEBUG:    Verify caller's team role, target membership, tag team ids and result rows.
 */
create or replace function private.impl_set_member_tags(p_team_id uuid, p_user_id uuid, p_tag_ids uuid[])
returns void language plpgsql security definer set search_path = ''
as $$
declare v_tag_ids uuid[] := coalesce(p_tag_ids, array[]::uuid[]);
begin
  if (select auth.uid()) is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_team_id is null or p_user_id is null or cardinality(v_tag_ids) > private.team_limit('max_tags_per_member')
     or cardinality(v_tag_ids) <> (select count(distinct x) from unnest(v_tag_ids) as x) then
    raise exception 'INVALID_INPUT';
  end if;
  if not private.has_team_role(p_team_id, array['admin','manager']::public.team_role[]) then
    raise exception 'FORBIDDEN';
  end if;
  perform 1 from public.team_members tm where tm.team_id = p_team_id and tm.user_id = p_user_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if (select count(*) from public.team_tags tt where tt.team_id = p_team_id and tt.id = any(v_tag_ids)) <> cardinality(v_tag_ids) then
    raise exception 'INVALID_INPUT';
  end if;
  delete from public.member_tags mt where mt.team_id = p_team_id and mt.user_id = p_user_id;
  insert into public.member_tags(team_id, user_id, tag_id, assigned_by)
  select p_team_id, p_user_id, x, (select auth.uid()) from unnest(v_tag_ids) as x;
end;
$$;

create or replace function public.set_member_tags(p_team_id uuid, p_user_id uuid, p_tag_ids uuid[])
returns void language sql security invoker set search_path = ''
as $$ select private.impl_set_member_tags(p_team_id, p_user_id, p_tag_ids) $$;
revoke execute on function private.impl_set_member_tags(uuid, uuid, uuid[]) from public, anon, authenticated;
grant execute on function private.impl_set_member_tags(uuid, uuid, uuid[]) to authenticated;
revoke execute on function public.set_member_tags(uuid, uuid, uuid[]) from public, anon;
grant execute on function public.set_member_tags(uuid, uuid, uuid[]) to authenticated;
