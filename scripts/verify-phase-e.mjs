/**
 * Phase E verification: Z-report per-warehouse breakdown
 *
 * Current state:
 *  - Open shift: be1705a7
 *  - Table #1 (Главен магацин): open order 89f951f1 → pay fiscal
 *  - Table #3 (Летна тераса):   open order 0bfb2d29 → pay fiscal
 *  - Table #7 (Главен магацин): free → create + pay fiscal
 *  - Takeaway:                  create + pay fiscal
 *
 * Then close the shift and screenshot the Z-report.
 */
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:4000';
const BASE_API = `${BASE}/api`;
const DIR = path.join(__dirname, '..', 'screenshots', 'phase-e');
if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });

function ok(msg)   { console.log(`  ✓ ${msg}`); }
function info(msg) { console.log(`  ℹ️  ${msg}`); }
function issue(msg){ console.log(`  ⚠️  ${msg}`); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function api(tok, method, p, body) {
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
  // ── API login ──────────────────────────────────────────────────────────────
  const loginR = await api(null, 'POST', '/auth/login', { email: 'admin@gastropro.mk', password: 'admin123' });
  const tok = loginR.body?.token || loginR.body?.accessToken;
  if (!tok) { issue('Login failed'); process.exit(1); }
  ok('API login');

  // ── Confirm open shift ─────────────────────────────────────────────────────
  const shiftsR = await api(tok, 'GET', '/shifts?status=open&limit=1');
  const openShift = (shiftsR.body?.data || shiftsR.body || []).find(s => s.status === 'open');
  if (!openShift) { issue('No open shift found'); process.exit(1); }
  ok(`Open shift: ${openShift.id.slice(-8)}`);

  // ── Get menu items ─────────────────────────────────────────────────────────
  const menuR = await api(tok, 'GET', '/menu-items?limit=5');
  const items = menuR.body?.data || menuR.body || [];
  const item = items[0];
  if (!item) { issue('No menu items'); process.exit(1); }
  info(`Menu item: ${item.name} @ ${item.price} ден.`);

  // ── Pay table #1 order (Главен магацин) ────────────────────────────────────
  const pay1 = await api(tok, 'PUT', '/orders/89f951f1-d76a-453c-af8e-5fd75224b062', {
    status: 'paid', payment_method: 'cash',
  });
  if (pay1.status === 200) {
    ok('Table #1 (Главен магацин) → paid cash');
  } else {
    info(`Table #1 pay: ${pay1.status} ${JSON.stringify(pay1.body).slice(0, 100)}`);
  }

  // ── Pay table #3 order (Летна тераса) ─────────────────────────────────────
  const pay3 = await api(tok, 'PUT', '/orders/0bfb2d29-f0d5-4802-a06a-97581abfc6e2', {
    status: 'paid', payment_method: 'card',
  });
  if (pay3.status === 200) {
    ok('Table #3 (Летна тераса) → paid card');
  } else {
    info(`Table #3 pay: ${pay3.status} ${JSON.stringify(pay3.body).slice(0, 100)}`);
  }

  // ── Create + pay order on table #7 (Главен магацин, free) ─────────────────
  const TABLE7_ID = '91870cc8-0fbe-4024-8e5d-917e1d195eac'; // table #8 is occupied; get #7
  // Fetch tables to get table #7 id
  const tablesR = await api(tok, 'GET', '/tables');
  const t7 = (tablesR.body || []).find(t => String(t.number) === '7');
  if (t7) {
    const o7R = await api(tok, 'POST', '/orders', {
      table_id: t7.id, order_type: 'dine_in', guest_count: 2,
      items: [{ menu_item_id: item.id, name: item.name, quantity: 2, price: Number(item.price) }],
    });
    if (o7R.status === 201) {
      const pay7 = await api(tok, 'PUT', `/orders/${o7R.body.id}`, {
        status: 'paid', payment_method: 'cash',
      });
      ok(`Table #7 (Главен магацин) → order created + paid: ${pay7.status}`);
    } else {
      info(`Table #7 order: ${o7R.status} ${JSON.stringify(o7R.body).slice(0, 100)}`);
    }
  }

  // ── Create + pay takeaway order (no table → "Takeaway/Delivery" row) ───────
  const otR = await api(tok, 'POST', '/orders', {
    table_id: null, order_type: 'takeaway', guest_count: 1,
    items: [{ menu_item_id: item.id, name: item.name, quantity: 1, price: Number(item.price) }],
  });
  if (otR.status === 201) {
    const payt = await api(tok, 'PUT', `/orders/${otR.body.id}`, {
      status: 'paid', payment_method: 'cash',
    });
    ok(`Takeaway → order created + paid: ${payt.status}`);
  } else {
    info(`Takeaway order: ${otR.status} ${JSON.stringify(otR.body).slice(0, 100)}`);
  }

  // ── Verify what's now in the shift ────────────────────────────────────────
  const shiftOrdersR = await api(tok, 'GET', `/shifts/${openShift.id}/zreport`);
  if (shiftOrdersR.status === 200 && shiftOrdersR.body?.per_warehouse) {
    info('Z-report preview: per_warehouse data:');
    for (const w of shiftOrdersR.body.per_warehouse) {
      info(`  ${w.warehouse_name}: ${w.order_count} orders, ${w.subtotal} ден.`);
    }
  }

  // ── Close shift via API ───────────────────────────────────────────────────
  // Need the user who opened the shift
  const closeR = await api(tok, 'POST', `/shifts/${openShift.id}/close`, {
    actual_cash: 2000,
  });
  if (closeR.status === 200) {
    ok('Shift closed via API');
    // Check per_warehouse in generated Z-report
    const zd = closeR.body?.zreport_data;
    if (zd?.per_warehouse) {
      ok(`per_warehouse rows: ${zd.per_warehouse.length}`);
      for (const w of zd.per_warehouse) {
        info(`  ${w.warehouse_name} (main=${w.is_main}): ${w.order_count} orders, ${w.subtotal} ден. gross`);
      }
    } else {
      issue('per_warehouse missing from closed shift zreport_data');
      info(`Keys: ${zd ? Object.keys(zd).join(', ') : 'null'}`);
    }
  } else {
    issue(`Close shift failed: ${closeR.status} ${JSON.stringify(closeR.body).slice(0, 200)}`);
  }

  // ── Browser: screenshot the Z-report ──────────────────────────────────────
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 6000 } });
  const page = await ctx.newPage();

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
  ok('UI login');

  // Navigate Staff → Shift History → click first row (most recent = the one we just closed)
  await page.locator('nav button').filter({ hasText: /staff|персонал/i }).first().click({ timeout: 5000 });
  await sleep(2000);

  // Scroll to shift history section
  await page.evaluate(() => window.scrollTo(0, 99999));
  await sleep(800);

  const p1 = path.join(DIR, '1-staff-scrolled.png');
  await page.screenshot({ path: p1 });
  info(`→ ${p1}`);

  // Click first shift row
  const clickedRow = await page.evaluate(() => {
    const rows = document.querySelectorAll('table tbody tr');
    if (rows[0]) { rows[0].click(); return rows[0].innerText?.trim().slice(0, 80); }
    return null;
  });
  info(`Clicked row: "${clickedRow}"`);
  await sleep(3000);

  const bodyText = await page.evaluate(() => document.body.innerText);
  const hasPerWh = bodyText.includes('Поделба по локации') || bodyText.includes('Per-Location');
  const hasNF = bodyText.includes('Нефискални');

  if (hasPerWh) ok('Per-warehouse section visible ✓');
  else issue('Per-warehouse section NOT found');
  if (hasNF) ok('Non-fiscal section also present (separate)');

  // Full Z-report screenshot
  const p2 = path.join(DIR, '2-zreport-full.png');
  await page.screenshot({ path: p2 });
  info(`→ ${p2}`);

  await browser.close();
  console.log('\n  Phase E screenshots in screenshots/phase-e/');
})();
