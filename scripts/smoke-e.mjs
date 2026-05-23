/**
 * Phase E screenshot script — Z-Report per-warehouse section
 */
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '../screenshots/phase-e');
fs.mkdirSync(OUT, { recursive: true });

const BASE = 'http://localhost:4000';

function getScrollContainer(page) {
  return page.locator('div.flex-1.overflow-y-auto').first();
}

async function scrollTo(page, top) {
  const container = getScrollContainer(page);
  await container.evaluate((el, top) => { el.scrollTop = top; }, top);
  await page.waitForTimeout(200);
}

async function scrollBy(page, by) {
  const container = getScrollContainer(page);
  await container.evaluate((el, by) => { el.scrollBy(0, by); }, by);
  await page.waitForTimeout(150);
}

async function getScrollInfo(page) {
  return getScrollContainer(page).evaluate(el => ({
    scrollTop: el.scrollTop,
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
  }));
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

  // Navigate to Staff
  await page.locator('nav button, aside button').filter({ hasText: /Персонал|Staff/i }).first().click();
  await page.waitForTimeout(1500);

  // Scroll to shift history and click first row
  await scrollBy(page, 500);
  const rowCount = await page.locator('table tbody tr').count();
  console.log(`Shift rows: ${rowCount}`);
  await page.locator('table tbody tr').first().click();
  await page.waitForTimeout(2500);

  // Check scroll info after Z-Report loads
  const info = await getScrollInfo(page);
  console.log(`Scroll container: scrollTop=${info.scrollTop} scrollHeight=${info.scrollHeight} clientHeight=${info.clientHeight}`);

  // Screenshot a: Z-Report at top
  await scrollTo(page, 0);
  await page.screenshot({ path: path.join(OUT, 'e1-zreport-header.png') });
  console.log('a: Header');

  // Scroll in increments and take screenshots
  for (let offset = 300; offset <= info.scrollHeight; offset += 300) {
    await scrollTo(page, offset);
    const snap = path.join(OUT, `scroll-${offset}.png`);
    await page.screenshot({ path: snap });
  }
  console.log('Scroll snapshots taken');

  // Use scrollIntoView on the per-warehouse section — find by text content
  const pwSection = page.locator('h2, h3, div[class*="heading"], p, span').filter({ hasText: /Локација|Revenue by location|по локација/i }).first();
  const pwCount = await pwSection.count();
  console.log(`Per-warehouse heading elements: ${pwCount}`);

  if (pwCount > 0) {
    await pwSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, 'e2-per-warehouse-table.png') });
    console.log('b: Per-warehouse table (via scrollIntoView)');

    // Scroll a bit more for percent bars
    await scrollBy(page, 200);
    await page.screenshot({ path: path.join(OUT, 'e3-percent-bars.png') });
    console.log('c: Percent bars');
  } else {
    console.log('WARNING: per-warehouse heading not found');
    // Dump all headings for debugging
    const headings = await page.locator('h1, h2, h3').allTextContents();
    console.log('Headings on page:', headings.slice(0, 10));
  }

  // Screenshot d: Revenue/VAT backward compat sections
  await scrollTo(page, 600);
  await page.screenshot({ path: path.join(OUT, 'e4-revenue-vat-sections.png') });
  console.log('d: Revenue/VAT sections');

  // Full page
  await scrollTo(page, 0);
  await page.screenshot({ path: path.join(OUT, 'e-full-page.png'), fullPage: true });

  // Back to history list
  const backBtn = page.locator('button').filter({ hasText: /Назад|Back/i }).first();
  if (await backBtn.count() > 0) {
    await backBtn.click();
  } else {
    await page.locator('button').nth(0).click();
  }
  await page.waitForTimeout(1000);
  await scrollBy(page, 500);
  await page.screenshot({ path: path.join(OUT, 'e5-history-list.png') });
  console.log('e: Shift history list');

  // Mobile screenshot
  await page.locator('table tbody tr').first().click();
  await page.waitForTimeout(2500);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  await scrollTo(page, 0);
  await page.screenshot({ path: path.join(OUT, 'e6a-mobile-top.png') });

  if (pwCount > 0) {
    await pwSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, 'e6-mobile-per-warehouse.png') });
    console.log('f: Mobile per-warehouse');
  }

  await browser.close();
  console.log('\nDone. Files:', fs.readdirSync(OUT).sort().join(', '));
}

main().catch(err => { console.error(err); process.exit(1); });
