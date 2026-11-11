# Relay MVP (in progress)

Relay is a customer-operations project. The hosted MVP is incomplete and must not be deployed or used with real customer data. The old local prototype is in the parent directory.

## Local setup

Use Node.js 22.13 or later for the app and the separate local sandbox. Copy `.env.example` to `.env.local`, and add the Supabase project URL and publishable key. Create a test user in Supabase Auth. Do not commit `.env.local` or share secret keys. Run `npm install`, `npm run dev`, and sign in.

## Database

The first migration was applied to the project during development. The subsequent migrations add synthetic knowledge and a database-only review workflow. They have not been applied to hosted Supabase; local PGlite tests exercise the migrations. Review and validate them against disposable data before applying. A generated transaction bundle for the specific existing-project state is in `supabase/hosted-existing-project.sql`; see `RUNBOOK.md` before use. `npm run db:bundle` regenerates it and `npm run test:bundle` checks it locally. The implementation does not yet meet the PRD release gates; see `CONNECTIONS.md` and `RUNBOOK.md`.

## Status

- Supabase login: manually verified with one user. Cross-organization isolation and roles need full tests.
- Synthetic inbox: 50 labeled fixtures and an idempotent seed migration are prepared. Migration behavior is checked in a local PGlite database, but the new migration is not applied to Supabase.
- Search: the inbox filters recent requests; workspace-wide search is paged and respects RLS. The pending migration must be installed and verified on hosted Supabase.
- Manual intake: owners and operators can add a labeled request (up to 200 per workspace); owners can delete individual manual and imported requests or the entire workspace. This is locally tested, requires pending migration 020 and has not been verified on hosted Supabase. Do not use real customer data until release checks pass.
- Draft and sandbox approval: implemented and tested locally; the hosted migrations and end-to-end path still need verification.
- Knowledge: full-text search and text/PDF extraction code are present. Upload accepts text-based PDFs and UTF-8 text up to 2 MB; original files are not retained. Migrations and the evidence-revision guard are locally tested using PGlite but have not been applied to hosted Supabase; OCR and original-file retention are not implemented; owner-only document replacement, versioning and deletion are implemented in locally tested pending migrations.
- OpenAI: authenticated extraction action, per-workspace quota, source-quote checks and evidence search are implemented. An evidence-linked draft can be generated when every issue has at least one retrieved passage; users must verify its content. The provider path has not been verified with a real key, and the quota migrations are not applied.
- Gmail MCP: read-only adapter and destination guard are prepared and tested with a synthetic MCP server. PKCE and encrypted credential-lifecycle helpers are prepared and locally tested; disabled-by-default owner OAuth and disconnect routes are implemented. Owner selection authorization and a plain-text import flow are implemented but disabled pending access review, verified retention and hosted integration tests.
- A disabled Inngest queued worker and local sandbox REST/MCP layer are implemented; hosted provider wiring, hosted testing and deployment remain outstanding. A provisional scoped Zod override resolves the previously reported high-severity version finding, and a synthetic local Inngest execution passed; hosted worker compatibility remains unverified; see `CONNECTIONS.md`. A 50-case keyword baseline and a guarded live-extraction evaluation runner exist, but live-model evaluation and full end-to-end and security tests remain outstanding.

## Local verification

Run `npm test`, `npm run test:db`, `npm run eval:baseline`, `npm run eval:retrieval`, `npm run lint`, and `npm run build`. The database check applies migrations to a disposable PGlite PostgreSQL-compatible database with simulated Supabase roles; it is not a test of the hosted Supabase instance, browser E2E, or production security. See `fixtures/README.md` for evaluation scope and limits.

An independent loopback-only synthetic CRM with SQLite receipts is available in `sandbox-crm/`; see its README. Local HTTP tests exercise response loss and receipt recovery. A disabled worker path connects Relay actions to this service; hosted operation has not been verified.

Workspace settings include owner-only deletion of Relay workspace data. Deletion is deliberately blocked when separate sandbox CRM dispatch records exist, because coordinated external cleanup is not implemented. The authentication account is retained. The deletion migration has only been tested in disposable PGlite, not on hosted Supabase.

The Activity screen shows the latest workspace audit events, including queued, failed and succeeded labels. Case-related events and jobs are hidden when an imported Gmail case expires; scheduled cleanup still requires the disabled worker. It is backed by organization-scoped RLS; Knowledge uploads, replacements and deletions are recorded without document text; AI completion audit coverage is not complete. PDF ingestion rejects files with blank or image-only pages instead of silently dropping those pages.
A local browser smoke test is available with `npm run test:e2e:mock`. It starts a temporary Next.js development process and an in-memory Supabase-shaped test double, uses synthetic credentials and data, and exercises sign-in, search, draft save, review, approval, sandbox execution, activity, and mobile overflow. Install a Playwright browser with `npx playwright install chromium`, or set `BROWSER_EXECUTABLE` to an existing Chromium-based browser. This is a mock integration test; it does not validate real Supabase authentication/RLS, Inngest, OpenAI, or hosted deployment. Set `RELAY_KEEP_TEST_SCREENSHOTS=1` to keep its synthetic screenshots in a temporary folder.

## Automated checks

The GitHub Actions workflow runs lint, unit tests, disposable PGlite migration tests, a production build, and a browser smoke test against a synthetic backend. A separate production dependency audit fails on high or critical advisories; the current dependency audit reports moderate findings and no high findings, with the provisional override described in `CONNECTIONS.md`. These checks require no live credentials and do not prove hosted Supabase, OpenAI, Gmail or worker behavior. The workflow is local until the repository is pushed.
