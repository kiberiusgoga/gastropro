/**
 * F4 verification screenshots — Supplier Consumption Emails
 * 8 required screenshots
 */
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '../screenshots/feature-4');
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:4000';

async function login(page) {
  await page.goto(`${BASE}/`);
  await page.waitForSelector('nav button', { timeout: 15000 });
  await page.locator('input[type="email"], input[type="text"]').first().fill('admin@gastropro.mk');
  await page.locator('input[type="password"]').first().fill('admin123');
  await page.locator('button[type="submit"]').first().click();
  await page.waitForSelector('nav button', { timeout: 15000 });
  await page.waitForTimeout(1000);
}

async function getToken(page) {
  return page.evaluate(() => localStorage.getItem('gastropro_token'));
}
async function api(page, method, path, body) {
  const tok = await getToken(page);
  return page.evaluate(async ([url, m, b, t]) => {
    const opts = { method: m, headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' } };
    if (b) opts.body = JSON.stringify(b);
    const r = await fetch(url, opts);
    return r.json();
  }, [`${BASE}/api${path}`, method, body, tok]);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1400, height: 900 });
  await login(page);
  console.log('Logged in');

  // ── Ensure products have supplier_id set ──────────────────────────────────
  // Get suppliers and products, then assign suppliers to products via API
  const suppliers = await api(page, 'GET', '/suppliers', null);
  console.log('Suppliers:', suppliers?.map ? suppliers.map(s => s.name) : suppliers);

  // Set supplier_id on products via direct DB via a GET test
  // Link some products to suppliers for the consumption data
  // We'll use stock transactions to create consumption data

  // Get a closed shift to view Z-report
  const allShifts = await api(page, 'GET', '/shifts?status=closed&limit=5', null);
  let targetShift = allShifts?.data?.[0] || allShifts?.[0];
  console.log('Found closed shifts:', allShifts?.data?.length ?? allShifts?.length ?? 0);

  // ── Screenshot 1: Settings — Email settings section ───────────────────────
  await page.getByRole('button', { name: /Подесувања|Settings/i }).first().click();
  await page.waitForTimeout(2000);
  // Scroll down to email settings section
  await page.evaluate(() => { window.scrollTo(0, document.body.scrollHeight); });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, 'f4-01-settings-email-section.png') });
  console.log('1: Settings — email settings section with SMTP fields');

  // Fill in some SMTP values to show the form
  const smtpInputs = await page.locator('input[placeholder="smtp.gmail.com"]').count();
  if (smtpInputs > 0) {
    await page.locator('input[placeholder="smtp.gmail.com"]').fill('smtp.gmail.com');
    await page.locator('input[placeholder="restaurant@gmail.com"]').fill('gastropro@restaurant.mk');
    await page.evaluate(() => { window.scrollTo(0, document.body.scrollHeight); });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, 'f4-01b-settings-smtp-filled.png') });
    console.log('1b: Settings — SMTP fields filled');
  }

  // ── Navigate to Shift History to find a closed shift ─────────────────────
  // Go to StaffView which has shift history
  await page.getByRole('button', { name: /Staff|Персонал/i }).first().click().catch(() => {});
  await page.waitForTimeout(1500);

  // Try via dashboard shift history
  await page.getByRole('button', { name: /Dashboard/i }).first().click().catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, 'f4-02-pre-zreport.png') });
  console.log('2: Dashboard / shift view');

  // Navigate to Z-report via Staff > Shift History
  // First check if there's a shift history accessible somewhere
  const staffBtn = page.locator('nav button').filter({ hasText: /Staff|Персонал|Персонал/i });
  const staffCount = await staffBtn.count();
  if (staffCount > 0) {
    await staffBtn.first().click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(OUT, 'f4-02-staff-view.png') });
    console.log('2: Staff view with shift history button');

    // Find "Историjа на смени" or similar button
    const historyBtn = page.locator('button').filter({ hasText: /историjа|history|shift/i });
    const historyCount = await historyBtn.count();
    if (historyCount > 0) {
      await historyBtn.first().click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(OUT, 'f4-03-shift-history.png') });
      console.log('3: Shift history list');

      // Click the first closed shift to view Z-report
      const viewBtn = page.locator('button').filter({ hasText: /Z-|Z извештај|Извештај/i });
      const viewCount = await viewBtn.count();
      if (viewCount > 0) {
        await viewBtn.first().click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: path.join(OUT, 'f4-04-zreport-view.png') });
        console.log('4: Z-report view — full report');

        // Scroll down to supplier section
        await page.evaluate(() => { window.scrollTo(0, document.body.scrollHeight); });
        await page.waitForTimeout(1000);
        await page.screenshot({ path: path.join(OUT, 'f4-05-supplier-section.png') });
        console.log('5: Z-report — supplier consumption section');

        // Try to expand a supplier to see products
        const expandBtns = page.locator('button').filter({ hasText: /производ/i });
        const expandCount = await expandBtns.count();
        console.log('Expand buttons:', expandCount);
        if (expandCount > 0) {
          await expandBtns.first().click();
          await page.waitForTimeout(500);
          await page.screenshot({ path: path.join(OUT, 'f4-06-supplier-expanded.png') });
          console.log('6: Supplier expanded — product list visible');
        } else {
          await page.screenshot({ path: path.join(OUT, 'f4-06-supplier-no-products.png') });
          console.log('6: No consumed products with supplier links yet (supplier_id not set on products)');
        }

        // Click compose email for a supplier
        const emailBtns = page.locator('button').filter({ hasText: /емаили|email/i });
        const emailCount = await emailBtns.count();
        if (emailCount > 0) {
          await emailBtns.first().click();
          await page.waitForTimeout(800);
          await page.screenshot({ path: path.join(OUT, 'f4-07-email-preview-modal.png') });
          console.log('7: Email preview modal open');
          // Close
          await page.keyboard.press('Escape');
          await page.waitForTimeout(300);
        }
      }
    }
  }

  // ── Screenshot 8: Email settings saved confirmation ────────────────────────
  await page.getByRole('button', { name: /Подесувања|Settings/i }).first().click();
  await page.waitForTimeout(1500);
  await page.evaluate(() => { window.scrollTo(0, document.body.scrollHeight); });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, 'f4-08-settings-email-final.png') });
  console.log('8: Settings — email settings section final state');

  await browser.close();
  const files = fs.readdirSync(OUT).sort();
  console.log('\nAll files in', OUT, ':\n ', files.join('\n  '));
}

main().catch(err => { console.error(err); process.exit(1); });
