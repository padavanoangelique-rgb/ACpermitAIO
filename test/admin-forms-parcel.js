const { launch } = require('./launch');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } });
  const errors = [];
  page.on('pageerror', (err) => errors.push('PAGEERROR: ' + err.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push('CONSOLE: ' + msg.text().slice(0, 300)); });
  await page.route('**://*/**', (route) => route.request().url().startsWith('http://localhost:8934') ? route.continue() : route.abort());

  await page.goto('http://localhost:8934/index.html', { waitUntil: 'networkidle' });
  await page.click('[data-login="emp_office"]');
  await page.fill('#lockPin', '1111');
  await page.click('#lockGo');
  await page.waitForTimeout(400);

  // --- Admin: Form Templates card ---
  await page.click('[data-route="admin"]');
  await page.waitForTimeout(300);
  const rowsBefore = await page.locator('[data-upload-form]').count();
  console.log('Jurisdiction rows in Form Templates card:', rowsBefore);
  await page.screenshot({ path: '/tmp/shots/admin-form-templates.png', fullPage: true });

  // Upload a replacement form for Boca Raton.
  const bocaBtn = page.locator('[data-upload-form="Boca Raton"]').first();
  if (await bocaBtn.count()) {
    await bocaBtn.click();
    await page.waitForTimeout(300);
    await page.fill('#ftTitle', 'Test Replacement Form');
    const tmpPdf = '/tmp/shots/tiny-test.pdf';
    // Minimal valid PDF bytes.
    fs.writeFileSync(tmpPdf, Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\nxref\n0 4\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n0\n%%EOF'));
    await page.setInputFiles('#ftFile', tmpPdf);
    await page.click('#ftSave');
    await page.waitForTimeout(400);
    await page.screenshot({ path: '/tmp/shots/admin-form-templates-after-upload.png', fullPage: true });
    const bocaRow = await page.locator('tr', { hasText: 'Boca Raton' }).innerText();
    console.log('Boca Raton row after upload:', bocaRow.replace(/\n/g, ' | '));
  } else {
    console.log('No "Boca Raton" upload button found.');
  }

  // --- Property appraiser: Broward automated lookup UI ---
  await page.click('[data-route="installs"]');
  await page.waitForTimeout(300);
  await page.click('button:has-text("+ Add Install")');
  await page.waitForTimeout(300);
  async function setField(key, value) {
    const el = page.locator('[data-field="' + key + '"]');
    if (!(await el.count())) return;
    await el.fill(String(value));
  }
  await setField('customerName', 'Broward Lookup Test');
  await setField('address', '100 Test Ave');
  await setField('city', 'Hollywood');
  await page.click('#saveBtn');
  await page.waitForTimeout(400);

  await page.click('[data-route="jobs"]');
  await page.waitForTimeout(300);
  await page.locator('[data-open-jobno]').last().click();
  await page.waitForTimeout(300);
  // Set jurisdiction to a Broward city so the modal opens in Broward mode.
  await page.click('button:has-text("Permit packet")');
  await page.waitForTimeout(300);
  await page.click('button:has-text("Edit record")');
  await page.waitForTimeout(300);
  const jurSelect = page.locator('[data-field="jurisdiction"]');
  if (await jurSelect.count()) {
    await jurSelect.selectOption('Hollywood');
    await page.click('#saveBtn');
    await page.waitForTimeout(800);
    console.log('Set jurisdiction to Hollywood (Broward).');
  } else {
    console.log('No jurisdiction field found on Edit record form.');
  }
  await page.locator('[data-open-jobno]').last().click();
  await page.waitForTimeout(300);
  await page.click('button:has-text("Permit packet")');
  await page.waitForTimeout(300);

  const paBtn = page.locator('button:has-text("Property appraiser")').first();
  if (await paBtn.count()) {
    await paBtn.click();
    await page.waitForTimeout(300);
    const modalTitle = await page.locator('#modalBox h3, #modalBox .modal-head, #modalBox').first().innerText();
    console.log('Property appraiser modal opened, snippet:', modalTitle.slice(0, 200));
    await page.screenshot({ path: '/tmp/shots/property-appraiser-modal.png', fullPage: true });
  } else {
    console.log('No "Property appraiser" button found.');
  }

  console.log('=== Total JS errors ===', errors.length ? errors.join(' | ') : 'none');
  await browser.close();
})();
