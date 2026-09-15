const { launch } = require('./launch');

(async () => {
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } });
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

  async function setField(key, value) {
    const el = page.locator('[data-field="' + key + '"]');
    if (!(await el.count())) { console.log('  (no field: ' + key + ')'); return; }
    const tag = await el.evaluate((e) => e.tagName.toLowerCase());
    if (tag === 'select') await el.selectOption(value).catch(async () => { await el.selectOption({ label: value }).catch(() => {}); });
    else await el.fill(String(value));
  }

  await setField('customerName', 'Smoke Test Customer');
  await setField('address', '100 Test Ave');
  await setField('city', 'West Palm Beach');
  await setField('oldTons', '3');
  await setField('newTons', '3');
  await setField('oldRefrigerant', 'R-22');
  await setField('oldHeatStripAmp', '45');
  await setField('heatStripAmp', '38');
  await page.screenshot({ path: '/tmp/shots/install-filled.png', fullPage: true });

  await page.click('#saveBtn');
  await page.waitForTimeout(500);
  console.log('Saved install. Errors so far:', errors.length ? errors.join(' | ') : 'none');

  await page.click('[data-route="jobs"]');
  await page.waitForTimeout(400);
  await page.screenshot({ path: '/tmp/shots/jobs-list.png', fullPage: true });

  const jobRow = page.locator('[data-open-jobno]').first();
  const jobRowCount = await jobRow.count();
  console.log('Job rows found:', jobRowCount);
  if (jobRowCount) {
    const jobNo = await jobRow.getAttribute('data-open-jobno');
    console.log('Opening job:', jobNo);
    await jobRow.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: '/tmp/shots/job-detail.png', fullPage: true });
    const btns = await page.locator('button').allInnerTexts();
    console.log('Relevant buttons visible:', JSON.stringify(btns.filter((b) => /load|permit|pdf|calc/i.test(b))));

    const permitPacketBtn = page.locator('button:has-text("Permit packet")').first();
    if (await permitPacketBtn.count()) {
      await permitPacketBtn.click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: '/tmp/shots/permit-actions-modal.png', fullPage: true });
      const modalBtns = await page.locator('#modalBox button, .modal button').allInnerTexts();
      console.log('Buttons inside Permit packet modal:', JSON.stringify(modalBtns));
    }

    const loadBtn = page.locator('button:has-text("Edit heat load")').first();
    if (await loadBtn.count()) {
      await loadBtn.click();
      await page.waitForTimeout(400);
      async function setLC(key, value) {
        const el = page.locator('#modalBox [data-field="' + key + '"]');
        if (!(await el.count())) return;
        const tag = await el.evaluate((e) => e.tagName.toLowerCase());
        if (tag === 'select') await el.selectOption(value).catch(() => {});
        else await el.fill(String(value));
      }
      await setLC('floorArea', '1800');
      await setLC('ceilingHt', '8');
      await setLC('stories', '1');
      await setLC('yearBuilt', '1995');
      await setLC('bedrooms', '3');
      await setLC('occupants', '4');
      await setLC('outdoorT', '91');
      await setLC('indoorT', '75');
      await setLC('winN', '40'); await setLC('winS', '60'); await setLC('winE', '30'); await setLC('winW', '30');
      await setLC('existingTon', '3');
      await setLC('existingBrand', 'Goodman GSC13');
      await page.screenshot({ path: '/tmp/shots/load-calc-form.png', fullPage: true });
      const calcBtn = page.locator('button:has-text("Save load + verdict")').first();
      if (await calcBtn.count()) {
        await calcBtn.click();
        await page.waitForTimeout(400);
        // Re-open the permit actions modal to see the verdict/result reflected.
        const permitPacketBtn2 = page.locator('button:has-text("Permit packet")').first();
        if (await permitPacketBtn2.count()) { await permitPacketBtn2.click(); await page.waitForTimeout(400); }
        const resultText = await page.locator('#modalBox, .modal').first().innerText();
        console.log('=== Permit actions modal after saving load calc ===\n' + resultText.slice(0, 2000));
        await page.screenshot({ path: '/tmp/shots/load-calc-result.png', fullPage: true });
      } else {
        console.log('No save button found; modal text: ' + (await page.locator('#modalBox').innerText()).slice(0,500));
      }
    } else {
      console.log('No "Load Calc" button found on job detail.');
    }
  } else {
    const content = await page.locator('#content, .content').first().innerText();
    console.log('Jobs page content:', content.slice(0, 1000));
  }

  console.log('=== Total JS errors during full flow ===', errors.length ? errors.join(' | ') : 'none');
  await browser.close();
})();
