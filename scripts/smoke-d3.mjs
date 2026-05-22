import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'tmp-screenshots', 'd3');
mkdirSync(OUT, { recursive: true });

const BASE = 'http://localhost:4000';
const snap = async (page, name) => {
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: false });
  console.log(`📸 ${name}`);
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);

  // Login
  await page.goto(`${BASE}/`);
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"]', 'admin@gastropro.mk');
  await page.fill('input[type="password"]', 'admin123');
  await Promise.all([page.waitForLoadState('networkidle'), page.click('button[type="submit"]')]);
  await page.waitForTimeout(800);
  console.log('✅ Logged in');

  // Navigate to Stock via sidebar
  await page.click('text=Stock');
  await page.waitForTimeout(2000);
  console.log('✅ Navigated to Stock dashboard');

  // (a) Full view: all 5 summary cards + matrix table
  await snap(page, 'a-stock-dashboard-full');
  console.log('✅ (a) Full dashboard');

  // (b) Filter: type "vino" in search
  const searchInput = page.locator('input[placeholder*="Пребарај"], input[placeholder*="Search products"], input[placeholder*="Kërko"]').first();
  await searchInput.click();
  await searchInput.type('vino');
  await page.waitForTimeout(600);
  await snap(page, 'b-search-vino');
  console.log('✅ (b) Search vino');

  // Clear search
  await searchInput.triple_click ? await searchInput.click({ clickCount: 3 }) : await searchInput.fill('');
  await page.waitForTimeout(300);

  // (c) Highlight critical toggle ON
  const checkboxes = page.locator('input[type="checkbox"]');
  const cbCount = await checkboxes.count();
  // Highlight critical is the second checkbox (index 1)
  if (cbCount >= 2) {
    await checkboxes.nth(1).click();
    await page.waitForTimeout(400);
  }
  await snap(page, 'c-highlight-critical');
  console.log('✅ (c) Highlight critical ON');

  // (d) Low stock only ON (first checkbox)
  await checkboxes.nth(0).click();
  await page.waitForTimeout(400);
  await snap(page, 'd-low-stock-only');
  console.log('✅ (d) Low stock only ON');

  // Turn off low stock only for next test
  await checkboxes.nth(0).click();
  // Turn off highlight critical too
  await checkboxes.nth(1).click();
  await page.waitForTimeout(200);

  // (e) Sort by "low first"
  const sortSelect = page.locator('select').nth(1); // second select is sort
  await sortSelect.selectOption('low_first');
  await page.waitForTimeout(400);
  await snap(page, 'e-sort-low-first');
  console.log('✅ (e) Sort low first');

  // Reset sort
  await sortSelect.selectOption('name_asc');
  await page.waitForTimeout(200);

  // (f) Mobile width ~400px
  await page.setViewportSize({ width: 400, height: 812 });
  await page.waitForTimeout(600);
  await snap(page, 'f-mobile-400px');
  console.log('✅ (f) Mobile 400px');

  await browser.close();
  console.log(`\n✅ All D.3 screenshots saved to: ${OUT}`);
})().catch(err => {
  console.error('SMOKE CRASHED:', err.message);
  process.exit(1);
});
