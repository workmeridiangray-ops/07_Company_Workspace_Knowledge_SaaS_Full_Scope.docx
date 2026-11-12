const { chromium } = require('playwright'); const axe = require('fs').readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8'); const B = 'http://localhost:' + (process.env.PORT || 3100); const S = '/w/bright-studio';
(async () => {
  const br = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] } : {}); const p = await (await br.newContext()).newPage(); const out = {};
  const check = async u => { await p.goto(B + u); await p.evaluate(axe); const r = await p.evaluate(async () => await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'] })); for (const v of r.violations) { const k = `${v.id} (${v.impact}): ${v.help}`; (out[k] ||= new Set()).add(u + ' x' + v.nodes.length + ' e.g. ' + v.nodes[0].target.join(' ').slice(0, 70)); } };
  for (const u of ['/', '/pricing', '/features', '/help', '/signup', '/login', '/demo']) await check(u);
  await p.goto(B + '/login'); await p.fill('#email', 'priya@brightstudio.test'); await p.fill('#password', 'demo-pass-2026'); await p.click('button[type=submit]'); await p.waitForURL(/workspaces/);
  for (const u of ['/workspaces', S, S + '/pages', S + '/tasks', S + '/databases', S + '/knowledge', S + '/meetings', S + '/admin/members', S + '/admin/billing', S + '/admin/roles', S + '/search?q=acme', S + '/inbox', S + '/integrations']) await check(u);
  await p.goto(B + S + '/databases'); const dl = await p.getAttribute('a[href*="/databases/db_"]', 'href'); for (const u of [dl, dl + '/schema']) await check(u);
  await p.goto(B + S + '/pages'); const pl = await p.getAttribute('ul.card a[href*="/pages/pg_"]', 'href'); await check(pl);
  for (const [k, v] of Object.entries(out)) console.log(k, '\n   ', [...v].slice(0, 4).join('\n    ')); if (!Object.keys(out).length) console.log('NO VIOLATIONS'); await br.close();
})();
