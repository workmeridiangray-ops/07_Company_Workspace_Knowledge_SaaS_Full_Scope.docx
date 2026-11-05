import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/inter';
import './globals.css';
export const metadata: Metadata = { title: { default: 'Fieldnote - the workspace for documents, data and decisions', template: '%s | Fieldnote' }, description: 'One workspace for pages, databases, tasks, SOPs and meeting decisions - with permissions your team can trust.' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#F7F8FA' };
export default function Root({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body><a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">Skip to content</a>{children}</body></html>);
}
