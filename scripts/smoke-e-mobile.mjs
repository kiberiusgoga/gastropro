/**
 * Phase E mobile screenshot — Z-Report per-warehouse on narrow viewport
 */
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '../screenshots/phase-e');
fs.mkdirSync(OUT, { recursive: true });

const BASE = 'http://localhost:4000';

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

  // Log in at normal viewport first
  await page.setViewportSize({ width: 1400, height: 900 });
  await login(page);
  console.log('Logged in');

  // Navigate to Staff at full viewport
  await page.locator('nav button, aside button').filter({ hasText: /Персонал|Staff/i }).first().click();
  await page.waitForTimeout(1000);

  // Open Z-Report
  await page.locator('table tbody tr').first().click();
  await page.waitForTimeout(2500);
  console.log('Opened Z-Report at full viewport');

  // Now resize to mobile to show responsive layout
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(OUT, 'e6a-mobile-zreport-top.png') });
  console.log('Mobile top captured');

  // Scroll to per-warehouse section
  for (let i = 0; i < 15; i++) {
    await page.evaluate(() => window.scrollBy(0, 200));
    await page.waitForTimeout(100);
    const hasPerWH = await page.locator('text=/Локација|Location|магацин|Warehouse/i').count();
    if (hasPerWH > 0) {
      console.log(`Found per-warehouse section after ${i+1} scrolls`);
      break;
    }
  }
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'e6-mobile-per-warehouse.png') });
  console.log('Screenshot f: Mobile per-warehouse saved');

  await browser.close();
  console.log('Done. Screenshots:', fs.readdirSync(OUT).sort().join(', '));
}

main().catch(err => { console.error(err); process.exit(1); });
