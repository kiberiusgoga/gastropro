import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'tmp-screenshots', 'd5');
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

  page.on('console', msg => { if (msg.type() === 'error') console.log('CONSOLE ERR:', msg.text()); });

  // Login
  await page.goto(`${BASE}/`);
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"]', 'admin@gastropro.mk');
  await page.fill('input[type="password"]', 'admin123');
  await Promise.all([page.waitForLoadState('networkidle'), page.click('button[type="submit"]')]);
  await page.waitForTimeout(1200);
  console.log('✅ Logged in');

  // (a) Dashboard full — CriticalAlertsSection visible (if out-of-stock items exist) + login toast
  await snap(page, 'a-dashboard-with-alerts');
  console.log('✅ (a) Dashboard with alerts / login toast');

  // Dismiss any toast
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  // (b) Check sidebar for rose badge on Stock item (scroll to see MANAGEMENT group)
  await snap(page, 'b-sidebar-stock-badge');
  console.log('✅ (b) Sidebar stock badge');

  // (c) Navigate to Stock Dashboard
  await page.locator('nav button').filter({ hasText: /Залиха|Stock/i }).first().click();
  await page.waitForTimeout(2000);
  await snap(page, 'c-stock-dashboard');
  console.log('✅ (c) Stock Dashboard');

  // (d) Navigate to Transfers — test Cyrillic search in ProductCombobox
  await page.locator('nav button').filter({ hasText: /Трансфер|Transfer/i }).first().click();
  await page.waitForTimeout(2000);

  // Wait for warehouse selects to be populated
  await page.waitForFunction(() => {
    const selects = document.querySelectorAll('select');
    return selects.length >= 2 && selects[0].options.length > 1;
  }, { timeout: 10000 }).catch(() => console.log('⚠️  selects not populated'));

  await page.waitForTimeout(300);

  // Open ProductCombobox and type Cyrillic
  const comboBtn = page.locator('button').filter({ hasText: /Пребарај|Search product/i }).first();
  if (await comboBtn.count() > 0) {
    await comboBtn.click();
    await page.waitForTimeout(300);
    // Type Cyrillic search term
    const searchInput = page.locator('.absolute.z-50 input').first();
    if (await searchInput.count() > 0) {
      await searchInput.fill('Пар');
      await page.waitForTimeout(300);
    } else {
      await page.keyboard.type('Пар');
      await page.waitForTimeout(300);
    }
    await snap(page, 'd-combobox-cyrillic-search');
    console.log('✅ (d) ProductCombobox Cyrillic search');
    await page.keyboard.press('Escape');
  } else {
    await snap(page, 'd-transfers-page');
    console.log('✅ (d) Transfers page (combobox not found)');
  }

  // (e) Transfers page full view
  await snap(page, 'e-transfers-page-full');
  console.log('✅ (e) Transfers page full');

  // (f) Test insufficient stock error — fill a transfer with huge quantity
  const selects = page.locator('select');
  const selectCount = await selects.count();
  if (selectCount >= 2) {
    await selects.nth(0).selectOption({ index: 1 });
    await page.waitForTimeout(200);
    const destOpts = await selects.nth(1).locator('option').all();
    const srcVal = await selects.nth(0).inputValue();
    for (const opt of destOpts) {
      const val = await opt.getAttribute('value');
      if (val && val !== srcVal && val !== '') {
        await selects.nth(1).selectOption(val);
        break;
      }
    }
    await page.waitForTimeout(100);

    // Pick a product from combobox
    const cb = page.locator('button').filter({ hasText: /Пребарај|Search product/i }).first();
    if (await cb.count() > 0) {
      await cb.click();
      await page.waitForTimeout(500);
      // Clear search to show all products
      const searchInput = page.locator('.absolute.z-50 input').first();
      if (await searchInput.count() > 0) {
        await searchInput.fill('');
        await page.waitForTimeout(200);
      }
      const firstItem = page.locator('.absolute.z-50 button').first();
      if (await firstItem.count() > 0) {
        await firstItem.click();
        await page.waitForTimeout(300);
        // Now enter huge quantity
        const qtyInput = page.locator('input[placeholder="0.000"]');
        await qtyInput.fill('99999');
        await page.waitForTimeout(100);
        // Submit should now be enabled
        const submitBtn = page.locator('button[type="submit"]');
        const isDisabled = await submitBtn.getAttribute('disabled');
        if (isDisabled === null) {
          await submitBtn.click();
          await page.waitForTimeout(2000);
          await snap(page, 'f-insufficient-stock-error');
          console.log('✅ (f) Insufficient stock error (improved message)');
        } else {
          await snap(page, 'f-form-not-ready');
          console.log('⚠️  (f) submit still disabled, took form screenshot');
        }
      } else {
        await page.keyboard.press('Escape');
        await snap(page, 'f-no-products-in-combobox');
        console.log('⚠️  (f) no products in combobox');
      }
    } else {
      await snap(page, 'f-transfers-form');
      console.log('⚠️  (f) combobox not found');
    }
  } else {
    await snap(page, 'f-transfers-no-selects');
    console.log('⚠️  (f) selects not found');
  }

  // (g) Dashboard — verify CriticalAlertsSection auto-hides when empty
  // Navigate back to dashboard to see current state
  await page.locator('nav button').filter({ hasText: /Контролна|Dashboard/i }).first().click();
  await page.waitForTimeout(2000);
  await snap(page, 'g-dashboard-after-transfer');
  console.log('✅ (g) Dashboard (CriticalAlertsSection state after transfer)');

  // (h) Mobile 400px
  await page.setViewportSize({ width: 400, height: 812 });
  await page.goto(`${BASE}/`);
  await page.waitForLoadState('networkidle');
  // Already logged in via cookie/session? If not, re-login
  const emailField = await page.locator('input[type="email"]').count();
  if (emailField > 0) {
    await page.fill('input[type="email"]', 'admin@gastropro.mk');
    await page.fill('input[type="password"]', 'admin123');
    await Promise.all([page.waitForLoadState('networkidle'), page.click('button[type="submit"]')]);
  }
  await page.waitForTimeout(1200);
  await snap(page, 'h-mobile-400px');
  console.log('✅ (h) Mobile 400px');

  await browser.close();
  console.log(`\n✅ All D.5 screenshots saved to: ${OUT}`);
})().catch(err => {
  console.error('SMOKE CRASHED:', err.message);
  process.exit(1);
});
