# Relay — portfolio case study

## One-line summary

Relay is a synthetic customer-operations workspace that turns an inbound request into an evidence-backed draft, an explicit approval, an idempotent ticket action, and an audit record — with no autonomous sending.

**Repo:** https://github.com/meek72911/email-sys-agent-  
**License:** MIT  
**Demo:** pending hosted verification; see `docs/HOSTED_VERIFICATION.md`.

## The problem

Customer-support demos often jump from “inbound message” to “AI replied” and hide the risky middle: untrusted customer text, unverified claims, stale knowledge, unclear approval state, and duplicate side effects.

Relay makes that middle visible:

- the customer message is untrusted data;
- extracted claims are labeled unverified;
- drafts are withheld when evidence is missing;
- approval applies to exact text and the current knowledge revision;
- status changes require an explicit from/to approval;
- execution is idempotent and audited;
- nothing is emailed.

## What is implemented

| Layer | Implementation |
|---|---|
| UI | Next.js 16 App Router, public overview, server-rendered workspace, inbox, case detail, knowledge, activity, connections, settings |
| Auth | Supabase email/password sessions; optional server-only shared demo login |
| Data | Supabase Postgres with RLS and `SECURITY DEFINER` RPC boundaries; 25 migrations |
| Workflow | Draft save/review, exact-payload status approval, idempotent execution, bounded job failure codes |
| Knowledge | Owner-only text/PDF ingestion, full-text search, versioning, replacement, deletion |
| AI (optional) | OpenAI extraction and cited draft generation, per-workspace and global daily quotas, source-quote validation |
| Background (lab) | Disabled Inngest worker and loopback synthetic CRM with reconciliation receipts |
| Gmail (lab) | Disabled read-only OAuth/import path; no send capability |
| Verification | PGlite RLS/workflow suite, migration bundle checks, mock Playwright E2E, keyword baseline, retrieval eval |

## Architecture in one picture

```text
Browser
  → Next.js server actions / RSC
    → Supabase Auth + Postgres (RLS + RPC)
    → optional OpenAI (explicit, quota-limited)
    → disabled Inngest worker → loopback synthetic CRM
    → disabled Gmail MCP (read-only)
```

See `RUNBOOK.md` for the full data-flow and trust boundaries.

## Verified evidence

Local checks that passed on 14–16 Nov 2026:

| Check | Result |
|---|---|
| `npm test` | 34 files, 111 tests passed |
| `npm run test:db` | 25 migrations applied; RLS, roles, quotas, approvals, retries, Gmail lifecycle, deletion checks passed |
| `npm run test:bundle` | Existing-project and fresh-project bundles passed local checks |
| `npm run lint` | Exit 0 |
| `npm run build` | Exit 0 |
| `npm run test:e2e:mock` | Sign-in, search, draft, rejection, proposal, approval, execution, audit, intake, deletion, knowledge, mobile overflow passed |
| `npm run eval:baseline` | 47/50 exact issue categories; 11/12 multi-issue exact |
| `npm run eval:retrieval` | 46/46 cases include all labeled evidence in the top three results |
| `npm audit --omit=dev --audit-level=high` | 5 moderate, no high/critical |

These are local, synthetic checks. They do not prove hosted Supabase, live OpenAI, Gmail, Inngest, or Vercel behavior.

## What is deliberately not live

- **No email sending.** Gmail is read-only and disabled; no compose/send scope.
- **No real CRM.** The “CRM” is a synthetic database ticket status plus an optional loopback SQLite sandbox.
- **No live AI claim.** The provider path is implemented but requires a server-side key and a capped live evaluation.
- **No public deployment yet.** Hosted Supabase is still at migration 001; the existing-project bundle is ready but not applied.
- **No shared demo until reset is scheduled.** The demo account is shared and must be reset nightly.

## Evaluation honesty

The 47/50 baseline is a deterministic keyword classifier over 50 author-written synthetic fixtures. It does not measure live-model accuracy, factual support, injection resistance, or customer outcomes. The retrieval score uses oracle categories. See `fixtures/README.md`.

## Next milestones

1. Apply `supabase/hosted-existing-project.sql` and run `npm run verify:hosted -- --confirm`.
2. Deploy to Vercel and verify the hosted workflow.
3. Run one live AI smoke case and a capped `--max-cases 5` evaluation.
4. Schedule the shared demo reset (`.github/workflows/demo-reset.yml`).
5. Record the captioned walkthrough using `docs/DEMO_SCRIPT.md`.

## Why this is portfolio-worthy

The interesting engineering is not the model call. It is the boundary: RLS-scoped reads, exact-payload approvals, revision-aware drafts, idempotent execution, bounded failure reasons, and a visible audit trail. Relay is a small system that takes reviewability seriously.
