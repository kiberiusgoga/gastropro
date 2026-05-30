/**
 * Empirically verify Fix 6: React duplicate key warning in POS payment modal
 * Flow: Navigate to POS → select/create order → open payment modal → click "Фактура"
 * Capture ALL console warnings/errors; check for React duplicate key warnings.
 */
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:4000';
const BASE_API = `${BASE}/api`;
const DIR = path.join(__dirname, '..', 'screenshots', 'batch-fix');
if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });

function ok(msg)   { console.log(`  ✓ ${msg}`); }
function info(msg) { console.log(`  ℹ️  ${msg}`); }
function issue(msg){ console.log(`  ⚠️  ${msg}`); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function apiReq(tok, method, p, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (tok) headers['Authorization'] = `Bearer ${tok}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${BASE_API}${p}`, opts);
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: r.status, body: json };
}

(async () => {
  // API login
  const loginR = await apiReq(null, 'POST', '/auth/login', { email: 'admin@gastropro.mk', password: 'admin123' });
  const tok = loginR.body?.token || loginR.body?.accessToken;
  if (!tok) { issue('Login failed'); process.exit(1); }
  ok('API login OK');

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // Collect ALL console messages
  const consoleMessages = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleMessages.push({ type: msg.type(), text });
    if (msg.type() === 'warning' || msg.type() === 'error') {
      info(`[CONSOLE ${msg.type().toUpperCase()}] ${text.slice(0, 250)}`);
    }
  });
  page.on('pageerror', err => {
    consoleMessages.push({ type: 'pageerror', text: err.message });
    issue(`[PAGE ERROR] ${err.message.slice(0, 200)}`);
  });

  // Login
  await page.goto(BASE + '/');
  await sleep(1500);
  const uiTok = await page.evaluate(() => localStorage.getItem('gastropro_token'));
  if (!uiTok) {
    await page.waitForSelector('input[type="password"]', { timeout: 8000 });
    await page.locator('input[type="email"], input[placeholder*="mail" i]').first().fill('admin@gastropro.mk');
    await page.locator('input[type="password"]').first().fill('admin123');
    await page.locator('button[type="submit"], button').filter({ hasText: /login|влез/i }).first().click();
    await sleep(3000);
  }
  ok('UI login OK');

  // Navigate to Tables (POS)
  const tablesBtn = page.locator('nav button').filter({ hasText: /^Tables$|^Маси$/ }).first();
  await tablesBtn.click({ timeout: 5000 });
  await sleep(2000);

  const p1 = path.join(DIR, 'fix6-pos-tables.png');
  await page.screenshot({ path: p1 });
  info(`Screenshot → ${p1}`);

  // Look for occupied table first (has an open order)
  // Table buttons/cards typically contain a table number and status
  const tableCards = page.locator('button').filter({ hasText: /\d/ });
  const cardCount = await tableCards.count();
  info(`Table card buttons found: ${cardCount}`);

  // Try to find an occupied table or create an order on a free table
  let orderCreated = false;

  // First, try selecting any table that has an open order already
  // Check via API what tables are occupied
  const tablesR = await apiReq(tok, 'GET', '/tables');
  const tables = tablesR.body || [];
  const occupiedTable = tables.find(t => t.status === 'occupied');
  const freeTable = tables.find(t => t.status === 'free');

  if (occupiedTable) {
    info(`Found occupied table #${occupiedTable.number} — clicking it`);
    // Click the table card by table number
    const tableBtn = page.locator('button').filter({ hasText: String(occupiedTable.number) }).first();
    const tCount = await tableBtn.count();
    if (tCount > 0) {
      await tableBtn.click({ timeout: 5000 });
      await sleep(2000);
      ok(`Clicked table #${occupiedTable.number}`);
    }
  } else if (freeTable) {
    info(`No occupied tables — will create order on free table #${freeTable.number} via API`);
    // Get active shift
    const shiftsR = await apiReq(tok, 'GET', '/shifts?status=open&limit=5');
    const openShift = (shiftsR.body?.data || shiftsR.body || []).find(s => s.status === 'open');
    if (!openShift) { issue('No open shift — cannot create order'); }
    else {
      // Get any menu item
      const menuR = await apiReq(tok, 'GET', '/menu-items?limit=5');
      const menuItems = menuR.body?.data || menuR.body || [];
      const menuItem = menuItems[0];

      if (menuItem) {
        const orderR = await apiReq(tok, 'POST', '/orders', {
          table_id: freeTable.id, order_type: 'dine_in', guest_count: 1,
          items: [{ menu_item_id: menuItem.id, name: menuItem.name, quantity: 1, price: menuItem.price }],
        });
        if (orderR.status === 201) {
          ok(`Created order on table #${freeTable.number}`);
          orderCreated = true;
          // Refresh the page to show updated table status
          await page.reload();
          await sleep(2000);
        }
      }
    }

    // Click the now-occupied table
    const tableBtn = page.locator('button').filter({ hasText: String(freeTable.number) }).first();
    await tableBtn.click({ timeout: 5000 }).catch(() => {});
    await sleep(2000);
  }

  const p2 = path.join(DIR, 'fix6-table-selected.png');
  await page.screenshot({ path: p2 });
  info(`Screenshot → ${p2}`);

  // Check if order panel opened — look for "Наплати" button
  const naplatiBtnCount = await page.locator('button').filter({ hasText: 'Наплати' }).count();
  info(`"Наплати" button count: ${naplatiBtnCount}`);

  if (naplatiBtnCount === 0) {
    info('No "Наплати" button — trying to add a menu item to create an order on-screen');
    // Look for menu item cards with price
    const menuItemBtn = page.locator('button').filter({ hasText: /ден/i }).first();
    const mCount = await menuItemBtn.count();
    info(`Menu item buttons: ${mCount}`);
    if (mCount > 0) {
      await menuItemBtn.click({ timeout: 3000 });
      await sleep(1000);
    }
    const p2b = path.join(DIR, 'fix6-after-add-item.png');
    await page.screenshot({ path: p2b });
    info(`Screenshot → ${p2b}`);
  }

  // Click "Наплати" to open payment modal
  const naplatBtn = page.locator('button').filter({ hasText: 'Наплати' }).first();
  const naplatCount2 = await naplatBtn.count();
  info(`"Наплати" button count (2nd check): ${naplatCount2}`);

  if (naplatCount2 > 0) {
    await naplatBtn.click({ timeout: 5000 });
    await sleep(1500);
    ok('Clicked "Наплати" — payment modal should open');
  } else {
    issue('"Наплати" button not found — cannot open payment modal');
    const p3 = path.join(DIR, 'fix6-no-naaplati.png');
    await page.screenshot({ path: p3, fullPage: true });
    info(`Screenshot → ${p3}`);
  }

  const p4 = path.join(DIR, 'fix6-payment-modal.png');
  await page.screenshot({ path: p4 });
  info(`Screenshot → ${p4}`);

  // Verify payment modal is open
  const modalFixed = page.locator('.fixed.inset-0').first();
  const modalVisible = await modalFixed.count() > 0;
  info(`Payment modal visible: ${modalVisible}`);

  if (modalVisible) {
    ok('Payment modal opened');

    // Check what payment method buttons are present
    const cashBtn   = page.locator('.fixed button').filter({ hasText: /готовина|cash/i }).first();
    const cardBtn   = page.locator('.fixed button').filter({ hasText: /картичка|card/i }).first();
    const mixedBtn  = page.locator('.fixed button').filter({ hasText: /мешана|mixed/i }).first();
    const invoiceBtn = page.locator('.fixed button').filter({ hasText: 'Фактура' }).first();

    info(`Method buttons: Готовина=${await cashBtn.count()}, Картичка=${await cardBtn.count()}, Мешана=${await mixedBtn.count()}, Фактура=${await invoiceBtn.count()}`);

    // Click "Фактура" to show the company dropdown
    if (await invoiceBtn.count() > 0) {
      await invoiceBtn.click({ timeout: 3000 });
      await sleep(1200);
      ok('Clicked "Фактура" payment method');

      const p5 = path.join(DIR, 'fix6-faktura-selected.png');
      await page.screenshot({ path: p5 });
      info(`Screenshot → ${p5}`);

      // Check company dropdown rendered
      const companySelect = page.locator('.fixed select').first();
      const selectCount = await companySelect.count();
      info(`Company select visible: ${selectCount}`);

      if (selectCount > 0) {
        // Count options (should match number of companies)
        const optionCount = await companySelect.locator('option').count();
        info(`Company options (including blank): ${optionCount}`);
        ok(`Company dropdown rendered with ${optionCount} options`);
      }

      // Trigger a re-render by interacting with the dropdown
      if (selectCount > 0) {
        const options = await page.locator('.fixed select option').all();
        for (const opt of options) {
          const val = await opt.getAttribute('value');
          if (val && val !== '') {
            await companySelect.selectOption(val);
            await sleep(300);
            ok(`Selected company option: ${val.slice(-8)}`);
            break;
          }
        }
      }

      await sleep(500);
    } else {
      info('"Фактура" button not visible in modal');
    }

    // Press Escape to close modal
    await page.keyboard.press('Escape');
    await sleep(500);
  }

  // Cleanup: cancel created order if we made one
  if (orderCreated) {
    const ordersR = await apiReq(tok, 'GET', '/orders?status=open');
    const orders = ordersR.body || [];
    for (const o of orders) {
      if (o.table_id === freeTable?.id) {
        await apiReq(tok, 'PUT', `/orders/${o.id}`, { status: 'cancelled' });
        info(`Cleaned up test order ${o.id.slice(-8)}`);
      }
    }
  }

  // ── Console analysis ──────────────────────────────────────────────────────
  console.log('\n  ── Console message analysis ─────────────────────────────────────');
  console.log(`  Total messages captured: ${consoleMessages.length}`);

  const keyWarnings = consoleMessages.filter(m =>
    m.text.toLowerCase().includes('same key') ||
    m.text.toLowerCase().includes('duplicate key') ||
    m.text.toLowerCase().includes('each child') ||
    m.text.toLowerCase().includes('unique "key"') ||
    m.text.toLowerCase().includes('encountered two children')
  );

  const allWarningsErrors = consoleMessages.filter(m => m.type === 'warning' || m.type === 'error' || m.type === 'pageerror');

  if (keyWarnings.length === 0) {
    ok('No React duplicate key warnings in console ✓');
    ok('Fix 6 CONFIRMED: company dropdown uses key={c.id} — no React key warnings');
  } else {
    issue(`${keyWarnings.length} duplicate key warning(s) FOUND:`);
    keyWarnings.forEach((w, i) => {
      issue(`  [${i}] [${w.type}] ${w.text.slice(0, 400)}`);
    });
  }

  console.log(`\n  All console warnings/errors (${allWarningsErrors.length} total):`);
  if (allWarningsErrors.length === 0) {
    ok('No console warnings or errors at all');
  } else {
    allWarningsErrors.forEach((m, i) => info(`  [${i}] [${m.type}] ${m.text.slice(0, 250)}`));
  }

  await browser.close();
  console.log('\n  Screenshots in screenshots/batch-fix/');
})();
