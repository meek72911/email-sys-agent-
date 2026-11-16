import type { Metadata } from 'next';
import Link from 'next/link';
import { demoLoginEnabled } from '@/lib/demo';
import styles from './page.module.css';

const REPO = 'https://github.com/meek72911/email-sys-agent-';
const PORTFOLIO_NOTES = `${REPO}/blob/main/docs/PORTFOLIO.md`;
const HOSTED_NOTES = `${REPO}/blob/main/docs/HOSTED_VERIFICATION.md`;

export const metadata: Metadata = {
  title: 'Customer support with a paper trail',
  description:
    'Relay turns a customer request into a sourced draft and a reviewed ticket change. The model suggests, an operator decides, and the workspace keeps the record.',
  openGraph: {
    title: 'Relay — Customer support with a paper trail',
    description:
      'A customer operations workspace where AI drafts stay suggestions until an operator approves the exact reply and ticket change.',
    type: 'website',
    siteName: 'Relay',
  },
  twitter: {
    card: 'summary',
    title: 'Relay — Customer support with a paper trail',
    description:
      'A customer operations workspace where AI drafts stay suggestions until an operator approves the exact reply and ticket change.',
  },
};

const workflow = [
  {
    number: '01',
    title: 'Intake',
    body: 'A synthetic fixture, a manual request, or an imported Gmail message enters the workspace with its source attached.',
    detail: 'Source kinds stay visible on the case.',
  },
  {
    number: '02',
    title: 'Evidence',
    body: 'Relay searches the workspace’s own policy passages. Sources come back with their section and version.',
    detail: 'An issue without a source produces an investigation note, not a reply.',
  },
  {
    number: '03',
    title: 'Review',
    body: 'The operator edits the draft, approves the exact status change, and confirms the current knowledge revision.',
    detail: 'A stale draft or a changed ticket fails review.',
  },
  {
    number: '04',
    title: 'Record',
    body: 'Approved sandbox actions run against Relay’s Postgres. Activity records the draft, review, execution, or deletion.',
    detail: 'Queued work is never reported as a confirmed result.',
  },
];

const guardrails = [
  {
    label: 'Access',
    title: 'Role checks fail closed.',
    body: 'Viewer, operator and owner permissions are enforced in the database with row-level security. If the role lookup fails, editing controls are removed.',
  },
  {
    label: 'Evidence',
    title: 'Sources stay attached.',
    body: 'Analysis returns the policy title, section, version and source link. The customer’s claims remain labelled unverified.',
  },
  {
    label: 'Approval',
    title: 'Approvals are exact.',
    body: 'A proposed change records the from-status, the to-status and the knowledge revision it was reviewed against. Approve the exact change, not a general intent.',
  },
  {
    label: 'Execution',
    title: 'The sandbox is the boundary.',
    body: 'Ticket updates write to Relay’s own database. There is no production CRM connection and no send-email step.',
  },
  {
    label: 'Audit',
    title: 'The ledger is readable.',
    body: 'Draft saves, approvals, rejections, executions and deletions appear in Activity with an actor and a timestamp.',
  },
];

const limits = [
  {
    title: 'It does not send email.',
    body: 'An approved draft is copied into your mail client. Gmail access is read-only and disabled unless an owner completes the connection and access review.',
  },
  {
    title: 'It does not write to a production CRM.',
    body: 'The ticket sandbox is a local Postgres simulation. A separate sandbox adapter exists behind an opt-in flag for reconciliation testing.',
  },
  {
    title: 'It does not verify the customer.',
    body: 'Evidence links identify available workspace sources. They do not prove a claim, and they do not make an AI-generated sentence true.',
  },
];

function BrandMark() {
  return <span className={styles.mark} aria-hidden="true"><span /><span /></span>;
}

function ProductPreview() {
  return (
    <div className={styles.preview} role="img" aria-label="Preview of the Relay workspace showing a synthetic invoice and login request, an evidence passage, an approved reply draft, and a sandbox ticket change awaiting execution.">
      <div className={styles.previewBar}>
        <span className={styles.previewBrand}><BrandMark />Relay</span>
        <span className={styles.previewPath}>Inbox / Case review</span>
        <span className={styles.previewBadge}>Synthetic</span>
      </div>
      <div className={styles.previewBody}>
        <div className={styles.previewInbox}>
          <div className={styles.previewInboxHead}>
            <span>Inbox</span>
            <span className={styles.previewCount}>50</span>
          </div>
          <div className={`${styles.previewCase} ${styles.previewCaseActive}`}>
            <div><strong>Aarav Shah</strong><span>open</span></div>
            <p>Invoice amount and login trouble</p>
          </div>
          <div className={styles.previewCase}>
            <div><strong>Neha Rao</strong><span>open</span></div>
            <p>Report export issue</p>
          </div>
          <div className={styles.previewCase}>
            <div><strong>Alex Morgan</strong><span>pending</span></div>
            <p>Invoice question</p>
          </div>
          <div className={styles.previewCase}>
            <div><strong>Fatima Khan</strong><span>open</span></div>
            <p>Login help</p>
          </div>
        </div>
        <div className={styles.previewDetail}>
          <p className={styles.previewKicker}>Case review · Synthetic request</p>
          <p className={styles.previewSubject}>Invoice amount and login trouble</p>
          <p className={styles.previewMeta}>Aarav Shah · Ticket 4f2a91c8 · open</p>

          <div className={styles.previewSection}>
            <span className={styles.previewLabel}>Original message</span>
            <p>“Our invoice is ₹18,500, but our agreed price was ₹15,000. We also cannot log into the dashboard.”</p>
          </div>

          <div className={styles.previewEvidence}>
            <div><span>Evidence</span><span>Version 1</span></div>
            <strong>Billing adjustments · Verification</strong>
            <p>Compare the invoice with the signed agreement before correcting a price.</p>
          </div>

          <div className={styles.previewReview}>
            <div><span className={styles.previewLabel}>Reply draft</span><span className={styles.previewApproved}>Approved</span></div>
            <p>“I’m checking the invoice against your signed agreement and will confirm the correction before Friday.”</p>
            <span className={styles.previewButton}>Copy approved draft</span>
          </div>

          <div className={styles.previewAction}>
            <span>Sandbox ticket</span>
            <span className={styles.previewTransition}>open → pending</span>
            <span className={styles.previewPending}>Awaiting execution</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const demo = demoLoginEnabled();
  const primaryLabel = demo ? 'Open the synthetic demo' : 'Sign in to Relay';

  return (
    <main className={styles.page}>
      <a className="skip-link" href="#top">Skip to content</a>
      <header className={styles.nav}>
        <div className={styles.navInner}>
          <a className={styles.brand} href="#top" aria-label="Relay home"><BrandMark />Relay</a>
          <nav className={styles.navLinks} aria-label="Primary">
            <a href="#workflow">Workflow</a>
            <a href="#guardrails">Guardrails</a>
            <a href="#limits">Limits</a>
            <a href={REPO} target="_blank" rel="noreferrer">GitHub</a>
          </nav>
          <Link className="button button-small" href="/login">{demo ? 'Open demo' : 'Sign in'}</Link>
        </div>
      </header>

      <section className={styles.hero} id="top">
        <div className={styles.heroInner}>
          <div className={styles.heroText}>
            <p className={styles.notice}>
              <span className={styles.noticeMark} aria-hidden="true" />
              Portfolio build · synthetic data only
            </p>
            <h1>Customer support with a paper trail.</h1>
            <p className={styles.lead}>
              Relay turns a customer request into a sourced draft and a reviewed ticket change.
              The model can suggest. An operator decides. The workspace keeps the record.
            </p>
            <div className={styles.actions}>
              <Link className="button" href="/login">{primaryLabel}</Link>
              <a className="button secondary" href="#workflow">See the workflow</a>
            </div>
            <p className={styles.footnote}>
              No email is sent. The ticket sandbox is local.
              {demo ? ' The shared demo resets nightly.' : ''}
            </p>
          </div>
          <div className={styles.heroArt}>
            <ProductPreview />
          </div>
        </div>
      </section>

      <section className={styles.section} id="workflow">
        <div className={styles.wrap}>
          <div className={styles.sectionHead}>
            <p className={styles.kicker}>The workflow</p>
            <h2>From message to reviewed change.</h2>
          </div>
          <ol className={styles.steps}>
            {workflow.map(step => (
              <li key={step.number} className={styles.step}>
                <span className={styles.stepNumber}>{step.number}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
                <p className={styles.stepDetail}>{step.detail}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className={`${styles.section} ${styles.sectionTint}`} id="guardrails">
        <div className={`${styles.wrap} ${styles.split}`}>
          <div className={styles.splitHead}>
            <p className={styles.kicker}>Guardrails</p>
            <h2>The checks sit between the draft and the change.</h2>
            <p className={styles.splitNote}>
              These are enforced in the database, the server actions and the review flow,
              not added as a layer after the fact.
            </p>
          </div>
          <ul className={styles.guardrails}>
            {guardrails.map(item => (
              <li key={item.label}>
                <span className={styles.guardrailLabel}>{item.label}</span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={styles.section} id="limits">
        <div className={`${styles.wrap} ${styles.split}`}>
          <div className={styles.splitHead}>
            <p className={styles.kicker}>Limits</p>
            <h2>What Relay does not do.</h2>
            <p className={styles.splitNote}>
              The current build is deliberately narrow. The repository documents what is verified locally
              and what still needs a hosted check.
            </p>
          </div>
          <div className={styles.limits}>
            <ul>
              {limits.map(item => (
                <li key={item.title}>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </li>
              ))}
            </ul>
            <div className={styles.notes}>
              <p className={styles.notesLabel}>Build notes</p>
              <p>
                Schema and RLS checks, evaluation suites and the browser workflow are documented with
                the build. Hosted verification and live model calls are separate steps.
              </p>
              <div className={styles.notesLinks}>
                <a href={PORTFOLIO_NOTES} target="_blank" rel="noreferrer">Read the portfolio notes</a>
                <a href={HOSTED_NOTES} target="_blank" rel="noreferrer">Hosted verification</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className={styles.close}>
        <div className={styles.closeInner}>
          <div className={styles.closeCopy}>
            <p className={styles.kicker}>The demo</p>
            <h2>Open a synthetic case. Follow it to the record.</h2>
            <p>
              The shared workspace contains fifty synthetic requests.
              {demo ? ' Changes are visible to other visitors and reset nightly.' : ' Access is controlled by the server-side demo configuration.'}
            </p>
          </div>
          <div className={styles.closeActions}>
            <Link className="button" href="/login">{primaryLabel}</Link>
            <a className="button secondary" href={REPO} target="_blank" rel="noreferrer">View the repository</a>
          </div>
        </div>
        <div className={styles.legal}>
          <span>Relay · MIT licensed</span>
          <span>Next.js · Supabase · optional OpenAI</span>
          <span><a href={REPO} target="_blank" rel="noreferrer">GitHub</a></span>
        </div>
      </footer>
    </main>
  );
}
