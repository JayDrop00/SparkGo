/*
 * FILE:     supabase/migrations/20261011060000_team_dashboard.sql
 * PURPOSE:  Add scoped, timezone-aware personal/team dashboard read functions.
 * FLOWS:    H dashboard load (docs/prompts/team-collab.md sections 8.5, 10).
 * SECURITY: S1, S2, S5, S6, S9, S12, S16, S17, S18, S20, S22.
 * DEBUG:    Check scope/tz validation, assigned-task filters, local-day boundaries, and reviewer gates.
 */

create index completion_requests_task_idx on public.completion_requests (task_id);
create index completion_requests_reviewed_by_idx on public.completion_requests (reviewed_by);
create index team_tasks_completed_by_idx on public.team_tasks (completed_by, completed_at) where status='done';
create index tasks_owner_completion_idx on public.tasks (owner_id, completed_at) where completed_at is not null;

create or replace function private.validate_dashboard_scope(p_scope text)
returns void language plpgsql immutable security invoker set search_path = '' as $$
begin
  if p_scope is null or p_scope not in ('personal','team','all') then raise exception 'INVALID_INPUT'; end if;
end;
$$;
create or replace function private.validate_dashboard_timezone(p_tz text)
returns void language plpgsql stable security invoker set search_path = '' as $$
begin
  if p_tz is null or not exists (select 1 from pg_catalog.pg_timezone_names z where z.name=p_tz) then raise exception 'INVALID_INPUT'; end if;
end;
$$;

/* The only SQL difficulty-to-points mapping. */
create or replace function private.task_spark_points(p_difficulty public.task_difficulty)
returns integer language sql immutable security invoker set search_path = '' as $$
  select case p_difficulty when 'EASY' then 1 when 'MEDIUM' then 2 when 'HARD' then 3 when 'VERY_HARD' then 5 else 0 end
$$;
revoke execute on function private.validate_dashboard_scope(text) from public,anon;
revoke execute on function private.validate_dashboard_timezone(text) from public,anon;
revoke execute on function private.task_spark_points(public.task_difficulty) from public,anon;
grant execute on function private.validate_dashboard_scope(text) to authenticated;
grant execute on function private.validate_dashboard_timezone(text) to authenticated;
grant execute on function private.task_spark_points(public.task_difficulty) to authenticated;

create or replace function public.dashboard_stats(p_scope text,p_tz text)
returns table(due_today bigint,overdue bigint,completed_this_week bigint,active bigint)
language plpgsql stable security invoker set search_path = '' as $$
declare v_start timestamptz; v_end timestamptz; v_week timestamptz; v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  perform private.validate_dashboard_scope(p_scope); perform private.validate_dashboard_timezone(p_tz);
  v_start := ((now() at time zone p_tz)::date)::timestamp at time zone p_tz;
  v_end := v_start + interval '1 day';
  v_week := (date_trunc('week',now() at time zone p_tz)::timestamp at time zone p_tz);
  return query with items as (
    select coalesce(t.deadline_at,t.due_date) due_at,case when t.completed_at is null then 'todo' else 'done' end status,t.completed_at,t.difficulty,'personal'::text source
    from public.tasks t where p_scope in ('personal','all') and t.owner_id=v_uid
    union all
    select t.due_at,t.status::text,t.completed_at,t.difficulty,'team'::text
    from public.team_tasks t join public.task_assignees a on a.task_id=t.id and a.team_id=t.team_id
    where p_scope in ('team','all') and a.user_id=v_uid
  )
  select count(*) filter(where i.due_at>=v_start and i.due_at<v_end and i.status<>'done'),
    count(*) filter(where i.due_at<now() and i.status not in ('done','pending_review')),
    count(*) filter(where i.completed_at>=v_week and i.completed_at<v_week+interval '7 days'),
    count(*) filter(where i.status<>'done')
  from items i;
end;
$$;

create or replace function public.dashboard_up_next(p_scope text,p_tz text,p_limit integer default 5)
returns table(id uuid,source text,team_id uuid,team_name text,title text,due_at timestamptz,difficulty public.task_difficulty,group_name text,group_color text,status text)
language plpgsql stable security invoker set search_path = '' as $$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  perform private.validate_dashboard_scope(p_scope); perform private.validate_dashboard_timezone(p_tz);
  if p_limit is not null and p_limit < 1 then raise exception 'INVALID_INPUT'; end if;
  return query
  (select t.id,'personal'::text,null::uuid,null::text,t.task_name,coalesce(t.deadline_at,t.due_date),t.difficulty,g.group_name,g.color,
    case when t.completed_at is null then 'todo' else 'done' end
   from public.tasks t left join public.task_groups g on g.id=t.group_id
   where p_scope in ('personal','all') and t.owner_id=v_uid and t.completed_at is null)
  union all
  (select t.id,'team'::text,tm.id,tm.name,t.task_name,t.due_at,t.difficulty,g.group_name,g.color,t.status::text
   from public.team_tasks t join public.task_assignees a on a.task_id=t.id and a.team_id=t.team_id
   join public.teams tm on tm.id=t.team_id left join public.team_groups g on g.id=t.group_id
   where p_scope in ('team','all') and a.user_id=v_uid and t.status<>'done')
  order by due_at nulls last limit least(coalesce(p_limit,5),50);
end;
$$;

create or replace function public.dashboard_group_progress(p_scope text)
returns table(source text,team_id uuid,group_id uuid,name text,color text,done_count bigint,total_count bigint)
language plpgsql stable security invoker set search_path = '' as $$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  perform private.validate_dashboard_scope(p_scope);
  return query
  select 'personal'::text,null::uuid,g.id,g.group_name,g.color,count(t.id) filter(where t.completed_at is not null),count(t.id)
  from public.task_groups g left join public.tasks t on t.group_id=g.id and t.owner_id=v_uid
  where p_scope in ('personal','all') and g.owner_id=v_uid group by g.id,g.group_name,g.color
  union all
  select 'team'::text,g.team_id,g.id,g.group_name,g.color,count(t.id) filter(where t.status='done'),count(t.id)
  from public.team_groups g left join public.team_tasks t on t.group_id=g.id
    and exists(select 1 from public.task_assignees a where a.task_id=t.id and a.team_id=t.team_id and a.user_id=v_uid)
  where p_scope in ('team','all') group by g.team_id,g.id,g.group_name,g.color;
end;
$$;

create or replace function public.dashboard_week(p_scope text,p_tz text,p_week_start date)
returns table(day date,group_colors text[])
language plpgsql stable security invoker set search_path = '' as $$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  perform private.validate_dashboard_scope(p_scope); perform private.validate_dashboard_timezone(p_tz);
  if p_week_start is null or extract(isodow from p_week_start)<>1 then raise exception 'INVALID_INPUT'; end if;
  return query with due_items as (
    select (coalesce(t.deadline_at,t.due_date) at time zone p_tz)::date as local_day,g.color
    from public.tasks t left join public.task_groups g on g.id=t.group_id
    where p_scope in ('personal','all') and t.owner_id=v_uid and t.completed_at is null and coalesce(t.deadline_at,t.due_date) is not null
      and (coalesce(t.deadline_at,t.due_date) at time zone p_tz)::date between p_week_start and p_week_start+6
    union all
    select (t.due_at at time zone p_tz)::date as local_day,g.color from public.team_tasks t
    join public.task_assignees a on a.task_id=t.id and a.team_id=t.team_id left join public.team_groups g on g.id=t.group_id
    where p_scope in ('team','all') and a.user_id=v_uid and t.status<>'done' and t.due_at is not null
      and (t.due_at at time zone p_tz)::date between p_week_start and p_week_start+6
  )
  select c.local_day::date,coalesce(array(select distinct d.color from due_items d where d.local_day=c.local_day::date and d.color is not null order by d.color limit 3),array[]::text[])
  from generate_series(p_week_start::timestamp,(p_week_start+6)::timestamp,interval '1 day') c(local_day) order by c.local_day;
end;
$$;

create or replace function public.dashboard_trend(p_scope text,p_tz text,p_days integer default 7)
returns table(day date,completions bigint)
language plpgsql stable security invoker set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_days integer := greatest(1,least(coalesce(p_days,7),30)); v_today date;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  perform private.validate_dashboard_scope(p_scope); perform private.validate_dashboard_timezone(p_tz);
  v_today := (now() at time zone p_tz)::date;
  return query with done_items as (
    select (t.completed_at at time zone p_tz)::date as local_day from public.tasks t
    where p_scope in ('personal','all') and t.owner_id=v_uid and t.completed_at is not null
    union all
    select (t.completed_at at time zone p_tz)::date as local_day from public.team_tasks t
    join public.task_assignees a on a.task_id=t.id and a.team_id=t.team_id
    where p_scope in ('team','all') and a.user_id=v_uid and t.completed_at is not null and t.completed_by=v_uid
  ), days as (select generate_series(v_today-(v_days-1),v_today,interval '1 day')::date as calendar_day)
  select d.calendar_day,count(i.local_day) from days d left join done_items i on i.local_day=d.calendar_day group by d.calendar_day order by d.calendar_day;
end;
$$;

create or replace function public.dashboard_spark(p_scope text,p_tz text)
returns table(points_this_week bigint,streak_days integer)
language plpgsql stable security invoker set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_today date; v_week date;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  perform private.validate_dashboard_scope(p_scope); perform private.validate_dashboard_timezone(p_tz);
  v_today := (now() at time zone p_tz)::date; v_week := date_trunc('week',v_today::timestamp)::date;
  return query with completions as (
    select t.completed_at,t.difficulty from public.tasks t where p_scope in ('personal','all') and t.owner_id=v_uid and t.completed_at is not null
    union all
    select t.completed_at,t.difficulty from public.team_tasks t join public.task_assignees a on a.task_id=t.id and a.team_id=t.team_id
    where p_scope in ('team','all') and a.user_id=v_uid and t.completed_at is not null and t.completed_by=v_uid
  ), local_days as (select distinct (c.completed_at at time zone p_tz)::date as local_day from completions c),
  points as (select coalesce(sum(private.task_spark_points(c.difficulty)),0)::bigint total from completions c where (c.completed_at at time zone p_tz)::date between v_week and v_today)
  select points.total,
    (select case when exists(select 1 from local_days where local_day=v_today) then
       coalesce((select min(n)::integer from generate_series(0,366) n where not exists(select 1 from local_days d where d.local_day=v_today-n)),366)
     else coalesce((select min(n)::integer from generate_series(0,366) n where not exists(select 1 from local_days d where d.local_day=v_today-1-n)),0) end)
  from points;
end;
$$;

create or replace function public.team_workload(p_team_id uuid)
returns table(user_id uuid,display_name text,open_task_count bigint,tags text[])
language plpgsql stable security invoker set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not private.is_team_member(p_team_id) then raise exception 'NOT_FOUND'; end if;
  if not private.has_team_role(p_team_id,array['admin','manager']::public.team_role[]) then raise exception 'FORBIDDEN'; end if;
  return query select m.user_id,p.display_name,count(distinct t.id) filter(where t.status<>'done'),
    coalesce(array_agg(distinct tag.name) filter(where tag.name is not null),array[]::text[])
  from public.team_members m left join public.profiles p on p.id=m.user_id
  left join public.task_assignees a on a.team_id=m.team_id and a.user_id=m.user_id
  left join public.team_tasks t on t.id=a.task_id and t.status<>'done'
  left join public.member_tags mt on mt.team_id=m.team_id and mt.user_id=m.user_id
  left join public.team_tags tag on tag.id=mt.tag_id and tag.team_id=mt.team_id
  where m.team_id=p_team_id group by m.user_id,p.display_name order by p.display_name nulls last,m.user_id;
end;
$$;

create or replace function public.team_activity_recent(p_team_id uuid,p_limit integer default 10)
returns table(activity_id bigint,action text)
language plpgsql stable security invoker set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not private.is_team_member(p_team_id) then raise exception 'NOT_FOUND'; end if;
  if not private.has_team_role(p_team_id,array['admin','manager']::public.team_role[]) then raise exception 'FORBIDDEN'; end if;
  return query select l.id,l.action from public.team_activity_log l where l.team_id=p_team_id order by l.created_at desc limit greatest(1,least(coalesce(p_limit,10),50));
end;
$$;

revoke execute on function public.dashboard_stats(text,text) from public,anon;
revoke execute on function public.dashboard_up_next(text,text,integer) from public,anon;
revoke execute on function public.dashboard_group_progress(text) from public,anon;
revoke execute on function public.dashboard_week(text,text,date) from public,anon;
revoke execute on function public.dashboard_trend(text,text,integer) from public,anon;
revoke execute on function public.dashboard_spark(text,text) from public,anon;
revoke execute on function public.team_workload(uuid) from public,anon;
revoke execute on function public.team_activity_recent(uuid,integer) from public,anon;
grant execute on function public.dashboard_stats(text,text) to authenticated;
grant execute on function public.dashboard_up_next(text,text,integer) to authenticated;
grant execute on function public.dashboard_group_progress(text) to authenticated;
grant execute on function public.dashboard_week(text,text,date) to authenticated;
grant execute on function public.dashboard_trend(text,text,integer) to authenticated;
grant execute on function public.dashboard_spark(text,text) to authenticated;
grant execute on function public.team_workload(uuid) to authenticated;
grant execute on function public.team_activity_recent(uuid,integer) to authenticated;
