# Team collaboration debugging and handoff

## Environment and database workflow

This feature uses the linked hosted Supabase project. Do not start the local Supabase stack,
Docker, or `supabase db reset` for team collaboration work.

Check the target and pending migrations before applying schema changes:

```bash
npx supabase migration list --linked
npx supabase db push --linked --dry-run
npx supabase db push --linked --yes
npx supabase db advisors --linked --type all --level info
npx supabase db lint --linked
```

Do not edit an applied migration. Add a new timestamped migration for corrections. Read
[`RECON.md`](RECON.md) before resuming: it records completed phases, remote migration state,
test results, issues, and the next phase.

## Remote pgTAP suites

`supabase test db --linked` starts a Docker-based `pg_prove` runner in this CLI setup. To keep
the workflow remote-only, tests are SQL files with transaction rollback. Temporarily enable
pgTAP in the linked database, execute the files, then remove the extension:

```bash
npx supabase db query --linked "create extension if not exists pgtap with schema extensions;"
npx supabase db query --linked --file supabase/tests/database/team_core.test.sql
npx supabase db query --linked --file supabase/tests/database/team_invites.test.sql
npx supabase db query --linked --file supabase/tests/database/team_ui_support.test.sql
npx supabase db query --linked --file supabase/tests/database/team_tags.test.sql
npx supabase db query --linked --file supabase/tests/database/team_tasks.test.sql
npx supabase db query --linked --file supabase/tests/database/team_completion.test.sql
npx supabase db query --linked --file supabase/tests/database/team_dashboard.test.sql
npx supabase db query --linked --file supabase/tests/database/team_hardening.test.sql
npx supabase db query --linked "drop extension if exists pgtap;"
```

Each test script ends with `ROLLBACK`; seeded rows are not retained. The final output should
show the last `ok N` line or a `string_agg` containing every assertion. If a test fails, inspect
the named assertion before proceeding. Always remove pgTAP after the run, even if a test fails.

## Common failures

| Symptom | Check |
| --- | --- |
| `NOT_FOUND` from an RPC | Confirm the signed-in user is a member of that team and the ID belongs to that team. RPCs intentionally hide cross-team IDs. |
| `FORBIDDEN` on a team operation | Confirm the role in `team_members`; tags never grant permissions. Check RLS, table grants, then the RPC role check. |
| Task insert says permission denied | The caller needs Admin/Manager membership, task insert columns, same-team group ID, and an RLS insert policy match. |
| Assignment fails after task creation | The create action returns the task ID as partial success. Refresh the board and retry the assignee picker; do not delete the task automatically. |
| Task status write is denied | Expected: status and `completed_*` columns can only change through completion RPCs. |
| Request remains pending | Compare `completion_requests.status` and `team_tasks.status`. A pending request must pair with `pending_review`; verify requester, task assignee, and reviewer role. |
| A second reviewer gets `INVALID_STATE` | Expected concurrency result: only one reviewer can process a pending request. |
| Invite is missing from the banner | Check pending state, expiry, JWT email matching, and confirmed email. Email delivery is out of scope; invites appear in-app. |
| Team task due date differs from personal schedule | Team tasks store `due_at`; personal tasks preserve `deadline_at` and scheduled `start_at`/`end_at` semantics. |
| `db lint --linked` cannot connect | It uses a direct PostgreSQL login. Verify the linked project DB password through the CLI's supported configuration; never commit it. `db advisors --linked` can still run independently. |

## Manual two-session concurrency check (T10)

Use a pending request in a non-production test team. Two Admin/Manager accounts must both be
reviewers, and neither may be the requester.

1. In SQL editor session A, begin a transaction, set the authenticated role/JWT to reviewer A,
   and lock the pending request row with `SELECT ... FOR UPDATE`.
2. In session B, set the authenticated role/JWT to reviewer B and call
   `public.review_completion_request(request_id, true, null)`. Leave it waiting on the lock.
3. In session A, call the same review RPC and commit.
4. Session A should succeed. Session B should resume and return `INVALID_STATE`. Verify exactly
   one terminal request state and that its task is `done` with `completed_at` set.

Set the JWT claim values with the same pattern used in the database tests. Do not run this
against a task users are actively working on.

## Browser QA before production

Use separate Admin, Manager, Member, and Outsider browser sessions:

- Create a team, invite and accept a member, and confirm a second invite response is rejected.
- Verify Manager/Admin role differences, owner transfer, owner protection, and leave/remove.
- Create a tag, assign it, and confirm the member's role and permissions do not change.
- Create a team task, assign it to the creator and to an existing member, edit it, and reorder
  tasks/groups. Verify the member sees the board but cannot edit or assign.
- Submit, cancel, approve, and reject completion; confirm auto-approval for an assigned
  Admin/Manager and denial of self-review.
- Change `?team=` to another team's ID as the Outsider and confirm no data is shown.
- Confirm My Task, Calendar, and the personal group board still behave as before.

## Project settings and known findings

- The hosted Supabase advisor currently reports leaked-password protection disabled. Enable it
  in the Supabase Auth password-security settings before production; it cannot be changed by a
  repository migration.
- The external `public.rls_auto_enable()` event-trigger function remains attached to DDL and
  still enables RLS, but direct `anon` and `authenticated` execution has been revoked by the
  Phase 8 migration.
- Advisor unused-index entries are informational while the new team tables have little or no
  production workload. Review them after real usage instead of dropping indexes blindly.
- Team tasks omit Contents/checklists per the user's product decision.
