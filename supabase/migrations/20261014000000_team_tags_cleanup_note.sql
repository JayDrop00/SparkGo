/*
 * FILE:     supabase/migrations/20261014000000_team_tags_cleanup_note.sql
 * PURPOSE:  Optional, non-destructive cleanup note for legacy member_tags rows
 *           that assign the same tag to every member of a team.
 * FLOWS:    Tags tab redesign (per-member tag assignment).
 * SECURITY: Read-only inspection queries below; nothing is executed automatically.
 * DEBUG:    Run the inspection query first, then the delete for a specific tag if intended.
 */

-- INSPECT (safe, read-only): lists team tags currently assigned to every member.
-- select tt.team_id, tt.id as tag_id, tt.name, count(mt.user_id) as assigned_members, tm.total_members
-- from public.team_tags tt
-- cross join lateral (
--   select count(*) as total_members from public.team_members m where m.team_id = tt.team_id
-- ) tm
-- left join public.member_tags mt on mt.tag_id = tt.id and mt.team_id = tt.team_id
-- group by tt.team_id, tt.id, tt.name, tm.total_members
-- having count(mt.user_id) = tm.total_members and tm.total_members > 1;

-- CLEANUP (manual, run per tag): removes all assignments of one tag from a team.
-- Replace the team id and tag name with the values found above.
-- delete from public.member_tags mt
-- using public.team_tags tt
-- where mt.tag_id = tt.id
--   and mt.team_id = tt.team_id
--   and tt.team_id = '<team-id>'
--   and lower(btrim(tt.name)) = '<tag-name>';
