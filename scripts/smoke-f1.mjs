/**
 * Feature 1 screenshots — Purchase Cost & Margin tracking
 */
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '../screenshots/feature-1');
fs.mkdirSync(OUT, { recursive: true });

const BASE = 'http://localhost:4000';

async function scrollDown(page, by = 300) {
  try {
    await page.locator('div.flex-1.overflow-y-auto').first().evaluate((el, b) => { el.scrollBy(0, b); }, by);
  } catch {
    await page.evaluate((b) => window.scrollBy(0, b), by);
  }
  await page.waitForTimeout(250);
}

async function scrollTop(page) {
  try {
    await page.locator('div.flex-1.overflow-y-auto').first().evaluate(el => { el.scrollTop = 0; });
  } catch {
    await page.evaluate(() => window.scrollTo(0, 0));
  }
  await page.waitForTimeout(150);
}

async function login(page) {
  await page.goto(`${BASE}/`);
  await page.waitForSelector('input[type="password"]', { timeout: 10000 });
  await page.locator('input[type="email"], input[type="text"]').first().fill('admin@gastropro.mk');
  await page.locator('input[type="password"]').first().fill('admin123');
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(2500);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1400, height: 900 });
  await login(page);
  console.log('Logged in');

  // ── 1. Products list ─────────────────────────────────────────────────────
  await page.locator('nav button, aside button').filter({ hasText: /Инвентар|Inventory/i }).first().click();
  await page.waitForTimeout(2000);

  // click Products tab
  await page.locator('button').filter({ hasText: /^Производи$|^Products$/i }).first().click();
  await page.waitForTimeout(1500);
  await scrollTop(page);
  await page.screenshot({ path: path.join(OUT, 'f1-1-products-header.png') });
  console.log('1: Products list — header + column headers');

  await scrollDown(page, 150);
  await page.screenshot({ path: path.join(OUT, 'f1-2-products-rows.png') });
  console.log('2: Products list — rows with Cost/Margin column');

  // ── 2. Per-Warehouse ─────────────────────────────────────────────────────
  await page.locator('button').filter({ hasText: /По магацин|Per.*arehouse|магацин/i }).first().click();
  await page.waitForTimeout(2500);
  await scrollTop(page);
  await page.screenshot({ path: path.join(OUT, 'f1-3-per-warehouse-stats.png') });
  console.log('3: Per-warehouse stats with cost subtitle');

  await scrollDown(page, 350);
  await page.screenshot({ path: path.join(OUT, 'f1-4-per-warehouse-table.png') });
  console.log('4: Per-warehouse product table with Cost/Margin column');

  // ── 3. Stock Dashboard ───────────────────────────────────────────────────
  // Navigate fresh to avoid sidebar overlay issues
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(2000);
  // Dump nav buttons
  const navBtns = await page.locator('nav button, aside button').allTextContents();
  console.log('Nav buttons:', navBtns);
  await page.locator('nav button, aside button').filter({ hasText: /Stock|Залиха/i }).first().click();
  await page.waitForTimeout(2000);
  await scrollTop(page);
  await page.screenshot({ path: path.join(OUT, 'f1-5-stock-dashboard.png') });
  console.log('5: Stock dashboard — STOCK VALUE card with "At purchase cost" subtitle');

  await browser.close();
  console.log('\nDone. Files:', fs.readdirSync(OUT).sort().join(', '));
}

main().catch(err => { console.error(err); process.exit(1); });
