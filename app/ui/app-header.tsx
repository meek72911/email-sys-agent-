import Link from 'next/link';
import { logout } from '@/app/login/actions';

const links = [
  { href: '/workspace', label: 'Inbox' },
  { href: '/knowledge', label: 'Knowledge' },
  { href: '/activity', label: 'Activity' },
  { href: '/connections', label: 'Connections' },
  { href: '/settings', label: 'Settings' },
];

export default function AppHeader({
  current,
  email,
  demo = false,
}: {
  current: string;
  email?: string | null;
  demo?: boolean;
}) {
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="app-header">
        <div className="app-header-inner">
          <Link href="/workspace" className="brand" aria-label="Relay workspace">
            <span className="brand-mark" aria-hidden="true"><span /><span /></span>
            Relay
          </Link>
          <nav className="app-nav" aria-label="Workspace">
            {links.map(link => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={current === link.href ? 'page' : undefined}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="app-account">
            {demo
              ? <span className="account-badge">Synthetic demo</span>
              : email
                ? <span className="account-email" title={email}>{email}</span>
                : null}
            <form action={logout}>
              <button type="submit" className="button-quiet">Sign out</button>
            </form>
          </div>
        </div>
      </header>
    </>
  );
}
