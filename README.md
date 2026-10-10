This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## MyTask board (Task Input → Grouped Task)

Flow: the user fills the **task form** (`TaskFormDialog`), the task is saved through a
server action, and it lives inside at most one **group** (Monday.com-style board column,
e.g. "This Week", "In Review", "Backlog") — or in the built-in **Ungrouped** bucket when
`group_id` is `NULL`. Groups are *personal* containers, not teams (teams are a separate,
future feature).

- Route: `/tasks` (sidebar → Personal → My Task), rendered by the shared `(app)` shell
  (top bar + sidebar).
- Layout: `GroupBoard` renders groups + Ungrouped; tasks move between/within groups with
  drag & drop (`@dnd-kit`, keyboard-accessible) using **optimistic UI with rollback**.
- Data flow: server component (`getBoard`) → `GroupBoard` client state → Server Actions
  (`features/*/actions`) → Zod validation → services → Supabase (RLS per user). Every
  successful action calls `revalidatePath("/tasks")`.
- Transactional writes go through Postgres RPCs (supabase-js has no multi-statement
  transactions): `create_task_with_blocks`, `update_task_with_blocks`, `move_task`,
  `reorder_groups`, `delete_group`. Positions use fractional `double precision` indexing
  with automatic bucket rebalancing; a per-owner advisory lock serializes reorders.
- Deleting a group always asks: move tasks to Ungrouped, or delete them too. Tasks are
  never deleted silently.

### Running the migrations

Migrations live in `supabase/migrations/` (schema + functions) and `supabase/seed.sql`
(3 sample groups with mixed tasks).

```bash
npx supabase login                      # or set SUPABASE_ACCESS_TOKEN
npx supabase link --project-ref <your-project-ref>   # ref = part of NEXT_PUBLIC_SUPABASE_URL
npx supabase db push                    # needs SUPABASE_DB_PASSWORD / --password
npx supabase db advisors                # optional security/perf review
npx supabase migration list             # verify applied migrations
```

No CLI access? Paste the two migration files into the Supabase Dashboard SQL editor in
timestamp order, then backfill with `npx supabase db pull`.

Seed data (local: `npx supabase db reset`; remote: run `supabase/seed.sql` manually in
the SQL editor — `db push` does not apply seeds).

### Regenerating TypeScript types

```bash
npm run db:types    # supabase gen types typescript --project-id <ref> --schema public
                    # > src/types/database.types.ts
```

Run this after any schema change. The generated `Database` type is wired into both the
browser and server Supabase clients (`src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`).

### Verify

```bash
npm run lint
npm run build
```
