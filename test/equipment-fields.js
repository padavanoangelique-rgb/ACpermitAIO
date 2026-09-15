const { launch } = require('./launch');

(async () => {
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  const errors = [];
  page.on('pageerror', (err) => errors.push('PAGEERROR: ' + err.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push('CONSOLE: ' + msg.text().slice(0,300)); });
  await page.route('**://*/**', (route) => route.request().url().startsWith('http://localhost:8934') ? route.continue() : route.abort());

  await page.goto('http://localhost:8934/index.html', { waitUntil: 'networkidle' });
  await page.click('[data-login="emp_office"]');
  await page.fill('#lockPin', '1111');
  await page.click('#lockGo');
  await page.waitForTimeout(400);

  await page.click('[data-route="installs"]');
  await page.waitForTimeout(300);
  await page.click('button:has-text("+ Add Install")');
  await page.waitForTimeout(400);

  const modalVisible = await page.locator('#modalLayer, .modal, #modal').first().isVisible().catch(() => false);
  console.log('Modal visible after openInstallForm():', modalVisible);

  // Labels render CSS text-transform:uppercase but innerText reflects that
  // visual transform, so compare uppercase-to-uppercase.
  const labels = (await page.locator('label, .field-label, .form-label').allInnerTexts()).map((l) => l.toUpperCase());
  const expected = [
    'Existing Refrigerant', 'Existing Air Handler Model', 'Existing Heat Strip (KW)', 'Existing Heat Strip Amperage',
    'Existing Min. Circuit Ampacity', 'Existing Breaker/Fuse Min', 'Existing Breaker/Fuse Max', 'Existing Wire Size (AWG)',
    'SEER2', 'EER', 'New Condensing Unit Model #', 'New Condensing Unit Voltage', 'New Air Handler Model #',
    'New Evaporator Coil Model #', 'New Heat Strip (KW)', 'New Heat Strip Amperage',
  ];
  const missing = expected.filter((e) => !labels.some((l) => l.includes(e.toUpperCase())));
  console.log('Total labels found in modal:', labels.length);
  console.log('Missing expected equipment labels:', JSON.stringify(missing));
  if (missing.length) process.exitCode = 1;
  await page.screenshot({ path: '/tmp/shots/install-form.png', fullPage: true });

  // Scroll to capture more of the form
  const modal = page.locator('#modalBox, .modal-body, .modal').first();
  await modal.evaluate((el) => { el.scrollTop = el.scrollHeight / 2; }).catch(() => {});
  await page.screenshot({ path: '/tmp/shots/install-form-scrolled.png', fullPage: true });

  console.log('JS errors during this test:', errors.length ? errors.join(' | ') : 'none');
  await browser.close();
})();
