# Fieldnote - Company Workspace and Knowledge SaaS

Multi-tenant workspace: pages with a block editor, linked databases with table/board/calendar/list views, tasks/projects/goals, controlled SOPs with acknowledgements, meetings and decisions, templates, forms, automations, webhooks/API, sharing with guests, search, version recovery, billing in INR, and a platform super-admin. Built from `docs/07_Company_Workspace_Knowledge_SaaS_Full_Scope.docx`; see [docs/SPEC_COVERAGE.md](docs/SPEC_COVERAGE.md) for exactly what is and is not covered and [docs/SCREEN_REGISTER.md](docs/SCREEN_REGISTER.md) for all 100 routes.

Stack: Next.js 15 (App Router, server actions), React 19, Tailwind, Node 22 built-in SQLite. No external services are required to run it.

## Run locally with demo data
```bash
npm install
npm run demo        # http://localhost:3000
```
Demo logins (password `demo-pass-2026`): `priya@brightstudio.test` (owner), `arjun@…` (admin), `meera@…` (manager), `sam@…` (member), `client@acme.test` (guest), all `@brightstudio.test` except the guest; platform staff `ops@fieldnote.test` (owner), `support@fieldnote.test`, `billing@fieldnote.test`. A second business, Northgate Consulting, shows tenant isolation.

## Deploy
```bash
docker build -t fieldnote .
docker run -p 3000:3000 -v fieldnote-data:/data --env-file .env fieldnote
```
Copy `.env.example` to `.env` and set at least `APP_URL`, `PLATFORM_OWNER_EMAIL/PASSWORD` and `RESEND_API_KEY`. Health check: `GET /api/health`. **Back up the `/data` volume** (SQLite file + WAL); test a restore before launch. Put it behind HTTPS; session cookies are `Secure` in production.

## Test
```bash
npm run typecheck && npm test        # 27 integration tests: isolation, access, billing, conflicts, SOPs, imports…
npm run build && npm run demo        # then, with the server running:
PORT=3000 npm run e2e                # every screen for every role + real browser flows
PORT=3000 npm run a11y               # axe WCAG 2.x A/AA scan
```

## Before taking real customers
Integrate a real payment provider (currently simulated), configure email, have the policy pages reviewed, and decide your backup/scale plan - details in `docs/SPEC_COVERAGE.md`.
