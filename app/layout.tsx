import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Relay — Customer support with a paper trail',
    template: '%s · Relay',
  },
  description:
    'Relay is a customer operations workspace. AI drafts stay suggestions until an operator approves the exact reply and ticket change.',
  applicationName: 'Relay',
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#f4f1e9',
  colorScheme: 'light',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
