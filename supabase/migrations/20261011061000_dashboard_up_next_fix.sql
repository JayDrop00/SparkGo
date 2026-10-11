/*
 * FILE:     supabase/migrations/20261011061000_dashboard_up_next_fix.sql
 * PURPOSE:  Fix UNION ordering in the dashboard up-next query.
 * FLOWS:    H dashboard load (docs/prompts/team-collab.md section 8.5).
 * SECURITY: S2, S5, S6, S9, S12, S20.
 * DEBUG:    Inspect the ordered derived table and verify team tasks require caller assignment.
 */
create or replace function public.dashboard_up_next(p_scope text,p_tz text,p_limit integer default 5)
returns table(id uuid,source text,team_id uuid,team_name text,title text,due_at timestamptz,difficulty public.task_difficulty,group_name text,group_color text,status text)
language plpgsql stable security invoker set search_path = '' as $$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  perform private.validate_dashboard_scope(p_scope); perform private.validate_dashboard_timezone(p_tz);
  if p_limit is not null and p_limit < 1 then raise exception 'INVALID_INPUT'; end if;
  return query select q.id,q.source,q.team_id,q.team_name,q.title,q.due_at,q.difficulty,q.group_name,q.group_color,q.status
  from (
    select t.id,'personal'::text as source,null::uuid as team_id,null::text as team_name,t.task_name as title,
      coalesce(t.deadline_at,t.due_date) as due_at,t.difficulty,g.group_name,g.color as group_color,
      case when t.completed_at is null then 'todo' else 'done' end as status
    from public.tasks t left join public.task_groups g on g.id=t.group_id
    where p_scope in ('personal','all') and t.owner_id=v_uid and t.completed_at is null
    union all
    select t.id,'team'::text,tm.id,tm.name,t.task_name,t.due_at,t.difficulty,g.group_name,g.color,t.status::text
    from public.team_tasks t join public.task_assignees a on a.task_id=t.id and a.team_id=t.team_id
      join public.teams tm on tm.id=t.team_id left join public.team_groups g on g.id=t.group_id
    where p_scope in ('team','all') and a.user_id=v_uid and t.status<>'done'
  ) q
  order by q.due_at nulls last limit least(coalesce(p_limit,5),50);
end;
$$;
revoke execute on function public.dashboard_up_next(text,text,integer) from public,anon;
grant execute on function public.dashboard_up_next(text,text,integer) to authenticated;
