/**
 * Captures POS payment modal — all 4 options + Фактура company selector
 */
import { chromium } from 'playwright';
import fs from 'fs';

const OUT = 'screenshots/feature-2';
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

async function getToken(page) {
  return page.evaluate(() => localStorage.getItem('gastropro_token'));
}
async function apiGet(page, path) {
  const tok = await getToken(page);
  return page.evaluate(async ([url, t]) => {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${t}` } });
    return r.json();
  }, [`${BASE}/api${path}`, tok]);
}
async function apiPost(page, path, body) {
  const tok = await getToken(page);
  return page.evaluate(async ([url, b, t]) => {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }, body: JSON.stringify(b) });
    return r.json();
  }, [`${BASE}/api${path}`, body, tok]);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1400, height: 900 });
  await login(page);
  console.log('Logged in');

  // Get active shift
  const shifts = await apiGet(page, '/shifts/active');
  console.log('Active shift:', shifts?.id ?? 'none');

  // Get tables
  const tables = await apiGet(page, '/tables');
  console.log('Tables:', tables?.length ?? 0);

  // Find a table with an open order, or use first table
  const openOrders = await apiGet(page, '/orders?status=open');
  console.log('Open orders:', openOrders?.length ?? 0);

  // Navigate to the Tables/POS view by clicking the sidebar button directly
  // The button text changes by language — try all known labels
  const sidebarBtn = page.locator('nav button, aside button').filter({
    hasText: /^(Маси|Tables|Tavolina)$/i
  }).first();
  await sidebarBtn.click({ timeout: 5000 });
  await page.waitForTimeout(2500);
  console.log('Navigated to POS tables view');

  // Now click a table that has an open order (look for non-empty tables)
  // In the POS, occupied tables are typically rendered with a coloured background
  // Try clicking tables by name/number from the open orders list
  let payBtnVisible = false;

  // Strategy: click any visible table button
  const allButtons = await page.locator('button').all();
  for (const btn of allButtons) {
    try {
      const txt = (await btn.innerText()).trim();
      // Table buttons are short labels like "1", "2", "Маса 1", etc.
      // Skip long texts (nav items, action buttons)
      if (!txt || txt.length > 20) continue;
      // Skip known non-table buttons
      if (/logout|settings|inventory|staff|crm|orders|kitchen|menu|billing|transfers|stock|маси|tables|invoices|фактури/i.test(txt)) continue;

      await btn.click({ timeout: 1000 });
      await page.waitForTimeout(700);

      // Check if pay button appeared in the right panel
      const pay = page.locator('button').filter({ hasText: /Плаќање/i }).first();
      if (await pay.isVisible({ timeout: 500 })) {
        payBtnVisible = true;
        console.log(`Opened table: "${txt}"`);
        break;
      }
    } catch { /* skip */ }
  }

  if (!payBtnVisible) {
    // Fallback: if no order exists on a table, create one via API and reload
    if (openOrders?.length > 0 && tables?.length > 0) {
      const orderId = openOrders[0].id;
      const tableId = openOrders[0].table_id;
      console.log('Trying to force-select table from order:', tableId);
      // Try clicking each table cell regardless
      const tableCells = await page.locator('[data-table-id], [id*="table"]').all();
      for (const cell of tableCells) {
        try {
          await cell.click({ timeout: 1000 });
          await page.waitForTimeout(500);
          const pay = page.locator('button').filter({ hasText: /Плаќање/i }).first();
          if (await pay.isVisible({ timeout: 500 })) { payBtnVisible = true; break; }
        } catch {}
      }
    }

    if (!payBtnVisible) {
      await page.screenshot({ path: `${OUT}/f2-pos-debug-nomatch.png` });
      console.error('Could not find a table with an open order. Debug screenshot saved.');
      await browser.close();
      process.exit(1);
    }
  }

  // Open the payment modal
  await page.locator('button').filter({ hasText: /Плаќање/i }).first().click();
  await page.waitForTimeout(800);

  // ── Screenshot A: All 4 payment options ──────────────────────────────────
  await page.screenshot({ path: `${OUT}/f2-pos-a-payment-4-options.png` });
  console.log('A: Payment modal showing Готовина / Картичка / Мешано / Фактура');

  // Click Фактура
  await page.locator('button').filter({ hasText: /^Фактура$/ }).first().click();
  await page.waitForTimeout(600);

  // ── Screenshot B: Company selector ───────────────────────────────────────
  await page.screenshot({ path: `${OUT}/f2-pos-b-invoice-company-selector.png` });
  console.log('B: Фактура selected — company selector + Издај фактура button');

  await browser.close();
  console.log('Done');
}

main().catch(err => { console.error(err); process.exit(1); });
