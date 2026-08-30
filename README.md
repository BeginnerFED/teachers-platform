# teachers-platform

A subscription platform for English teachers. The customer is the teacher: the product exists to
give them back the hours they currently spend preparing lessons, building activities and marking
homework.

## Workspace

| Path              | What it is                                                      |
| ----------------- | --------------------------------------------------------------- |
| `apps/web`        | Next.js 16 app — teacher, student and admin interfaces          |
| `apps/api`        | Hono API — all business logic and every write goes through here |
| `packages/shared` | Types and constants used by both sides                          |

The database (Supabase) is not wired up yet.

## Getting started

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
pnpm dev
```

Web runs on `http://localhost:3000`, the API on `http://localhost:3001`.

## Scripts

| Command           | Effect                   |
| ----------------- | ------------------------ |
| `pnpm dev`        | Run web and API together |
| `pnpm dev:web`    | Web only                 |
| `pnpm dev:api`    | API only                 |
| `pnpm build`      | Build everything         |
| `pnpm type-check` | Type-check every package |
| `pnpm lint`       | Lint                     |
| `pnpm format`     | Format with Prettier     |

## Conventions

The web app never writes to Supabase directly — it calls the API, which owns the business logic.
Supabase provides Postgres, auth, storage and realtime; row level security stays on as a second
line of defence rather than the only one. `apps/web/src/lib/api.ts` holds a typed client generated
from the API's own route types, so a renamed endpoint fails the build instead of failing in
production.
