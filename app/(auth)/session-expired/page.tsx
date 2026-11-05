import Link from 'next/link';
import { Alert } from '@/components/ui';
export default function Expired() { return (<div className="card p-6"><h1 className="text-xl font-semibold">Session ended</h1><div className="mt-3"><Alert tone="warn">Your session expired or was signed out from another device. Your work was saved.</Alert></div><p className="mt-4"><Link className="btn-primary" href="/login">Sign in again</Link></p></div>); }
