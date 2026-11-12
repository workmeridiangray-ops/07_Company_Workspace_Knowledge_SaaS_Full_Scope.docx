export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { db } = await import('./lib/db'); db();
  const { ensurePlatformOwner, seedDemo } = await import('./lib/demo-seed');
  ensurePlatformOwner(); if (process.env.SEED_DEMO === '1') seedDemo();
  // In-process scheduler so single-container deployments need no external cron. Safe to run alongside POST /api/jobs.
  if (process.env.DISABLE_SCHEDULER !== '1') {
    const { processJobs } = await import('./lib/svc/core'); const { runBillingLifecycle } = await import('./lib/billing'); const { purgeOldVersions } = await import('./lib/svc/lifecycle');
    setInterval(() => { processJobs(25).catch(() => {}); }, 30_000).unref?.();
    setInterval(() => { try { runBillingLifecycle(); purgeOldVersions(); } catch (e) { console.error('[maintenance]', e); } }, 3_600_000).unref?.();
  }
}
