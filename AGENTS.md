<!-- BEGIN:nextjs-agent-rules -->


# AGENTS.md

## Project Overview

This project is a **Next.js + TypeScript + Supabase** task manager for personal and team-based task management.

Use a **feature-based architecture** with clear separation between UI, application logic, data access, validation, and data transfer.

Prefer simple, maintainable solutions. Do not overengineer.

## Project Structure

```text
src/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── register/
│   ├── (dashboard)/
│   │   ├── dashboard/
│   │   ├── tasks/
│   │   ├── projects/
│   │   ├── teams/
│   │   ├── calendar/
│   │   └── settings/
│   ├── api/                  # Only when custom API routes are needed
│   ├── auth/
│   │   └── callback/
│   ├── layout.tsx
│   └── page.tsx
│
├── features/
│   ├── tasks/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── dto/
│   │   ├── schemas/
│   │   └── types/
│   ├── projects/
│   ├── teams/
│   ├── comments/
│   ├── notifications/
│   └── auth/
│
├── components/
│   ├── ui/
│   ├── layout/
│   └── shared/
├── hooks/                    # Shared hooks only
├── lib/
│   └── supabase/
├── types/                    # Shared types and database types
└── utils/                    # Reusable utilities only
```

Apply the same feature structure to `projects`, `teams`, and other features when justified. Do not create empty folders just to match this example.

## Folder Responsibilities

### `app/`
Contains routes, pages, layouts, loading states, and error states. Keep pages focused on composing the UI and connecting it to the appropriate feature.

### `features/`
Contains feature-specific components, hooks, services, DTOs, validation schemas, and types. Keep related code together.

### `components/`
- `ui/`: Generic UI components.
- `layout/`: Sidebar, navbar, and layout components.
- `shared/`: Reusable application-level components.

### `lib/`
Contains infrastructure and external service configuration, including Supabase clients and helpers.

### `types/`
Contains shared types, including generated Supabase database types when appropriate. Keep feature-specific types inside their feature.

### `utils/`
Contains small, reusable utility functions. Do not use it as a dumping ground for business logic.

## DTO Rules

**DTOs are required when transferring structured feature data between layers or defining stable operation inputs and outputs.**

1. Place feature DTOs inside `features/<feature>/dto/`.
2. Use clear names such as `CreateTaskDto`, `UpdateTaskDto`, `TaskResponseDto`, and `TaskListResponseDto`.
3. Use DTOs to define the data accepted or returned by services and application operations.
4. Use separate DTOs for create, update, and response operations when their fields or requirements differ.
5. Do not expose sensitive database fields, internal metadata, or unnecessary Supabase records to the frontend.
6. Validate untrusted input with schemas, such as Zod, before performing database operations. Derive types from schemas when practical to avoid duplication.
7. Map Supabase query results to response DTOs when the database shape differs from the frontend contract.
8. Keep DTOs independent of React components and avoid putting database queries or business logic inside them.
9. Do not create DTOs for every trivial object. Use them where they improve consistency, validation, or layer separation.

Example:

```text
features/tasks/
├── dto/
│   ├── create-task.dto.ts
│   ├── update-task.dto.ts
│   └── task-response.dto.ts
├── schemas/
│   └── task.schema.ts
├── services/
│   └── task.service.ts
├── hooks/
│   └── use-tasks.ts
└── components/
```

## Frontend-to-Backend Data Flow

Follow this pattern where appropriate:

```text
UI Component
    ↓
Feature Hook / Form Handler
    ↓
Validation Schema
    ↓
Feature Service
    ↓
Supabase Client
    ↓
PostgreSQL Database
```

On the return path:

```text
PostgreSQL / Supabase
    ↓
Feature Service
    ↓
Response DTO / Data Mapping
    ↓
Feature Hook
    ↓
UI Component
```

Rules:

- Keep database queries out of UI components.
- Use feature services to centralize and reuse data-access operations.
- Use DTOs to standardize operation inputs and outputs.
- Keep validation schemas aligned with the relevant DTOs.
- Infer database types from Supabase-generated types where possible instead of manually duplicating database definitions.
- Do not assume TypeScript types validate runtime data.
- Use appropriate error handling and consistent error reporting.
- Never expose Supabase service-role keys or other secrets in client-side code.
- Enforce authorization with Supabase Row Level Security (RLS). Frontend checks alone are not security.
- Use server-side operations for privileged actions when needed; validate inputs and verify authorization there.

**Important:** DTOs are a data-contract convention, not a security boundary. They do not replace validation, authentication, or RLS.

## Supabase Rules

- Use Supabase for PostgreSQL, authentication, storage, and realtime features.
- Use the appropriate browser or server Supabase client.
- Keep authentication and authorization checks appropriate to the execution environment.
- Use database migrations for tracked schema changes.
- Keep generated database types synchronized with schema changes.
- Do not create a separate backend or custom `app/api/` route when a direct, secure Supabase operation is sufficient.
- Add custom API routes or server actions when they provide a real benefit, such as privileged operations, external integrations, or webhook handling.

## Core Development Rules

1. Prefer feature-based organization.
2. Keep related code close together.
3. Separate UI, data transfer, validation, and data access when useful.
4. Reuse existing components, DTOs, schemas, hooks, and services.
5. Keep shared code genuinely reusable.
6. Avoid unnecessary abstractions, duplicate types, and excessive files.
7. Preserve the existing architecture unless a change has a clear benefit.
8. Follow existing naming conventions and coding style.
9. Do not introduce Docker, Redis, Turborepo, or separate backend services unless required or explicitly requested.
10. Before finishing, check imports, types, validation, authorization, and affected functionality.

## Before Adding a File

- Route or page? → `app/`
- Feature-specific UI, logic, or data access? → `features/<feature>/`
- Structured feature data contract? → `features/<feature>/dto/`
- Runtime validation? → `features/<feature>/schemas/`
- Shared UI? → `components/`
- Shared hook? → `hooks/`
- Supabase or infrastructure? → `lib/`
- Shared or generated database types? → `types/`
- Reusable helper? → `utils/`

When uncertain, prefer the closest relevant feature folder and follow the existing project conventions.

<!-- END:nextjs-agent-rules -->
