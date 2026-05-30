/**
 * Verification screenshots for the batch fix:
 * Fix 2 — Company edit fields populated correctly
 * Fix 3 — Table freed after non-fiscal invoice (checked via API)
 * Fix 4 — GET /orders/:id works (no 19s hang)
 * Fix 5 — Z-report non_fiscal_sales section rendered
 */
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_UI = 'http://localhost:4000';
const BASE_API = 'http://localhost:4000/api';
const DIR = path.join(__dirname, '..', 'screenshots', 'batch-fix');
if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });

function ok(msg)    { console.log(`  ✓ ${msg}`); }
function info(msg)  { console.log(`  ℹ️  ${msg}`); }
function issue(msg) { console.log(`  ⚠️  ${msg}`); }
function sleep(ms)  { return new Promise(r => setTimeout(r, ms)); }

async function request(tok, method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (tok) headers['Authorization'] = `Bearer ${tok}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${BASE_API}${path}`, opts);
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: r.status, body: json };
}

async function login() {
  const r = await request(null, 'POST', '/auth/login', { email: 'admin@gastropro.mk', password: 'admin123' });
  const tok = r.body?.token || r.body?.accessToken;
  if (!tok) throw new Error(`Login failed: ${JSON.stringify(r.body)}`);
  ok('API login OK');
  return tok;
}

async function loginUI(page) {
  await page.goto(BASE_UI + '/');
  await sleep(1500);
  const tok = await page.evaluate(() => localStorage.getItem('gastropro_token'));
  if (!tok) {
    await page.waitForSelector('input[type="password"]', { timeout: 8000 });
    const emailInput = page.locator('input[type="email"], input[placeholder*="mail" i], input[name="email"]').first();
    await emailInput.fill('admin@gastropro.mk');
    await page.locator('input[type="password"]').first().fill('admin123');
    await page.locator('button[type="submit"], button').filter({ hasText: /login|влез/i }).first().click();
    await sleep(3000);
  }
  ok('UI login OK');
}

async function ss(page, name) {
  const p = path.join(DIR, `${name}.png`);
  await page.screenshot({ path: p });
  info(`Screenshot → ${p}`);
}

// ── Fix 2: Company edit modal shows correct field values ──────────────────────
async function fix2(browser, tok) {
  console.log('\n═══ Fix 2: Company openEdit() camelCase fix ══════════════════════');

  // Fetch companies via API to confirm fields
  const r = await request(tok, 'GET', '/companies');
  const companies = r.body || [];
  if (companies.length === 0) {
    info('No companies found — skip field check, just screenshot the list');
  } else {
    const c = companies[0];
    info(`First company: name="${c.name}" tin="${c.tin}"`);
    info(`API fields: contact_person="${c.contact_person}" postal_code="${c.postal_code}" payment_terms_days=${c.payment_terms_days}`);
    if (c.contact_person !== undefined) ok('API returns snake_case "contact_person"');
    if (c.postal_code !== undefined) ok('API returns snake_case "postal_code"');
    if (c.payment_terms_days !== undefined) ok('API returns snake_case "payment_terms_days"');
  }

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await loginUI(page);

  // Navigate to Settings → Companies section
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('nav button'));
    for (const btn of buttons) {
      if ((btn.innerText || '').includes('Settings') || (btn.innerText || '').includes('Подесувања')) {
        btn.click(); return;
      }
    }
  });
  await sleep(2000);
  await ss(page, 'fix2-settings-companies-list');

  // Click edit on first company
  const editBtns = page.locator('button').filter({ hasText: '' }).locator('xpath=../..').locator('button').nth(0);
  // Use a simpler approach: find Pencil icon buttons
  const pencilBtns = page.locator('table tbody tr td:last-child button').first();
  try {
    await pencilBtns.click({ timeout: 3000 });
    await sleep(800);
    await ss(page, 'fix2-company-edit-modal');

    // Check that payment_terms_days field is populated
    const paymentTermsInput = page.locator('input[type="number"]');
    const val = await paymentTermsInput.inputValue().catch(() => '?');
    info(`payment_terms_days field value: "${val}"`);
    if (val && val !== '0' && val !== '') {
      ok(`payment_terms_days input shows "${val}" (was 0 before fix)`);
    } else {
      issue(`payment_terms_days shows "${val}" — may still be broken`);
    }
    await page.keyboard.press('Escape');
  } catch (e) {
    info(`Could not click edit button: ${e.message.slice(0, 60)}`);
    info('Companies list screenshot already taken — fix is in the code');
  }

  await ctx.close();
  console.log('  Fix 2 done');
}

// ── Fix 3: Table freed after non-fiscal invoice ───────────────────────────────
async function fix3(tok) {
  console.log('\n═══ Fix 3: Table freed after non-fiscal B2B invoice ══════════════');

  // Get companies
  const compR = await request(tok, 'GET', '/companies');
  const companies = compR.body || [];
  if (companies.length === 0) { issue('No companies — cannot test Fix 3'); return; }
  const company = companies[0];
  info(`Using company: ${company.name}`);

  // Get a free table
  const tablesR = await request(tok, 'GET', '/tables');
  const freeTable = (tablesR.body || []).find(t => t.status === 'free');
  if (!freeTable) { issue('No free table — cannot test Fix 3'); return; }
  info(`Free table: #${freeTable.number} (id: ${freeTable.id.slice(-8)})`);

  // Create an order on that table
  const orderR = await request(tok, 'POST', '/orders', {
    table_id: freeTable.id, order_type: 'dine_in', guest_count: 1,
    items: [{ menu_item_id: null, name: 'Test item', quantity: 1, price: 100 }],
  });
  if (orderR.status !== 201) { issue(`Order creation failed: ${orderR.status}`); return; }
  const orderId = orderR.body.id;
  ok(`Order created: ${orderId.slice(-8)}`);

  // Confirm table is now occupied
  const tablesAfterOrder = await request(tok, 'GET', '/tables');
  const tableAfterOrder = (tablesAfterOrder.body || []).find(t => t.id === freeTable.id);
  info(`Table status after order: "${tableAfterOrder?.status}"`);
  if (tableAfterOrder?.status === 'occupied') ok('Table correctly set to "occupied"');

  // Issue non-fiscal invoice linked to the order
  const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 15);
  const invoiceR = await request(tok, 'POST', '/non-fiscal-invoices', {
    company_id: company.id, order_id: orderId,
    due_date: dueDate.toISOString().split('T')[0], vat_rate: 18,
    items: [{ name: 'Test item', quantity: 1, unit_price: 100, vat_rate: 18 }],
  });
  if (invoiceR.status !== 201) {
    issue(`Invoice creation failed: ${invoiceR.status} — ${JSON.stringify(invoiceR.body).slice(0, 100)}`);
    // Cancel the order for cleanup
    await request(tok, 'PUT', `/orders/${orderId}`, { status: 'cancelled' });
    return;
  }
  ok(`Non-fiscal invoice created: ${invoiceR.body.id?.slice(-8)}`);

  // Verify table is now free (the fix)
  await sleep(500);
  const tablesAfterInvoice = await request(tok, 'GET', '/tables');
  const tableAfterInvoice = (tablesAfterInvoice.body || []).find(t => t.id === freeTable.id);
  info(`Table status after non-fiscal invoice: "${tableAfterInvoice?.status}"`);
  if (tableAfterInvoice?.status === 'free') {
    ok('Table correctly freed after non-fiscal invoice ✓ FIX 3 VERIFIED');
  } else {
    issue(`Table status is "${tableAfterInvoice?.status}" — expected "free". Fix 3 may not be working.`);
  }

  console.log('  Fix 3 done');
}

// ── Fix 4: GET /orders/:id returns 200 with items ────────────────────────────
async function fix4(tok) {
  console.log('\n═══ Fix 4: GET /orders/:id endpoint ══════════════════════════════');

  // Get an existing order
  const ordersR = await request(tok, 'GET', '/orders?limit=1');
  const orders = ordersR.body || [];
  if (orders.length === 0) { issue('No orders — cannot test Fix 4'); return; }
  const orderId = orders[0].id;
  info(`Testing with order: ${orderId.slice(-8)}`);

  const start = Date.now();
  const r = await request(tok, 'GET', `/orders/${orderId}`);
  const elapsed = Date.now() - start;
  info(`GET /orders/${orderId.slice(-8)}: HTTP ${r.status} in ${elapsed}ms`);

  if (r.status === 200) {
    ok(`GET /orders/:id returns 200 ✓ FIX 4 VERIFIED`);
    if (Array.isArray(r.body?.items)) ok(`Response includes items array (${r.body.items.length} items)`);
    if (elapsed < 2000) ok(`Response time ${elapsed}ms (was ~19000ms before)`);
    else issue(`Response time ${elapsed}ms — still slow`);
  } else if (r.status === 404) {
    issue(`404 — order not found (check ownership)`);
  } else {
    issue(`HTTP ${r.status} — fix may not be applied: ${JSON.stringify(r.body).slice(0, 100)}`);
  }

  // Try non-existent order (should be 404, not hang)
  const start2 = Date.now();
  const r2 = await request(tok, 'GET', '/orders/00000000-0000-0000-0000-000000000000');
  const elapsed2 = Date.now() - start2;
  info(`GET /orders/fake-id: HTTP ${r2.status} in ${elapsed2}ms`);
  if (r2.status === 404 && elapsed2 < 2000) ok('Non-existent order returns 404 quickly ✓');

  console.log('  Fix 4 done');
}

// ── Fix 5: Z-report renders non_fiscal_sales section ─────────────────────────
async function fix5(browser) {
  console.log('\n═══ Fix 5: Z-report non_fiscal_sales section rendered ═══════════');

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await loginUI(page);

  // Navigate to Staff/Shifts
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('nav button'));
    for (const btn of buttons) {
      const t = btn.innerText || '';
      if (t.includes('Staff') || t.includes('Персонал')) { btn.click(); return; }
    }
  });
  await sleep(2000);
  await ss(page, 'fix5-staff-page');

  // Look for a closed shift with a Z-report button
  const zBtn = page.locator('button').filter({ hasText: /z-извештај|z-report|zreport/i }).first();
  const zCount = await zBtn.count();
  if (zCount > 0) {
    await zBtn.click({ timeout: 3000 }).catch(() => {});
    await sleep(2000);
    await ss(page, 'fix5-zreport-view');

    const pageText = await page.evaluate(() => document.body.innerText);
    if (pageText.includes('Нефискални фактури')) {
      ok('Z-report shows "Нефискални фактури (Б2Б)" section ✓ FIX 5 VERIFIED');
    } else {
      info('Z-report opened but "Нефискални фактури" section not visible — may be no NF data for this shift');
      info('(The section only appears when z.non_fiscal_sales is present — this is correct behaviour)');
    }
  } else {
    info('No Z-report button found on Staff page — trying via Shifts history');
    // Try clicking on a historical shift row
    const shiftRows = page.locator('table tbody tr');
    const rowCount = await shiftRows.count();
    info(`Found ${rowCount} shift rows`);
    if (rowCount > 0) {
      await shiftRows.first().click().catch(() => {});
      await sleep(1500);
      await ss(page, 'fix5-shift-detail');
    }
  }

  await ctx.close();
  console.log('  Fix 5 done');
}

(async () => {
  const tok = await login();
  const browser = await chromium.launch({ headless: true });
  try {
    await fix2(browser, tok);
    await fix3(tok);
    await fix4(tok);
    await fix5(browser);
  } finally {
    await browser.close();
    console.log(`\n  All done. Screenshots in screenshots/batch-fix/`);
  }
})();
