const { chromium } = require('playwright');
const B = 'http://localhost:' + (process.env.PORT || 3100);
(async () => {
  const br = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] } : {}); const bad = [];
  async function run(email, paths, label) {
    const ctx = await br.newContext(); const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push('JS ' + e.message)); 
    await p.goto(B + '/login'); await p.fill('#email', email); await p.fill('#password', 'demo-pass-2026'); await p.click('button[type=submit]'); await p.waitForURL(/workspaces/, { timeout: 15000 }).catch(() => {});
    if (!/workspaces/.test(p.url())) { bad.push(`${label}: login failed at ${p.url()}`); return null; }
    for (const path of paths) { const r = await p.goto(B + path, { waitUntil: 'domcontentloaded' }); const st = r.status(); const t = (await p.textContent('body')).slice(0, 4000);
      if (st >= 500 || /Application error|Internal Server Error|Something went wrong/.test(t)) bad.push(`${label} ${path} -> ${st} ${t.slice(0, 120)}`); }
    errs.forEach(e => bad.push(label + ' ' + e)); return p;
  }
  const ctx0 = await br.newContext(); const p0 = await ctx0.newPage(); await p0.goto(B + '/login'); await p0.fill('#email', 'priya@brightstudio.test'); await p0.fill('#password', 'demo-pass-2026'); await p0.click('button[type=submit]'); await p0.waitForURL(/workspaces/);
  await p0.goto(B + '/workspaces'); const href = await p0.getAttribute('a[href^="/w/bright"]', 'href'); const slug = href.split('/')[2]; console.log('slug', slug);
  const ids = await p0.evaluate(() => 0);
  const W = `/w/${slug}`; const pub = ['/', '/features', '/solutions', '/solutions/agencies', '/pricing', '/add-ons', '/demo', '/contact', '/help', '/help/billing', '/updates', '/legal/privacy', '/signup', '/login', '/recover', '/denied'];
  for (const u of pub) { const r = await p0.goto(B + u); if (r.status() >= 500) bad.push('public ' + u + ' ' + r.status()); }
  const owner = ['', '/welcome', '/search?q=acme', '/inbox', '/teamspaces', '/pages', '/files', '/trash', '/databases', '/tasks', '/tasks?view=board', '/tasks?view=calendar', '/projects', '/goals', '/knowledge', '/knowledge?tab=drafts', '/meetings', '/templates', '/templates/new', '/forms', '/forms/new', '/automations', '/automations/new', '/integrations', '/integrations?tab=connections', '/integrations?tab=webhooks', '/integrations?tab=keys', '/integrations?tab=activity', '/admin/members', '/admin/roles', '/admin/sharing', '/admin/billing', '/admin/billing?plan=plan_business', '/admin/usage', '/admin/audit', '/admin/export', '/admin/settings', '/admin/support'].map(x => W + x).concat(['/account/profile', '/account/security', '/account/sessions', '/account/notifications', '/workspaces']);
  const p = await run('priya@brightstudio.test', owner, 'owner');
  // follow links to dynamic pages
  if (p) { const seen = new Set(); for (const sel of ['/pages', '/databases', '/projects', '/knowledge', '/meetings', '/templates', '/forms', '/automations', '/teamspaces']) { await p.goto(B + W + sel); const links = await p.$$eval(`a[href^="${W}${sel}/"]`, as => as.map(a => a.getAttribute('href'))); for (const l of [...new Set(links)].slice(0, 4)) { if (l.endsWith('/new')) continue; const r = await p.goto(B + l); const t = (await p.textContent('body')).slice(0, 3000); if (r.status() >= 500 || /Application error|Internal Server Error/.test(t)) bad.push('dyn ' + l + ' ' + r.status()); seen.add(l);
      if (sel === '/databases') { for (const sub of ['/schema', '/import', '/duplicates']) { const rr = await p.goto(B + l + sub); if (rr.status() >= 500) bad.push('dyn ' + l + sub); } } if (sel === '/pages') { const rr = await p.goto(B + l + '/history'); if (rr.status() >= 500) bad.push('dyn ' + l + '/history'); } } }
    console.log('dynamic pages visited', seen.size); const rec = await p.$$eval('a[href*="/records/"]', as => as.map(a => a.getAttribute('href'))); }
  for (const [em, role] of [['arjun@brightstudio.test', 'admin'], ['meera@brightstudio.test', 'manager'], ['sam@brightstudio.test', 'member'], ['client@acme.test', 'guest']]) await run(em, [W, W + '/pages', W + '/databases', W + '/tasks', W + '/knowledge', W + '/search?q=acme', W + '/admin/members', W + '/admin/billing'], role);
  await run('ops@fieldnote.test', ['/platform', '/platform/businesses', '/platform/plans', '/platform/billing', '/platform/billing?status=paid', '/platform/support', '/platform/ops', '/platform/staff', '/platform/audit', '/platform/settings'], 'platform');
  console.log(bad.length ? 'PROBLEMS:\n' + bad.join('\n') : 'ALL OK'); await br.close();
})();
