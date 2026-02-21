# Den Control Plane

Control plane for hosted workers. Provides Better Auth, worker CRUD, and provisioning hooks.

## Quick start

```bash
pnpm install
cp .env.example .env
pnpm dev
```

## Environment

- `DATABASE_URL` PlanetScale connection URL (mysql format)
- `BETTER_AUTH_SECRET` 32+ char secret
- `BETTER_AUTH_URL` base URL for auth callbacks
- `PORT` server port
- `CORS_ORIGINS` comma-separated list
- `PROVISIONER_MODE` `stub` or `render`
- `WORKER_URL_TEMPLATE` template string with `{workerId}`

## Auth setup (Better Auth)

Generate Better Auth schema (Drizzle):

```bash
npx @better-auth/cli@latest generate --config src/auth.ts --output src/db/better-auth.schema.ts --yes
```

Apply migrations:

```bash
pnpm db:generate
pnpm db:migrate
```

## API

- `GET /health`
- `GET /api/auth/ok`
- `GET /v1/me`
- `POST /v1/workers`
- `GET /v1/workers/:id`
- `POST /v1/workers/:id/tokens`
