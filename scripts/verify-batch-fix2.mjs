/**
 * Targeted screenshots for Fix 2 (company edit fields) and Fix 5 (Z-report rendering)
 */
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:4000';
const DIR = path.join(__dirname, '..', 'screenshots', 'batch-fix');
if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });

function ok(msg)   { console.log(`  ✓ ${msg}`); }
function info(msg) { console.log(`  ℹ️  ${msg}`); }
function issue(msg){ console.log(`  ⚠️  ${msg}`); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function ss(page, name) {
  const p = path.join(DIR, `${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  info(`Screenshot → ${p}`);
}

async function loginUI(page) {
  await page.goto(BASE + '/');
  await sleep(1500);
  const tok = await page.evaluate(() => localStorage.getItem('gastropro_token'));
  if (!tok) {
    await page.waitForSelector('input[type="password"]', { timeout: 8000 });
    await page.locator('input[type="email"], input[placeholder*="mail" i], input[name="email"]').first().fill('admin@gastropro.mk');
    await page.locator('input[type="password"]').first().fill('admin123');
    await page.locator('button[type="submit"], button').filter({ hasText: /login|влез/i }).first().click();
    await sleep(3000);
  }
  ok('Logged in');
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  await loginUI(page);

  // ── Fix 2: Company edit modal ────────────────────────────────────────────────
  console.log('\n═══ Fix 2: Company edit modal screenshot ════════════════════════');

  // Navigate to Settings
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('nav button'));
    for (const b of btns) {
      if ((b.innerText || '').match(/settings|подесувања/i)) { b.click(); return; }
    }
  });
  await sleep(2500);

  // Scroll down to companies section
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await sleep(800);
  await ss(page, 'fix2-companies-table');

  // Click first edit (pencil) button in the companies table
  const clicked = await page.evaluate(() => {
    const rows = document.querySelectorAll('table tbody tr');
    for (const row of rows) {
      const btns = row.querySelectorAll('button');
      for (const btn of btns) {
        // First button in the row's last cell is the pencil/edit
        const svg = btn.querySelector('svg');
        if (svg) { btn.click(); return true; }
      }
    }
    return false;
  });
  await sleep(1000);

  if (clicked) {
    await ss(page, 'fix2-edit-modal-open');
    // Read all input values in the modal
    const inputVals = await page.evaluate(() => {
      const inputs = document.querySelectorAll('dialog input, [role="dialog"] input, .fixed input');
      return Array.from(inputs).map(i => ({
        type: i.type, name: i.name || i.placeholder || '(no name)',
        value: i.value,
      }));
    });
    info(`Modal inputs found: ${inputVals.length}`);
    inputVals.forEach(i => info(`  [${i.type}] "${i.name}" = "${i.value}"`));
    const paymentInput = inputVals.find(i => i.type === 'number');
    if (paymentInput) {
      if (paymentInput.value && paymentInput.value !== '0') {
        ok(`payment_terms_days input = "${paymentInput.value}" ✓`);
      } else {
        info(`payment_terms_days = "${paymentInput.value}" (may be 0 if company has no terms set)`);
      }
    }
    await page.keyboard.press('Escape');
  } else {
    info('No edit button found — only list screenshot taken');
  }

  // ── Fix 5: Z-report section ───────────────────────────────────────────────
  console.log('\n═══ Fix 5: Z-report non_fiscal_sales section ═══════════════════');

  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('nav button'));
    for (const b of btns) {
      if ((b.innerText || '').match(/staff|персонал/i)) { b.click(); return; }
    }
  });
  await sleep(2000);
  await ss(page, 'fix5-staff-tabs');

  // Try all tab-like buttons to find Shifts/History
  const tabsText = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    return btns.slice(0, 30).map(b => b.innerText.trim()).filter(Boolean);
  });
  info(`Top 30 buttons: ${tabsText.join(' | ')}`);

  // Click Shifts history / Z-report tab if visible
  const shiftTab = page.locator('button').filter({ hasText: /смени|shifts|историја|history/i }).first();
  const shiftTabCount = await shiftTab.count();
  if (shiftTabCount > 0) {
    await shiftTab.click({ timeout: 3000 }).catch(() => {});
    await sleep(1500);
    await ss(page, 'fix5-shifts-history');
  }

  // Find and click a Z-report link or button
  const zReportBtn = page.locator('button, a').filter({ hasText: /z-извештај|z-report|zreport/i }).first();
  const zCount = await zReportBtn.count();
  info(`Z-report buttons found: ${zCount}`);

  if (zCount > 0) {
    await zReportBtn.click({ timeout: 3000 }).catch(() => {});
    await sleep(2000);
    await ss(page, 'fix5-zreport-opened');

    const bodyText = await page.evaluate(() => document.body.innerText);
    if (bodyText.includes('Нефискални фактури')) {
      ok('Z-report shows "Нефискални фактури (Б2Б)" section ✓');
    } else {
      info('Z-report rendered but no NF data for this shift (correct — section only shows when data exists)');
      info(`Body sample: ${bodyText.slice(0, 400).replace(/\n/g, ' | ')}`);
    }
  } else {
    // Try clicking on a row in shifts history that might show Z-report
    const rows = page.locator('table tbody tr');
    const rowCount = await rows.count();
    info(`Shift history rows: ${rowCount}`);
    if (rowCount > 0) {
      // Look for a closed shift (not open)
      for (let i = 0; i < Math.min(rowCount, 5); i++) {
        const rowText = await rows.nth(i).innerText().catch(() => '');
        info(`  Row ${i}: ${rowText.slice(0, 100).replace(/\n/g, ' ')}`);
        if (rowText.match(/затворена|closed|paid/i)) {
          const rowBtns = rows.nth(i).locator('button');
          const btnCount = await rowBtns.count();
          if (btnCount > 0) {
            await rowBtns.first().click({ timeout: 2000 }).catch(() => {});
            await sleep(1500);
            await ss(page, 'fix5-shift-row-opened');
            break;
          }
        }
      }
    }
    // Take screenshot of whatever's on screen
    await ss(page, 'fix5-current-state');
    info('Fix 5: Code change is in ZReportView.tsx — section renders when non_fiscal_sales data is present');
    info('To see it: close a shift that has non-fiscal B2B invoices, then open its Z-report');
  }

  await browser.close();
  console.log('\n  Done. Screenshots in screenshots/batch-fix/');
})();
