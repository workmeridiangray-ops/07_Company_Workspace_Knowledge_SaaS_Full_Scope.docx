const { chromium } = require('playwright'); const B = 'http://localhost:' + (process.env.PORT || 3100); const fails = []; const ok = (c, m) => { if (!c) fails.push(m); console.log(c ? 'ok  ' : 'FAIL', m); };
(async () => {
  const br = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] } : {}); const ctx = await br.newContext(); const p = await ctx.newPage(); const em = `e2e${Date.now()}@test.example`;
  await p.goto(B + '/signup'); await p.fill('#name', 'Eve Tester'); await p.fill('#email', em); await p.fill('#company', 'Eve Labs'); await p.fill('#password', 'long-password-77'); await p.check('input[name=terms]'); await p.click('button:has-text("Create workspace")');
  await p.waitForURL(/welcome/, { timeout: 20000 }).catch(() => {}); ok(/\/w\/eve-labs\/welcome/.test(p.url()), 'sign-up lands on welcome checklist: ' + p.url());
  const slug = 'eve-labs'; await p.goto(`${B}/w/${slug}/pages`); ok((await p.textContent('body')).includes('Start here'), 'sample page present');
  await p.fill('#np-title', 'My first page'); await p.click('button:has-text("Create page")'); await p.waitForURL(/\/pages\/pg_/, { timeout: 15000 }); ok(true, 'page created');
  const first = p.locator('textarea[aria-label]').first(); await first.click(); await p.keyboard.type('Hello world'); await p.keyboard.press('Enter'); await p.keyboard.type('# Big heading'); 
  await p.getByText('Saved', { exact: true }).waitFor({ timeout: 10000 }); await p.waitForTimeout(1500); await p.getByText('Saved', { exact: true }).waitFor(); ok(true, 'autosave shows Saved');
  await p.reload(); ok((await p.textContent('body')).includes('Hello world'), 'content persisted after reload'); ok(await p.locator('text=Big heading').count() > 0, 'second block persisted');
  // conflict: modify in a second tab, then edit first tab
  const p2 = await ctx.newPage(); await p2.goto(p.url()); await p2.locator('textarea[aria-label]').first().click(); await p2.keyboard.type(' (tab2)'); await p2.waitForTimeout(2500); 
  await p.locator('textarea[aria-label]').first().click(); await p.keyboard.type(' (tab1)'); await p.waitForSelector('text=Edit conflict', { timeout: 10000 }).then(() => ok(true, 'edit conflict detected and surfaced')).catch(() => ok(false, 'edit conflict detected'));
  // database record
  await p.goto(`${B}/w/${slug}/databases`); await p.click('a:has-text("Clients")'); await p.waitForURL(/databases\/db_/); await p.fill('#p_name', 'Zeta Corp'); await p.click('button:has-text("Add record")'); await p.waitForSelector('text=Record added', { timeout: 8000 }).then(() => ok(true, 'record added')).catch(() => ok(false, 'record added'));
  await p.reload(); ok(await p.locator('text=Zeta Corp').count() > 0, 'record visible in table');
  await p.fill('input[name=fval]', 'zeta'); await p.selectOption('select[name=fprop]', { index: 1 }); await p.click('button:has-text("Apply")'); ok(/fprop/.test(p.url()), 'temporary filter applied via URL');
  // validation
  await p.goto(`${B}/w/${slug}/tasks`); await p.click('summary:has-text("Add a task")'); await p.click('button:has-text("Add task")'); ok((await p.evaluate(() => document.activeElement && document.activeElement.id)) === 'nt', 'empty task title blocked with focus on field');
  await p.fill('#nt', 'E2E task'); await p.click('button:has-text("Add task")'); await p.waitForSelector('text=Task added').then(() => ok(true, 'task added')).catch(() => ok(false, 'task added'));
  // public form
  await p.goto(`${B}/w/${slug}/forms/new`); await p.fill('#fn', 'Public intake'); await p.check('input[name=public]'); await p.click('button:has-text("Save form")'); await p.waitForURL(/forms\/fm_/, { timeout: 10000 }).catch(() => {});
  const link = await p.locator('code', { hasText: '/f/' }).first().textContent().catch(() => null); ok(!!link, 'form link shown: ' + link);
  if (link) { const anon = await (await br.newContext()).newPage(); await anon.goto(B + link.trim()); await anon.fill('input[id^=f_]', 'Anonymous Inc'); await anon.click('button:has-text("Submit")'); await anon.waitForSelector('text=Thank you').then(() => ok(true, 'anonymous public submit works')).catch(() => ok(false, 'anonymous public submit works')); }
  // isolation: other tenant url
  await p.goto(`${B}/w/bright-studio`); ok(/denied/.test(p.url()), 'other tenant workspace is denied: ' + p.url());
  // 2FA setup page
  await p.goto(`${B}/account/security`); await p.click('button:has-text("Set up two-factor")'); await p.waitForURL(/setup=1/).catch(() => {}); ok((await p.textContent('body')).includes('setup key'), '2FA setup shows key');
  // mobile viewport no horizontal overflow on key pages
  const m = await br.newContext({ viewport: { width: 375, height: 800 }, storageState: await ctx.storageState() }); const mp = await m.newPage();
  for (const u of ['', '/pages', '/databases', '/tasks', '/knowledge']) { await mp.goto(`${B}/w/${slug}${u}`); const over = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); ok(over <= 1, `mobile no horizontal scroll ${u || '/'} (${over}px)`); }
  console.log(fails.length ? '\nFAILS: ' + fails.length : '\nALL E2E OK'); await br.close();
})();
