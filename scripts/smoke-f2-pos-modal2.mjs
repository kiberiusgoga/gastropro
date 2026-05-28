/**
 * Captures POS payment modal screenshots — 4 options + Фактура company selector
 */
import { chromium } from 'playwright';
import fs from 'fs';

const OUT = 'screenshots/feature-2';
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:4000';

async function login(page) {
  await page.goto(`${BASE}/`);
  await page.waitForSelector('input[type="password"]', { timeout: 15000 });
  await page.locator('input[type="email"], input[type="text"]').first().fill('admin@gastropro.mk');
  await page.locator('input[type="password"]').first().fill('admin123');
  await page.locator('button[type="submit"]').first().click();
  // Wait until a nav button is visible (indicates app loaded)
  await page.waitForSelector('nav button', { timeout: 15000 });
  await page.waitForTimeout(1000);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1400, height: 900 });
  await login(page);
  console.log('Logged in, nav ready');

  // Debug: screenshot after login to see state
  await page.screenshot({ path: `${OUT}/f2-pos-debug-after-login.png` });

  // Click the Маси/Tables sidebar button
  const tablesBtn = page.getByRole('button', { name: /^Маси$|^Tables$|^Tavolina$/i });
  await tablesBtn.first().click({ timeout: 10000 });
  await page.waitForTimeout(2000);
  console.log('Clicked tables nav button');

  // Screenshot of tables view
  await page.screenshot({ path: `${OUT}/f2-pos-debug-tables-view.png` });

  // Tables 1, 3, 4 have open orders. Occupied tables have bg-rose-950 class.
  // Click the first occupied table button.
  let payBtnVisible = false;

  // Find occupied table buttons (rose-colored) and click the first one
  const occupiedTables = page.locator('button[class*="rose-950"]');
  const occupiedCount = await occupiedTables.count();
  console.log(`Occupied table buttons found: ${occupiedCount}`);

  for (let i = 0; i < occupiedCount; i++) {
    try {
      const btn = occupiedTables.nth(i);
      const txt = (await btn.innerText()).trim().split('\n')[0].trim();
      console.log(`Clicking occupied table button ${i}: "${txt}"`);
      await btn.click({ timeout: 3000 });
      await page.waitForTimeout(1200);
      const pay = page.locator('button').filter({ hasText: /Наплати/i });
      if (await pay.isVisible({ timeout: 2000 })) {
        payBtnVisible = true;
        console.log(`Opened table, Наплати button visible`);
        break;
      }
    } catch (e) { console.log('skip:', e.message.split('\n')[0]); }
  }

  if (!payBtnVisible) {
    await page.screenshot({ path: `${OUT}/f2-pos-debug-no-pay.png` });
    console.error('Could not find Наплати button. Debug screenshot saved.');
    await browser.close();
    process.exit(1);
  }

  // ── Screenshot A: Payment modal with all 4 options ────────────────────────
  await page.locator('button').filter({ hasText: /Наплати/i }).first().click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/f2-pos-a-payment-4-options.png` });
  console.log('A: Payment modal — Готовина / Картичка / Мешано / Фактура');

  // ── Screenshot B: Фактура selected — company selector ────────────────────
  const fakturaBtn = page.locator('button').filter({ hasText: /^Фактура$/ });
  await fakturaBtn.first().click({ timeout: 5000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/f2-pos-b-invoice-company-selector.png` });
  console.log('B: Фактура selected — company selector + Издај фактура button');

  await browser.close();
  console.log('Done');
}

main().catch(err => { console.error(err); process.exit(1); });
