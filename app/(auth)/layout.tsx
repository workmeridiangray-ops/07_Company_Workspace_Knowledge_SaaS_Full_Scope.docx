import { Logo } from '@/components/SiteShell';
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (<div className="flex min-h-screen flex-col items-center px-4 py-10"><Logo /><main id="main" className="mt-8 w-full max-w-md">{children}</main></div>);
}
