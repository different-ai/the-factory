# Non-Stub End-to-End Proof

This directory captures proof that the full flow works with a real (non-stub) worker provisioner.

## Web app flow (sign-up -> authenticated dashboard -> create worker)

Screenshots:

- `webapp/01-web-signup-form.png`
- `webapp/02-web-signup-success.png`
- `webapp/03-web-worker-created-render.png`

Key proof in `webapp/03-web-worker-created-render.png`:

- `status: 201` for `POST /v1/workers`
- `instance.provider: "render"`
- `instance.status: "healthy"`
- a real Render worker URL is returned

## API/CLI flow (including bearer token auth)

Machine-readable report:

- `report.json`

This report includes:

- sign-up response with `token` (used as API key / bearer token)
- `GET /v1/me` via cookie session (`status: 200`)
- `GET /v1/me` via bearer token (`status: 200`)
- cloud worker creation (`status: 201`, `provider: render`)
- worker health check against returned worker URL (`status: 200`)

## OpenWork instance health proof

- `07-web-worker-health.json`

This is the health payload from the worker created in the web flow.
