-- Return only active invitations addressed to the authenticated user.
-- The email column remains inaccessible to direct table reads.
create or replace function private.impl_list_my_incoming_team_invites()
returns table (
  id uuid,
  team_id uuid,
  team_name text,
  role public.team_role,
  expires_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_email text := lower(btrim(coalesce((select auth.jwt()) ->> 'email', '')));
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  if v_email = '' then
    return;
  end if;

  return query
  select i.id, i.team_id, i.team_name, i.role, i.expires_at, i.created_at
  from public.team_invites as i
  where i.email = v_email
    and i.invited_by <> v_uid
    and i.status = 'pending'
    and i.expires_at > now()
  order by i.created_at asc;
end;
$$;

create or replace function public.list_my_incoming_team_invites()
returns table (
  id uuid,
  team_id uuid,
  team_name text,
  role public.team_role,
  expires_at timestamptz,
  created_at timestamptz
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.impl_list_my_incoming_team_invites()
$$;

revoke execute on function private.impl_list_my_incoming_team_invites()
  from public, anon, authenticated;
grant execute on function private.impl_list_my_incoming_team_invites()
  to authenticated;

revoke execute on function public.list_my_incoming_team_invites()
  from public, anon;
grant execute on function public.list_my_incoming_team_invites()
  to authenticated;
