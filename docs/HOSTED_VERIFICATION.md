# Hosted verification checklist

**Status: pending.** This document is the release gate for the hosted Supabase demo. Do not mark Relay as hosted-verified until every check below has passed against the intended project.

## Current state (15 Nov 2026)

The hosted project still has only the migration-001 schema. A read-only REST probe found:

| Object | Result | Meaning |
|---|---|---|
| `organizations`, `memberships`, `cases` | `401` for anonymous requests | Tables exist but are protected |
| `create_relay_workspace` | `401` for anonymous requests | RPC exists but requires an authenticated session |
| `crm_actions`, `audit_events`, `knowledge_documents`, `analysis_usage`, `action_jobs`, `external_dispatches`, `gmail_credentials` | `404` | Later migrations are not applied |
| `relay_search_cases`, `relay_reserve_analysis`, `relay_delete_workspace` | `404` | Later RPCs are not applied |

The existing-project bundle is `supabase/hosted-existing-project.sql`. It is guarded and transactional; see its first 15 lines before running it.

## Preconditions

- The project contains only synthetic or disposable data. Migration 005 tops up existing workspaces to 50 cases.
- You have a database backup or can discard the project. Manual SQL does not update Supabase CLI migration history.
- `VERIFY_SUPABASE_URL` and `VERIFY_SUPABASE_ANON_KEY` are set in `.env.verify.local`.
- `VERIFY_SUPABASE_SERVICE_ROLE_KEY` is set locally in `.env.verify.local`. Never paste it into chat or commit it.
- The service role belongs to a disposable/demo project, not a production project.

## Step 1 — Apply the existing-project bundle

In the Supabase SQL Editor for the intended project:

1. Open `supabase/hosted-existing-project.sql`.
2. Confirm the guard statements at the top pass. They stop if migration 001 is missing or a later Relay migration is already present.
3. Run the whole file once. It is wrapped in `begin;` / `commit;`; any failure must roll back.
4. Do not run `supabase db push` or replay migration 001 afterward without reconciling the actual schema and migration history.

## Step 2 — Verify the hosted schema and RLS

From `relay-mvp/`:

```powershell
npm run verify:hosted -- --confirm
```

The harness creates temporary synthetic users and workspaces, then removes them. Expected checks:

- all 16 expected tables exist;
- three synthetic users can create isolated workspaces;
- each workspace receives exactly 50 fixtures;
- cross-organization case reads return no rows;
- cross-organization writes and RPC calls are denied;
- anonymous reads return no rows;
- an owner can save and approve a draft;
- exact-payload approval and sandbox execution succeed;
- audit events are recorded;
- knowledge write and full-text search work;
- the latest `action_jobs.failure_code` and `external_dispatches.sync_state` columns exist;
- a viewer can read but cannot propose a change.

Do not treat a successful local PGlite run as a substitute. This script must pass against the hosted project.

## Step 3 — Record evidence

Append a dated evidence section below with:

- date and project reference (not keys);
- the command run;
- the pass count and check names;
- any warnings from cleanup;
- a note that only synthetic records were used;
- screenshots of the hosted workspace after the schema is applied.

Do not include the service-role key, publishable key, or raw row contents.

## Step 4 — Verify the hosted demo workflow

After the schema passes, verify the actual browser flow against the hosted URL:

1. Sign in with a test user or the shared demo account.
2. Create/open a workspace and confirm 50 synthetic cases.
3. Open a case and save/approve a draft.
4. Propose a status change, approve it, execute it, and confirm the audit entry.
5. Search all requests and knowledge.
6. Confirm the synthetic-demo warning is visible.
7. Confirm no real customer data is present.

## Failure handling

- If the bundle fails, do not retry blindly. The transaction should have rolled back; inspect the reported statement and the actual schema.
- If verification fails, capture the failing check name and sanitized error message, fix forward in a new migration/bundle, and rerun against a disposable project.
- If the service key is exposed, revoke/rotate it before continuing.

## Related documents

- `RUNBOOK.md` — hosted setup, rollback, demo reset.
- `CONNECTIONS.md` — release gates and disabled integrations.
- `docs/DEMO_SCRIPT.md` — what to show after verification.
- `docs/PORTFOLIO.md` — portfolio summary and verified evidence.
