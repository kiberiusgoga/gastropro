/**
 * F4 targeted screenshots — uses known closed shift ID
 */
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '../screenshots/feature-4');
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:4000';
const CLOSED_SHIFT_ID = 'f3c77d10-4357-4471-81cc-6f104faf0535';

async function login(page) {
  await page.goto(`${BASE}/`);
  await page.waitForSelector('input[type="password"]', { timeout: 15000 });
  await page.locator('input[type="email"], input[type="text"]').first().fill('admin@gastropro.mk');
  await page.locator('input[type="password"]').first().fill('admin123');
  await page.locator('button[type="submit"]').first().click();
  await page.waitForSelector('nav button', { timeout: 15000 });
  await page.waitForTimeout(1000);
}
async function getToken(page) {
  return page.evaluate(() => localStorage.getItem('gastropro_token'));
}
async function api(page, method, urlPath, body) {
  const tok = await getToken(page);
  return page.evaluate(async ([url, m, b, t]) => {
    const opts = { method: m, headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' } };
    if (b) opts.body = JSON.stringify(b);
    const r = await fetch(url, opts);
    return r.json();
  }, [`${BASE}/api${urlPath}`, method, body, tok]);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1400, height: 900 });
  await login(page);
  console.log('Logged in');

  // ── Screenshot 1: Settings — email settings section ───────────────────────
  await page.getByRole('button', { name: /Подесувања|Settings/i }).first().click();
  await page.waitForTimeout(2000);
  await page.evaluate(() => { window.scrollTo(0, document.body.scrollHeight); });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, 'f4-01-settings-email.png') });
  console.log('1: Settings — email settings section (SMTP + auto-send toggle)');

  // Save some email settings for display
  await api(page, 'PUT', '/email-settings', {
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
    smtpUser: 'gastropro@restaurant.mk',
    smtpPass: '••••••••',
    smtpFrom: 'GastroPro <noreply@restaurant.mk>',
    autoSendOnZClose: true,
    subjectTemplate: 'Дневна потрошувачка — {date} — {restaurant_name}',
    bodyTemplate: '',
  });
  console.log('Email settings saved via API');

  // Reload settings page to show saved values
  await page.getByRole('button', { name: /Dashboard/i }).first().click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /Подесувања|Settings/i }).first().click();
  await page.waitForTimeout(2000);
  await page.evaluate(() => { window.scrollTo(0, document.body.scrollHeight); });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, 'f4-01b-settings-email-saved.png') });
  console.log('1b: Settings — email settings with saved values');

  // ── Navigate to Staff > Shift History ─────────────────────────────────────
  const staffBtn = page.locator('nav button').filter({ hasText: /Staff|Персонал/i });
  await staffBtn.first().click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(OUT, 'f4-02-staff-view.png') });
  console.log('2: Staff view with shift history table');

  // ShiftHistory rows are clickable tr elements — click the first closed shift row
  const shiftRows = page.locator('tbody tr');
  const rowCount = await shiftRows.count();
  console.log('Shift rows found:', rowCount);

  await page.screenshot({ path: path.join(OUT, 'f4-03-shift-history.png') });
  console.log('3: Shift history list');

  if (rowCount > 0) {
    await shiftRows.first().click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(OUT, 'f4-04-zreport-top.png') });
    console.log('4: Z-report — top section');

    // Scroll down to supplier section
    await page.evaluate(() => {
      const main = document.querySelector('main .overflow-y-auto') || document.querySelector('main');
      if (main) main.scrollTop = main.scrollHeight;
      window.scrollTo(0, document.body.scrollHeight * 2);
    });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(OUT, 'f4-05-supplier-section.png') });
    console.log('5: Z-report — scrolled to bottom (supplier consumption section)');

    // Find supplier section header and scroll it into view
    const supplierH3 = page.locator('h3').filter({ hasText: /добавувач|Supplier/i });
    const supH3Count = await supplierH3.count();
    console.log('Supplier h3 headers:', supH3Count);
    if (supH3Count > 0) {
      await supplierH3.first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(OUT, 'f4-05b-supplier-section-view.png') });
      console.log('5b: Supplier consumption section in view');
    }

    // Expand a supplier (click the products count button)
    const expandBtns = page.locator('button').filter({ hasText: /производ/i });
    const expandCount = await expandBtns.count();
    console.log('Expand buttons (products):', expandCount);
    if (expandCount > 0) {
      await expandBtns.first().click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(OUT, 'f4-06-supplier-expanded.png') });
      console.log('6: Supplier row expanded — product list visible');
    }

    // Click "Состави емаили" compose email button
    const composeBtns = page.locator('button').filter({ hasText: /емаили|Compose/i });
    const composeCount = await composeBtns.count();
    console.log('Compose email buttons:', composeCount);
    if (composeCount > 0) {
      await composeBtns.first().click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(OUT, 'f4-07-email-preview-modal.png') });
      console.log('7: Email preview modal — subject + editable body');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    }
  }

  // ── Screenshot 8: Mobile view of Settings ─────────────────────────────────
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole('button', { name: /Подесувања|Settings/i }).first().click().catch(() => {});
  // Click hamburger if mobile
  const menuBtn = page.locator('button').filter({ hasText: '' }).first();
  // Just navigate via sidebar if visible
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, 'f4-08-mobile-view.png') });
  console.log('8: Mobile view');

  await browser.close();
  const files = fs.readdirSync(OUT).sort();
  console.log('\nAll files in', OUT, ':\n ', files.join('\n  '));
}

main().catch(err => { console.error(err); process.exit(1); });
