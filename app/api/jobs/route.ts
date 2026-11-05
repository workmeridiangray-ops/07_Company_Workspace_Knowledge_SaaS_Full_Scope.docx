import { processJobs } from '@/lib/svc/core';
import { runBillingLifecycle } from '@/lib/billing';
import { purgeOldVersions } from '@/lib/svc/lifecycle';
export const dynamic = 'force-dynamic';
/** Called by a scheduler (cron / platform scheduler) with the shared secret. Safe to call repeatedly. */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET; if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  return Response.json({ jobs: await processJobs(50), billing: runBillingLifecycle(), retention: purgeOldVersions() });
}
