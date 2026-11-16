# Relay portfolio demo script

**Target length:** 4–6 minutes. **Resolution:** 1280×800 or 1440×900. **Audience:** hiring manager, product reviewer, or technical interviewer.

**Hard rule:** only demonstrate features that are verified in the environment you are recording. If the hosted project is not yet migrated, record the local synthetic demo and say so. Do not describe Gmail, Inngest, the external CRM, or live AI as working unless the specific check has passed.

## Pre-flight

- [ ] Hosted Supabase has passed `docs/HOSTED_VERIFICATION.md`.
- [ ] The shared demo account exists and the workspace has been reset.
- [ ] The synthetic-demo warning is visible.
- [ ] The browser has no devtools, bookmarks, or personal tabs visible.
- [ ] Notifications and password managers are disabled.
- [ ] The recording starts on `/` (the public overview), not on a pre-authenticated workspace tab.
- [ ] AI is either live-verified or explicitly skipped in the narration.

## Scene plan

| Time | On screen | Action | Narration / caption |
|---|---|---|---|
| 0:00–0:25 | Public overview (`/`) | Show the hero and the annotated product preview; point to “Portfolio build · synthetic data only”. | “Relay turns a customer request into a sourced draft and a reviewed ticket change. The model can suggest; an operator decides.” |
| 0:25–0:45 | Login page | Click “Open the synthetic demo”, then show the demo button and warning. | “This is a shared synthetic demo — no real customer data. Changes reset nightly.” |
| 0:45–1:05 | Workspace inbox | Point out the 50-case inbox, status chips, and synthetic-demo banner. | “Every request is queued for a human decision. Nothing is sent automatically.” |
| 1:05–1:35 | Case detail | Open “Invoice and login”. Show customer text, ticket status, draft, and audit area. | “Relay separates the customer’s claims from verified evidence. The customer message is untrusted input.” |
| 1:35–2:05 | Filter/search | Use the recent-request filter, then open “Search all requests”. | “Recent filtering is local; workspace search is paged and backed by an RLS-scoped database function.” |
| 2:05–2:45 | Draft review | Edit the draft, save it, approve it, and show the review state. | “The draft is saved first. Approval applies to the exact saved text and the current knowledge revision.” |
| 2:45–3:15 | Copy guard | Try to copy after changing the draft without saving. | “A stale or edited draft cannot be copied as approved. This prevents accidental export.” |
| 3:15–4:05 | Status workflow | Propose a status change, approve the exact change, execute it, and show the audit entry. | “The CRM here is a synthetic database workflow. The approver sees the exact from/to state; execution is idempotent.” |
| 4:05–4:35 | Activity | Open Activity and point out proposal, approval, execution, and failure labels. | “Every state transition leaves an audit trail. Queued is not the same as succeeded.” |
| 4:35–5:05 | Knowledge | Open Knowledge, search for a policy, show versioned evidence. | “Knowledge is workspace-scoped. Replacing a document invalidates older evidence.” |
| 5:05–5:25 | Wrap-up | Return to the inbox, then the public overview. | “Relay is deliberately narrow: review, evidence, approval, audit. Gmail, background workers, and live AI remain gated until verified.” |

## Optional AI segment (only if live-verified)

Add 30–45 seconds after the case-detail scene:

| Time | On screen | Action | Narration / caption |
|---|---|---|---|
| +0:00 | Case detail | Click “Analyze with OpenAI”. | “This is an explicit, quota-limited action. It sends the case message and retrieved policy text to the model.” |
| +0:15 | Analysis result | Show extracted issues, source quotes, evidence, and the “unverified customer statement” labels. | “The model extracts what the customer said; it does not verify claims. Quotes must match the message.” |
| +0:30 | Draft | Show the cited draft and the “human review required” wording. | “A draft is withheld when any issue lacks evidence. The reviewer still owns the decision.” |

If AI is not verified, say: “AI is an optional lab path in this build. The verified workflow is deterministic review and approval.”

## Captions / voiceover lines

Keep captions short and literal:

- “Synthetic demo — no real customer data.”
- “50 synthetic requests, one workspace.”
- “Customer text is untrusted input.”
- “Draft saved before review.”
- “Approval is tied to exact text and knowledge revision.”
- “Exact change approval, then execution.”
- “Audit trail: proposed, approved, executed.”
- “Search and knowledge are workspace-scoped.”
- “No email is sent by this demo.”

## What not to show or claim

- Do not show Gmail, Inngest, or the external CRM as live.
- Do not show a real mailbox, real customer name, or real invoice.
- Do not claim factual accuracy, refund authority, or autonomous sending.
- Do not claim the AI evaluation score measures real customer performance; it is a synthetic keyword baseline.
- Do not show `.env` files, keys, tokens, or the Supabase dashboard.

## Backup plan

If the hosted deployment is unavailable on recording day:

1. Record the local mock workflow with `npm run test:e2e:mock` and `RELAY_KEEP_TEST_SCREENSHOTS=1`.
2. State clearly: “This is the local synthetic build; hosted verification is pending.”
3. Keep the recording under three minutes and label it a prototype walkthrough, not a live product demo.

## Post-recording checklist

- [ ] No secrets, real data, or personal browser chrome visible.
- [ ] The synthetic warning appears at least once.
- [ ] Every claim matches a verified feature or is labeled as lab work.
- [ ] Captions are readable at 1080p.
- [ ] The video description links to the repo and `docs/HOSTED_VERIFICATION.md`.
