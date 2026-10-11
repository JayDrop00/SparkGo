# Team Collaboration Recon

## Phase 0 status

Repository inspection is complete. No application code or migrations were changed. The hosted Auth setting and live PostgreSQL version are confirmed. Supabase CLI 2.120.0 is now installed as a project dev dependency, and a linked read-only query succeeded. The local Docker daemon is unavailable, so local Supabase stack-based migration iteration and database tests remain unavailable. The linked project is `jnyxceecdlhialzfznsw` (SparkGo).

## Verified existing names and behavior

| Prompt reference | Verified repository state |
|---|---|
| Personal tables | `public.tasks` and `public.task_groups`; both are owner-scoped with RLS. `public.task_content_blocks` was created in `20261009120545_task_board_schema.sql` and dropped in `20261010100000_task_completion_and_contents_removal.sql`. |
| Task difficulty | `public.task_difficulty`: `EASY`, `MEDIUM`, `HARD`, `VERY_HARD`. TypeScript names are `Difficulty` and `DIFFICULTY_VALUES` in `src/features/tasks/schemas/task.schema.ts`. |
| Personal task columns | `task_name`, `description`, `difficulty`, `due_date`, `deadline_at`, `start_at`, `end_at`, `group_id`, `position`, `completed_at`, timestamps. `due_date` mirrors `end_at`; standalone deadlines use `deadline_at`. |
| Personal group columns | `group_name`, `color`, `position`, timestamps. Both task and group order use `double precision` `position`; ordering allocates gaps of 1024 and drag moves use neighbor IDs/fractional positions. |
| Group name limit | `GROUP_NAME_MAX = 60` in `src/features/grouped-personal-task/schemas/group.schema.ts`; the table check is 1–60 characters. |
| Personal task limits | `TASK_NAME_MAX = 120`; `DESCRIPTION_MAX = 2000`; the schema enum values are uppercase. |
| Personal completion | `tasks.completed_at` is nullable and directly toggled; completed tasks may be reopened in the current personal feature. Team completion must remain a separate state machine. |
| Contents representation | There is no current Contents DTO/schema/table. The old representation was a separate ordered `task_content_blocks` table with enum `content_block_type` values `CHECKBOX`, `LIST_ITEM`, `NOTE`, and fields `text`, nullable `is_checked`, and `position`; that feature and type were dropped. Per the user's decision, team tasks will have no Contents field or checklist. |
| Team task assignment flow | Per the user's decision, an Admin or Manager creates a team task and can assign it to existing members of that team, including themselves. Database validation must ensure every selected assignee is an existing member of the same team. |
| Board contracts and hook | `TaskResponseDto`, `GroupResponseDto`, `BoardResponseDto`; personal optimistic board hook is `useBoard(initialBoard)` in `src/features/grouped-personal-task/hooks/use-board.ts`, with a `pending` flag and resync. |
| Group delete semantics | `delete_group(p_group_id, p_task_action)` accepts `ungroup` or `delete`; ungrouping preserves tasks, deleting removes group tasks. |
| Drag-and-drop | `@dnd-kit/core` and `@dnd-kit/sortable` are installed. Existing board code contains collision and sortable behavior; preserve it. The prefixes `task:`, `group:`, and `bucket:` are confirmed in the existing board implementation. |
| Colors | `SWATCHES` is a private constant in `src/features/grouped-personal-task/components/GroupHeader.tsx`; it is not currently exported. |
| Supabase clients and auth | Browser/server clients are in `src/lib/supabase/{client,server}.ts` and use the publishable key. `src/features/auth/services/session.service.ts` verifies claims with `getClaims()`. `src/proxy.ts` uses `getSession()` only for redirect/session refresh; the app layout calls the verified claims helper. Team server actions must follow the prompt's `getUser()` rule. |
| Profiles / teammate display | No `profiles` table, profile migration, display-name field, or avatar field was found in tracked migrations or `src/`. The app shell currently displays the email claim. |
| Existing routes | Sidebar hrefs are `/teams` and `/team-tasks`; matching pages exist under `src/app/(app)/` and currently render “coming soon” empty states. Dashboard also exists but has no dashboard data/widgets yet. |
| UI kit | Existing reusable components include `Button`, `Dialog`, `DropdownMenu`, `EmptyState`, `Icon`, `Input`, and `Badge`; focus/input classes are in `src/components/ui/styles.ts`. No restyling is needed for this feature. |
| Action result | Current shared type is `{ ok: true; data } | { ok: false; error: { code, message, fieldErrors? } }` in `src/types/action-result.ts`; this differs from the prompt's proposed top-level `code` shape and needs a deliberate additive/adaptation decision. |
| Existing migration workflow | Imperative SQL migrations only: four files under `supabase/migrations/`; `supabase/schemas/` is absent and `schema_paths` is empty. No `supabase/tests/database/` directory or database test script is present. |
| Existing dependencies | `next`, React, TypeScript, Zod, `@supabase/ssr`, `@supabase/supabase-js`, dnd-kit, and Supabase CLI 2.120.0 are installed. The prompt's feature tree appears implementable without further npm packages; pgTAP availability still needs verification in a running database. |

## Supabase and Auth checks

- `supabase/config.toml` sets local `db.major_version = 17` and `[auth.email].enable_confirmations = false`. This means local email confirmation is not required. Per S21, this is a blocker for invite acceptance if the local setting is used for the feature.
- The hosted project’s “Confirm email” setting is enabled, confirmed by the user-provided Supabase Dashboard screenshot (Authentication → Sign In / Providers → User Signups). Hosted invites therefore meet S21’s email-confirmation requirement.
- The linked `select version();` query returned PostgreSQL 17.11 on x86_64-pc-linux-gnu, compiled by gcc (GCC) 15.2.0, 64-bit. This satisfies the prompt's requirement to verify the server major version before using PG-specific features. `supabase/.temp/postgres-version` contains the consistent value `17.11.0.003`.
- Supabase CLI 2.120.0 is installed as a dev dependency. `npx supabase db query --linked "select version();"` succeeded. CLI version and `db query` / `migration list` help were checked. CLI commands required elevated execution in this environment because telemetry writes outside the workspace; local commands still require a running Docker daemon.
- Current Supabase changelog review found a planned change effective 2026-10-30: new public tables will no longer be automatically exposed through the Data API. Explicitly verify Data API exposure settings and grants for new tables before deployment. Relevant current docs also confirm RLS and grants are separate controls, and recommend keeping `SECURITY DEFINER` functions out of exposed schemas.

## Conflicts and implementation risks

1. **Public `SECURITY DEFINER` RPCs:** the prompt requires every mutation RPC to live in `public` and be `SECURITY DEFINER`. The Supabase skill warns that public-schema definer functions are callable through the exposed API by default, and recommends keeping genuinely privileged definer helpers in a non-exposed schema with explicit auth checks and execute grants. To follow the skill's security mechanics while retaining the requested PostgREST RPC names, use public `SECURITY INVOKER` RPC wrappers that call narrowly granted, fully qualified private `SECURITY DEFINER` helpers. Every helper must verify `auth.uid()` and authorization before changing state. Document this adaptation in the phase report.
2. **Contents feature was removed:** resolved by the user: team tasks have no Contents field or checklist for v1.
3. **Email confirmation:** the hosted "Confirm email" setting is enabled, satisfying the invite requirement there. Local config has confirmations disabled; align it if local invite testing must mirror hosted behavior.
4. **Owner deletion invariant:** the reference schema uses `teams.owner_id ... ON DELETE RESTRICT`, while the owner is also an `auth.users` row. Account deletion is declared out of scope, so confirm the project's account deletion behavior before rollout; otherwise the restriction can prevent deleting an owner account.
5. **Data contract mismatch:** the prompt's `ActionResult` shape differs from the current shared result type. Prefer adapting team actions to current conventions or introducing a team-specific compatible shape without breaking personal actions.
6. **Task scheduling names:** the team reference uses `due_at`, while personal tasks distinguish `deadline_at` from scheduled `start_at`/`end_at` and `due_date`. Define how team-task due dates map to these semantics before schema/API design.
7. **Version and test gates:** live PostgreSQL 17.11 and linked CLI connectivity are verified. Local Docker is still needed for local database testing; pgTAP availability and project advisors/lint should be checked during the relevant implementation phase.
8. **Auth helper behavior:** the prompt requires `supabase.auth.getUser()` at the start of server actions; current server-side app gating uses `getClaims()`. Team actions can use `getUser()` without changing personal flows or the existing proxy redirect check.

## Proposed file tree

Use this as the planned shape, adjusting names only to fit verified local conventions. Do not create empty directories. Each database phase (1, 2, 4, 5, 6, 7, and any phase with schema changes) gets one additive migration following the Supabase skill's imperative migration workflow.

```text
src/features/teams/
  actions/ team.actions.ts, invite.actions.ts, tag.actions.ts
  components/ TeamSwitcher, CreateTeamDialog, InvitationsBanner, MembersTable,
              InviteMemberDialog, ChangeRoleDialog, ConfirmDangerDialog,
              TagsPanel, EditMemberTagsDialog, TeamSettingsPanel
  dto/ team-response.dto.ts, member-response.dto.ts, invite-response.dto.ts,
       tag-response.dto.ts
  hooks/ use-team.ts
  schemas/ team.schema.ts, invite.schema.ts, tag.schema.ts
  constants.ts, permissions.ts
src/features/team-tasks/
  actions/, components/, dto/, hooks/, schemas/
src/features/dashboard/
  actions/, components/, dto/, queries/
src/lib/debug.ts
src/lib/supabase/map-error.ts
supabase/migrations/                 # one additive migration per schema phase
supabase/tests/database/             # pgTAP once test tooling is verified
docs/team-collab/RECON.md
docs/team-collab/DEBUGGING.md        # hardening phase
```

## Dependency needs

Supabase CLI 2.120.0 is now present as a dev dependency. No further npm dependency is currently justified: Zod, Supabase clients, React/Next, UI primitives, and dnd-kit already exist. Verify pgTAP support and database test commands before the first migration.

## Open questions / later phases

1. The user approved Phase 1; approval is no longer pending.
2. Team-task Contents is out of scope per the user's decision; assignment includes existing members and the creating Admin/Manager.
3. Hosted Auth "Confirm email" is on; local `enable_confirmations` remains off.
4. Confirm team task due-date semantics (`due_at` versus schedule end and deadline`) before Phase 5.
5. Account deletion for users who own teams remains out of scope; the schema uses `ON DELETE RESTRICT`.
6. Local database tests require starting Docker/local Supabase. Hosted read-only CLI connectivity is verified.

## Phase 0 report

- Done: Inspected repository structure, package manifest, Supabase config/migrations, task/group schema, DTOs, hooks, auth helpers, UI kit, routes/sidebar, and profiles presence; documented verified names, conflicts, risks, proposed tree, and dependency needs.
- Files changed: `docs/team-collab/RECON.md` only.
- Migrations: None.
- Security checklist: S21 -> hosted “Confirm email” is enabled (user-provided dashboard screenshot); local `enable_confirmations = false` remains a local-development mismatch. Other S1–S22 items are recorded as implementation requirements for their phases, not claimed as implemented or tested.
- Verification: linked `select version();` succeeded through Supabase CLI · type-check not run · lint not run · build not run · DB tests/advisors not run (Phase 0 is recon only; local Docker is unavailable).
- Personal features regression check: Not run; no application behavior changed.
- Assumptions made: Existing migrations represent the repo's intended personal schema; the reported PostgreSQL 17.11 result is the linked project's live version. Team tasks omit Contents and may be assigned to the creating Admin/Manager as well as other current team members.
- Open questions / blockers for later phases: Local email confirmations are disabled and should be aligned with hosted settings if local invite testing needs verified-email behavior. Team due-date semantics must be decided before Phase 5. Account deletion is out of scope and team ownership uses `ON DELETE RESTRICT`. At the time of this Phase 0 report, Phase 1 awaited approval.

## Phase 1 report

- Done: Added the core team schema and RLS, private authorization helpers, secured core RPCs, owner/member invariants, activity logging, profile signup/backfill support, owner team limit, and TypeScript role/limit/database types. Added a 41-assertion pgTAP suite for isolation, grants, role boundaries, teammate profile visibility, team creation limits, and ownership transitions.
- Files changed: `supabase/migrations/20261011013027_team_collaboration_core.sql`, `supabase/tests/database/team_core.test.sql`, `src/features/teams/constants.ts`, `src/types/database.types.ts`, and this report.
- Migrations: `20261011013027_team_collaboration_core.sql` was applied to the linked hosted database on 2026-10-11 after a dry-run confirmed it was pending.
- Security checklist: S1, S2, S5, S6, S7, S9, S10, S11, S13, S17, S20, S22 -> implemented in migration and covered by the new database suite; tests/advisors still need to run locally. Auth signup trigger is a trusted trigger that receives no end-user JWT and uses only `NEW.id` to create a blank profile.
- Verification: type-check ✔ · lint ✔ · build ✔ · remote pgTAP assertions 41/41 ✔ (executed in a rollback-only SQL transaction through `db query --linked`; the normal CLI test runner still tries to start Docker) · linked `db lint` reported only the two unused parameters in the intentionally temporary `private.cleanup_member_state` helper · linked advisors reported external/pre-existing findings and two missing FK indexes that are scheduled for fix-forward.
- Personal features regression check: Build passed; no personal feature source files were changed.
- Assumptions made: Public RPC entry points are `SECURITY INVOKER` wrappers around private, authenticated-only `SECURITY DEFINER` implementations, following the Supabase security guidance while preserving RPC names. `cleanup_member_state` is an internal no-op until completion tables arrive in Phase 6. Profile rows start blank; profile editing is not part of Phase 1.
- Open questions / blockers: `supabase test db --linked` still invokes Docker, so use the remote SQL-query method for pgTAP when Docker remains unavailable. Advisors report a pre-existing externally exposed `public.rls_auto_enable()` SECURITY DEFINER function and disabled leaked-password protection; inspect/resolve those before production hardening. Missing `teams.owner_id` and `team_activity_log.actor_id` FK indexes will be added in a later fix-forward migration. The no-op `cleanup_member_state` helper will be implemented when completion tables arrive in Phase 6.

## Phase 2 report

- Done: Added the in-app invitation schema, RLS, role-limited create/respond/revoke RPCs, verified-email acceptance, hourly/team caps, invite activity logging, and a narrowly scoped RPC for creators to view their own pending invite emails. Added pgTAP coverage for role restrictions, duplicate invitations, direct-write and email-column denial, email matching/confirmation, expiry, accept/decline, and revoke ownership.
- Files changed: `supabase/migrations/20261011020800_team_invites.sql`, `supabase/tests/database/team_invites.test.sql`, `src/types/database.types.ts`, and this report.
- Migrations: `20261011020800_team_invites.sql` was applied to the linked hosted database on 2026-10-11 after Phase 1.
- Security checklist: S1, S2, S5, S6, S7, S9, S10, S11, S12, S17, S19, S20, S21, S22 -> RLS/grants/RPC implementation exercised by 20 remote pgTAP assertions in a rollback-only transaction.
- Verification: type-check ✔ · lint ✔ · build ✔ · remote pgTAP assertions 20/20 ✔ · linked `db lint` reported no invite-specific schema errors · linked advisors reported an `auth_rls_initplan` warning for the invite RLS policy, to be corrected with `(select auth.jwt())` in a fix-forward migration.
- Personal features regression check: Build passed; no personal feature source files were changed.
- Assumptions made: To satisfy S22 without conditional column grants, direct reads exclude the invite email column; `list_my_team_invites` returns email only for pending invites created by the authenticated Admin/Manager. Expired pending invitations are moved to `revoked` only when a replacement invite for that same team/email is created, because the partial unique index otherwise blocks reinviting that address.
- Open questions / blockers: Supabase's bundled `test db --linked` command requires Docker despite the linked target; remote pgTAP was run through `db query --file` after temporarily enabling `pgtap` in `extensions`, then the extension was removed. The phase-specific invite policy warning and missing team FK indexes need fix-forward. The hosted project received these additive migrations at the user's direction. The safe invite-list RPC is ready for the My Team UI; invitees use direct RLS reads for banner fields.

## Phase 3 report

- Done: Implemented the My Team workspace, team switcher, creation, member role/removal controls, invitations, settings, rename RPC, and shared safe-error/debug helpers. Added the missing foreign-key indexes and corrected the invite RLS auth init-plan warning.
- Files changed: `src/app/(app)/teams/page.tsx`, `src/features/teams/**`, `src/lib/debug.ts`, `src/lib/supabase/map-error.ts`, `src/types/database.types.ts`, `supabase/migrations/20261011024558_team_ui_support.sql`, `supabase/tests/database/team_ui_support.test.sql`, and this report.
- Migrations: `20261011024558_team_ui_support.sql` was applied to the linked hosted project on 2026-10-11.
- Security checklist: S1, S2, S5, S6, S9, S10, S11, S12, S17, S19, S20, S22 -> private definer implementation/public invoker wrapper, membership checks, explicit grants, role checks, output DTO mapping, and rename authorization/validation assertions. App-facing controls mirror the DB rules.
- Verification: type-check ✓ · lint ✓ · build ✓ · remote pgTAP assertions executed in rollback-only transaction (rename allow/trim/validation/manager-denial; final returned assertion `ok 4`) · linked `db lint` had previously reported only the pre-existing temporary `private.cleanup_member_state` unused parameters. The hosted pgTAP extension was removed after the tests; functions were schema-qualified because query execution did not retain the transaction-local `search_path` as expected.
- Personal features regression check: Type-check, lint, and production build pass; no personal feature source was edited.
- Assumptions made: Team emails remain visible only for the invite creator's own pending invites per S22. Team task contents/checklists remain excluded by the user's product decision.
- Open questions / blockers: Manual two-user browser QA for Flows A/B/C/G needs authenticated browser accounts and was not run by the CLI. `supabase test db --linked` starts Docker, so all DB checks continue through remote `db query --file`; no local Docker/Supabase is to be started. Review the external `public.rls_auto_enable()` advisor finding and disabled leaked-password protection before production hardening.

## Current handoff

- Completed through: Phase 3 (Core, Invites, and My Team UI); Phases 1–3 migrations are applied to linked hosted Supabase.
- Next: Phase 4 — Tags: add same-team tags/member-tag assignments, RLS, safe UI controls, tests proving tags never grant access, then continue to Phase 5 team tasks.
- Problems to carry forward: The hosted advisor still reports external `public.rls_auto_enable()` SECURITY DEFINER execution and Auth leaked-password protection disabled; both require project-owner review before production hardening. `private.cleanup_member_state` has two temporary unused-parameter lint warnings until Phase 6. Manual browser QA remains pending. Local Docker is intentionally unused.

## Phase 4 report

- Done: Added team tags and same-team member tag assignments, role-based RLS, tag/member assignment limits, an atomic `set_member_tags` RPC, tag CRUD/assignment actions, DTO/schema contracts, and the Tags tab. Tags only label members and do not affect role or permissions.
- Files changed: `supabase/migrations/20261011031000_team_tags.sql`, `supabase/tests/database/team_tags.test.sql`, `src/types/database.types.ts`, `src/features/teams/{actions,components,dto,schemas,services,permissions.ts}`, and this report.
- Migrations: `20261011031000_team_tags.sql` was applied to linked hosted Supabase on 2026-10-11.
- Security checklist: S1, S2, S5, S6, S7, S9, S10, S11, S12, S17, S20, S22 -> RLS role policies, composite same-team foreign keys, tag-count triggers, max-five assignment validation, and Member denial assertions. The test confirms a member's assigned labels leave their database role as `member`.
- Verification: type-check ✓ · lint ✓ · build ✓ · remote rollback-only pgTAP suite reached expected assertion `ok 5` · migration list confirms P1–P4 all applied. `db advisors` still reports the known external `public.rls_auto_enable()` SECURITY DEFINER and leaked-password protection findings; it also shows informational unused indexes while the new tables are still unused. `db lint` could not be rerun after the temporary pgTAP extension was removed because the CLI direct database login failed password authentication; no local/Docker fallback was attempted.
- Personal features regression check: Type-check, lint, and production build all pass; personal task/calendar source remains untouched.
- Assumptions made: Authorized team admins/managers may create/delete tags and replace a member's labels; existing members may read labels. Assignment is an atomic RPC, while tag creation/deletion is RLS-guarded direct data access.
- Open questions / blockers: Manual multi-user browser QA remains pending. `db lint` needs valid linked DB password credentials for its direct PostgreSQL connection. The hosted advisor findings must be reviewed before production. Temporary `pgtap` extension was removed after tests.

## Current handoff

-- Completed through: Phase 5 (Core, Invites, My Team UI, Tags, and Team Task board); migrations P1–P5 are applied remotely.
-- Next: Phase 6 — Completion requests and review: enforce the pending_review/done/todo state machine, auto-approval for assigned Admins/Managers, Member request/cancel, Admin/Manager review queue, cleanup of pending requests when a member leaves, and invariant tests.
-- Problems to carry forward: Do not start local Supabase or Docker. The hosted pgTAP workaround is `db query --linked --file` inside a rollback-only test script; remove any temporary test extension afterward. Manual browser QA needs real Admin/Manager/Member sessions. `db lint` currently fails direct DB password authentication; advisor findings include external `public.rls_auto_enable()` access and disabled leaked-password protection. Phase 6 must resolve the Phase 1 no-op `cleanup_member_state` warning.

## Phase 5 report

- Done: Added team groups, tasks, task assignees, manager-only task/group writes, same-team group/assignee constraints, server-derived `created_by`, assignment and group deletion RPCs, and the Team Task route/board. The create form allows assigning a task to the creator or any existing member and reports assignment failures with a retry path. Contents/checklists are excluded per the user's choice.
- Files changed: `supabase/migrations/20261011040000_team_tasks.sql`, `supabase/migrations/20261011041000_team_task_insert_id_grant.sql`, `supabase/tests/database/team_tasks.test.sql`, `src/types/database.types.ts`, `src/app/(app)/team-tasks/page.tsx`, and `src/features/team-tasks/**`.
- Migrations: Both Phase 5 migrations were applied to linked hosted Supabase on 2026-10-11. The first apply attempt failed because the status enum was missing; the pending migration was corrected before application. A later test found the fixed-ID fixture lacked an insert grant; because P5 was already applied, the id-column grant was added in the second fix-forward migration.
- Security checklist: S1, S2, S5, S6, S7, S9, S10, S11, S12, S17, S20, S22 -> manager-only RLS, protected status/creator columns, same-team composite foreign keys, atomic assignee replacement with row locking and role/status checks, and 7 remote assertions including Member direct status-write denial and cross-team group/assignee rejection.
- Verification: type-check ✓ · lint ✓ · build ✓ · remote rollback-only pgTAP 7/7 ✓ · linked migration history lists both P5 migrations applied. `pgtap` was removed after the test. Full advisor/linter gate remains limited by the missing direct DB password for `db lint`.
- Personal features regression check: Type-check, lint, and full production build pass; personal My Task and Calendar source were not edited.
- Assumptions made: Team due dates use `due_at timestamptz` as in the prompt's team schema, while personal task schedule fields retain their existing meaning. Group/task ordering copies the verified personal `position double precision` ordering. The UI currently provides create, assign, delete, and group ungroup/delete; drag-and-drop reorder and edit controls are not yet implemented.
- Open questions / blockers: Manual browser QA still needs signed-in Admin/Manager/Member accounts. Task edit/reorder controls remain to be completed or explicitly called out in final QA. Hosted `db lint` direct connection fails password authentication; keep using remote only and do not start Docker.

## Current handoff

- Completed through: Phase 7 (Dashboard); P1–P7 migrations and the P7 fix-forward are applied remotely.
- Next: Phase 8 — Hardening: address task edit/reorder gaps, add DEBUGGING.md and README guidance, run final advisors/tests/manual QA, and document T10 two-session concurrency check.
- Problems to carry forward: Do not start local Supabase or Docker. Remote rollback-only pgTAP suites pass via `db query --file`; pgTAP was removed afterward. `db lint` still needs valid direct DB password access. Manual Admin/Manager/Member/Outsider browser QA and T10 concurrency remain outstanding. Review external `public.rls_auto_enable()` exposure and Auth leaked-password protection before production.

## Phase 6 report

- Done: Added completion request storage and RLS, unique pending-request protection, Member submit/cancel actions, Admin/Manager review/approve/reject actions, self-review denial, auto-approval for assigned Admin/Manager completions, task/request status invariants through locked RPC transitions, and real cleanup when a member is removed or leaves. Added a review queue and completion controls to Team Task.
- Files changed: `supabase/migrations/20261011050000_team_completion.sql`, `supabase/tests/database/team_completion.test.sql`, `src/types/database.types.ts`, `src/lib/supabase/map-error.ts`, `src/features/team-tasks/{actions,components,dto,schemas,services}`, and this report.
- Migrations: `20261011050000_team_completion.sql` applied to linked hosted Supabase on 2026-10-11. It replaces the Phase 1 no-op cleanup helper.
- Security checklist: S1, S2, S5, S7, S9, S10, S11, S12, S16, S17, S19, S20, S22 -> RLS and read-only grants; RPCs derive task/team from locked rows, verify role and assignee, protect terminal states and self-review, and log IDs only. Test covers the request state transitions, auto-approval, second review, and removal cleanup.
- Verification: type-check ✓ · lint ✓ · build ✓ · remote rollback-only pgTAP 22/22 ✓ · temporary pgTAP extension removed after run. `db lint` remains unavailable with current direct DB password authentication.
- Personal features regression check: type-check, lint, and full production build pass; personal flows' source is unchanged.
- Assumptions made: An Admin/Manager's own completion is recorded as an approved request with `auto_approved=true`; `completed_by` is the assignee who requested/completed the task. Member removal resets their pending tasks before cascading assignments.
- Open questions / blockers: The test runner cannot coordinate two simultaneous sessions, so the S11/T10 concurrent-review race still needs a manual two-session check. Signed-in browser QA remains pending. Task edit/reorder controls also remain outstanding from Phase 5.

## Current handoff

- Completed through: Phase 7 (Dashboard); migrations P1–P7 plus `20261011061000_dashboard_up_next_fix.sql` are applied to linked hosted Supabase.
- Next: Phase 8 — final hardening and project handoff; fix the outstanding Phase 5 edit/reorder controls, add debugging/README guidance, and complete final checks.
- Problems to carry forward: No local Supabase or Docker. Use remote rollback-only SQL tests and remove temporary pgTAP after each run. `db lint` needs valid direct DB credentials. Manual browser QA and T10 two-session concurrency remain open. External `public.rls_auto_enable()` advisor finding and disabled Auth leaked-password protection remain for production owner review.

## Phase 7 report

- Done: Added scoped dashboard stats, upcoming tasks, group progress, Monday–Sunday due colors, completion trend, spark points/streak, manager workload, and recent activity functions and widgets. Added IANA timezone validation and browser timezone cookie handling. Team scope filters every team metric to tasks assigned to the caller. Added local-day boundary and role checks.
- Files changed: `supabase/migrations/20261011060000_team_dashboard.sql`, `supabase/migrations/20261011061000_dashboard_up_next_fix.sql`, `supabase/tests/database/team_dashboard.test.sql`, `src/types/database.types.ts`, `src/features/dashboard/**`, `src/app/(app)/dashboard/page.tsx`, and this report.
- Migrations: Both P7 migrations were applied to hosted Supabase on 2026-10-11. Initial runtime tests caught a UNION ordering problem; the up-next function was corrected in a separate additive migration.
- Security checklist: S1, S2, S5, S6, S9, S12, S16, S17, S20, S22 -> authenticated-only security-invoker read functions, validation, RLS-based row access, assigned-task filtering, manager-only workload/activity, and no email/note fields in activity output.
- Verification: type-check ✓ · lint ✓ · build ✓ · remote rollback-only pgTAP 18/18 ✓, including Manila 00:30 vs UTC boundary, invalid scope/timezone, Monday week, points/streak, assigned-only metrics, and Member workload denial · remote migration history confirms P1–P7 applied. Advisors still report the external `public.rls_auto_enable()` grant and disabled leaked-password protection; unused-index findings are informational on the new low-usage schema. `db lint` cannot connect with current CLI DB password credentials.
- Personal features regression check: Full production build, type-check, and lint pass; personal task/calendar source was not changed. Dashboard reads personal tasks through existing RLS.
- Assumptions made: Personal dashboard due time uses `coalesce(deadline_at, due_date)`; team due time uses `due_at`. Spark difficulty weights are defined once in `private.task_spark_points` and mirrored in `SPARK_POINTS`.
- Open questions / blockers: Dashboard workload/activity currently select the first Admin/Manager team rather than providing a team picker; manual browser QA remains. The dashboard quick-add widget from the prompt's layout list is not implemented. T10 concurrent reviewers need two sessions. Phase 5 task edit/reorder is still missing.

## Current handoff

- Completed through: Phase 7 (Core, Invites, My Team, Tags, Team Task, Completion, Dashboard); P1–P7 and the P7 fix-forward are live on the linked hosted project.
- Next: Phase 8 — hardening and handoff. Complete task edit/reorder and dashboard multi-team/quick-add gaps, add `docs/team-collab/DEBUGGING.md` and README notes, rerun security checks, and document/run manual browser plus concurrent-review checks where accounts permit.
- Problems to carry forward: Keep local Docker/Supabase unused. pgTAP is temporarily enabled only during SQL checks and must be dropped afterward. `db lint` direct connection failed due missing/invalid CLI database password; linked advisor checks remain available. External advisor findings require project owner review. No real authenticated browser profiles were available for manual QA.

## Phase 8 report

- Done: Completed the remaining task edit/reorder controls, dashboard team selection and quick-add links, final security hardening, remote regression suites, and project handoff documentation. Team task Contents/checklists remain excluded by the user's decision.
- Files changed: `supabase/migrations/20261011070000_team_collab_hardening.sql`, `supabase/migrations/20261011071000_team_collab_fk_indexes.sql`, `supabase/tests/database/team_hardening.test.sql`, `src/features/team-tasks/**`, `src/features/dashboard/**`, `README.md`, `docs/team-collab/DEBUGGING.md`, and this report. The feature migrations, database tests, and shared generated types are listed in the earlier phase reports.
- Migrations: Both Phase 8 migrations were applied to the linked hosted Supabase project on 2026-10-11. The first revokes direct `anon`/`authenticated` execution of the external `public.rls_auto_enable()` event-trigger function while preserving the trigger; the second adds the remaining team-schema foreign-key indexes. No local Supabase or Docker was used.
- Security checklist: The Phase 8 hardening pgTAP suite passed 4/4, including direct-execute denial and continued RLS auto-enable behavior. Hosted advisors no longer report public execution of `rls_auto_enable()` or missing team foreign-key indexes. The remaining warning is disabled Auth leaked-password protection; enable it in the hosted Supabase Auth password-security settings before production. Low-usage unused-index findings are informational.
- Verification: All eight remote rollback-only pgTAP suites passed, 121/121 assertions total; the temporary `pgtap` extension was dropped afterward. Type-check, lint, and production build passed after feature implementation. The last `db lint --linked` attempt could not complete because the CLI was denied writing `C:\Users\Arvvir\.supabase\telemetry.json.tmp...` outside the workspace; therefore there is no confirmed schema-lint result after the final index migration. `migration list --linked` also encountered a direct CLI database-login password error after successful `db push` output. Treat the successful linked migration push results as the apply evidence, and verify the ledger when CLI credentials allow.
- Personal features regression check: Type-check, lint, and production build pass; dashboard reads personal tasks through existing RLS. Manual browser checks of My Task and Calendar remain outstanding.
- Assumptions made: Task ordering uses the existing fractional-position model and up/down controls. Hosted project remains the current development database, and every migration/test in this phase targeted that linked project as explicitly authorized.
- Open questions / blockers: Enable Auth leaked-password protection in the Supabase Dashboard. Manual QA still needs separate Admin, Manager, Member, and Outsider sessions. The T10 concurrent-review race check still needs two SQL sessions against a safe test team. No Docker/local database workflow should be introduced.

## Current handoff

- Completed through: Phase 8; implementation phases 0–8 are complete. All team-collaboration migrations through `20261011071000_team_collab_fk_indexes.sql` were applied to the linked hosted project.
- Next: Enable hosted Auth leaked-password protection, then perform the four-role browser QA and T10 two-session review check described in `DEBUGGING.md`. If the CLI environment permits its required telemetry write and direct database login, rerun `npx supabase db lint --linked` and `npx supabase migration list --linked` to confirm final schema lint and migration ledger.
- Problems to carry forward: The Supabase CLI's final lint attempt was blocked by workspace sandbox permissions when writing under `C:\Users\Arvvir\.supabase`; one migration-list attempt failed direct database password authentication. All remote tests and migrations completed, and the pgTAP extension was removed. The Auth leaked-password advisor warning and manual QA/concurrency checks remain open. Continue using the hosted linked project only; do not start Docker or local Supabase.
