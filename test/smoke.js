const { launch } = require('./launch');
const fs = require('fs');

(async () => {
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 940 } });
  // This sandbox blocks outbound internet (nominatim/jsdelivr/etc all denied by
  // the egress proxy) — abort those fast instead of letting them hang on a slow
  // proxy tunnel-failure timeout, which was destabilizing click timing.
  await page.route('**://*/**', (route) => {
    const url = route.request().url();
    if (url.startsWith('http://localhost:8934')) return route.continue();
    return route.abort();
  });
  const errors = [];
  page.on('pageerror', (err) => errors.push('PAGEERROR: ' + err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push('CONSOLE ERROR: ' + msg.text().slice(0, 400));
  });

  const report = [];
  function log(msg) { report.push(msg); console.log(msg); }
  page.on('dialog', async (dialog) => {
    log('DIALOG [' + dialog.type() + ']: ' + dialog.message());
    await dialog.dismiss().catch(() => {});
  });

  await page.goto('http://localhost:8934/index.html', { waitUntil: 'networkidle' });
  await page.click('[data-login="emp_office"]');
  await page.fill('#lockPin', '1111');
  await page.click('#lockGo');
  await page.waitForTimeout(500);
  log('Logged in as Office.');
  await page.screenshot({ path: '/tmp/shots/dashboard.png', fullPage: true });

  const routes = ['dashboard','leads','estimates','dispatch','installs','jobs','inventory','letters','team','marketing','admin'];
  for (const route of routes) {
    errors.length = 0;
    try {
      const navCount = await page.locator('[data-route="' + route + '"]').count();
      if (navCount !== 1) {
        const navHtml = await page.locator('#mainNav').innerHTML().catch(() => '(no #mainNav)');
        log('    DEBUG before ' + route + ': count=' + navCount + ' navHtml(first 2000)=' + navHtml.slice(0, 2000));
      }
      await page.click('[data-route="' + route + '"]', { timeout: 8000 });
      await page.waitForTimeout(400);
      const contentText = await page.locator('#content, .content, main').first().innerText().catch(() => '(no content selector matched)');
      const errCount = errors.length;
      log('--- route=' + route + ' errors=' + errCount + ' textLen=' + contentText.length);
      if (errCount) log('    ' + errors.join(' | '));
      await page.screenshot({ path: '/tmp/shots/route-' + route + '.png', fullPage: true });
    } catch (e) {
      log('!!! route=' + route + ' FAILED: ' + e.message.slice(0, 200));
      await page.screenshot({ path: '/tmp/shots/route-' + route + '-FAIL.png', fullPage: true }).catch(() => {});
    }
  }

  fs.writeFileSync('/tmp/shots/report.txt', report.join('\n'));
  await browser.close();
})();
