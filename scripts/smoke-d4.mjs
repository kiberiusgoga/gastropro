import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'tmp-screenshots', 'd4');
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

  // Navigate to Transfers
  await page.click('text=Transfers');
  await page.waitForTimeout(2000);
  console.log('✅ Navigated to Transfers page');

  // (a) Full page view — empty form + history table
  await snap(page, 'a-transfers-page-full');

  // Wait for warehouses to populate selects (API call to /warehouses)
  await page.waitForFunction(() => {
    const selects = document.querySelectorAll('select');
    return selects.length >= 2 && selects[0].options.length > 1;
  }, { timeout: 10000 });
  await page.waitForTimeout(300);

  // (b) Form filled in with source/dest/product/quantity
  const selects = page.locator('select');
  await selects.nth(0).selectOption({ index: 1 }); // pick first warehouse as source
  await page.waitForTimeout(200);
  await selects.nth(1).selectOption({ index: 2 }); // pick second warehouse as dest (filtering out source — but not filtering in our impl, so pick different)
  await page.waitForTimeout(200);

  // Open the ProductCombobox and pick first product
  const comboboxBtn = page.locator('button').filter({ hasText: /Search product|Пребарај производ|Kërko produkt/i }).first();
  await comboboxBtn.click();
  await page.waitForTimeout(400);

  // (c) ProductCombobox open with filter applied
  const searchInDropdown = page.locator('input[placeholder*="илтрир"], input[placeholder*="iltrira"], input[placeholder*="iltroj"]').first();
  if (await searchInDropdown.count() === 0) {
    // fallback: the combobox opened, type to filter
    await page.keyboard.type('пар');
  } else {
    await searchInDropdown.fill('пар');
  }
  await page.waitForTimeout(400);
  await snap(page, 'c-combobox-open-filtered');

  // Clear filter and select a product
  if (await searchInDropdown.count() > 0) {
    await searchInDropdown.fill('');
    await page.waitForTimeout(200);
  }
  // Click the first product in the dropdown
  const dropdownItems = page.locator('.absolute.z-50 button').first();
  if (await dropdownItems.count() > 0) {
    await dropdownItems.click();
    await page.waitForTimeout(200);
  } else {
    await page.keyboard.press('Escape');
  }

  // Fill quantity
  const qtyInput = page.locator('input[placeholder="0.000"]');
  await qtyInput.fill('5');
  await page.waitForTimeout(200);

  await snap(page, 'b-form-filled');

  // (d) Source = Destination error state
  // Set dest same as source
  const src = await selects.nth(0).inputValue();
  await selects.nth(1).selectOption(src);
  await page.waitForTimeout(300);
  await snap(page, 'd-source-eq-dest-error');

  // Fix dest back to different warehouse
  const destOptions = await selects.nth(1).locator('option').all();
  for (const opt of destOptions) {
    const val = await opt.getAttribute('value');
    if (val && val !== src && val !== '') {
      await selects.nth(1).selectOption(val);
      break;
    }
  }
  await page.waitForTimeout(200);

  // (f) Loading state — intercept the network to see spinner
  await page.route('**/api/transfers', async route => {
    if (route.request().method() === 'POST') {
      // Delay so we can screenshot the spinner
      await new Promise(r => setTimeout(r, 1500));
      route.continue();
    } else {
      route.continue();
    }
  });

  // Submit the form
  const submitBtn = page.locator('button[type="submit"]');
  submitBtn.click(); // Don't await — screenshot while in-flight
  await page.waitForTimeout(400);
  await snap(page, 'f-loading-spinner');

  // Wait for the submit to complete
  await page.waitForTimeout(1500);
  await page.unroute('**/api/transfers');
  await page.waitForTimeout(1000);
  console.log('✅ Transfer submitted');

  // (e) Success — form cleared + history updated
  await snap(page, 'e-after-success-history-updated');

  // (h) Insufficient stock — try to transfer more than available
  await selects.nth(0).selectOption({ index: 1 });
  await page.waitForTimeout(100);
  const destOpts = await selects.nth(1).locator('option').all();
  for (const opt of destOpts) {
    const val = await opt.getAttribute('value');
    const srcVal = await selects.nth(0).inputValue();
    if (val && val !== srcVal && val !== '') {
      await selects.nth(1).selectOption(val);
      break;
    }
  }
  await page.waitForTimeout(100);
  const cb2 = page.locator('button').filter({ hasText: /Search product|Пребарај производ/i }).first();
  await cb2.click();
  await page.waitForTimeout(300);
  const firstItem = page.locator('.absolute.z-50 button').first();
  if (await firstItem.count() > 0) await firstItem.click();
  await page.waitForTimeout(100);
  await page.locator('input[placeholder="0.000"]').fill('99999');
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(1500);
  await snap(page, 'h-insufficient-stock-error');
  console.log('✅ Insufficient stock error');

  // (g) Mobile 400px
  await page.setViewportSize({ width: 400, height: 812 });
  await page.waitForTimeout(600);
  await snap(page, 'g-mobile-400px');
  console.log('✅ Mobile view');

  await browser.close();
  console.log(`\n✅ All D.4 screenshots saved to: ${OUT}`);
})().catch(err => {
  console.error('SMOKE CRASHED:', err.message);
  process.exit(1);
});
