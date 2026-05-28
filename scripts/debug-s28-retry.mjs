/**
 * S28 retry — Stock deduction + supplier consumption delta verification.
 * Uses delays to avoid 429 from prior script's API calls.
 */
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:4000';

function ok(msg) { console.log(`  ✓ ${msg}`); }
function info(msg) { console.log(`  ℹ️  ${msg}`); }
function issue(msg, sev) { console.log(`  ⚠️  [${sev}] ${msg}`); }

async function api(page, method, urlPath, body) {
  const tok = await page.evaluate(() => localStorage.getItem('gastropro_token'));
  return page.evaluate(async ([url, m, b, t]) => {
    const opts = { method: m, headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' } };
    if (b) opts.body = JSON.stringify(b);
    const r = await fetch(url, opts);
    const text = await r.text();
    try { return { status: r.status, body: JSON.parse(text) }; }
    catch { return { status: r.status, body: text }; }
  }, [`${BASE}/api${urlPath}`, method, body, tok]);
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Login
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(2000);
  // Use the UI login form
  try {
    await page.waitForSelector('input[type="password"]', { timeout: 10000 });
    await page.locator('input[type="email"], input[type="text"]').first().fill('admin@gastropro.mk');
    await page.locator('input[type="password"]').first().fill('admin123');
    await page.locator('button').filter({ hasText: /^LOGIN$|^ВЛЕЗ$/i }).first().click();
    await page.waitForTimeout(3000);
  } catch {
    // Already logged in or different flow
  }
  const tok = await page.evaluate(() => localStorage.getItem('gastropro_token'));
  if (!tok) {
    console.log('Login failed — no token in localStorage');
    await browser.close();
    process.exit(1);
  }
  ok('Logged in');

  // Constants from pre-research
  const VIENSKA_SNICLA_ID = 'a74514c9-19a8-4bd2-9a3b-0071c2bbe25d';
  const SVINSKO_PRODUCT_ID = '75e7fb33-e4d4-48b7-bee3-8e4dc4333cf2';
  const MASLO_PRODUCT_ID   = '4a581c68-6a53-482d-a1dc-254f7d7a5f18';
  // Recipe: 300g Свинско @ 250 MKD/kg = 75 MKD; 100ml Масло @ 120 MKD/l = 12 MKD per portion
  // 2× portions: Фрикомерц +150 MKD, Виталиа +24 MKD

  console.log('\n═══ S28: Stock deduction + supplier consumption ═══════════════');

  // Step 1: Get open shift
  await sleep(2000); // let rate limiter cool down
  const shiftsRes = await api(page, 'GET', '/shifts?status=open&limit=5');
  const openShift = (shiftsRes.body?.data || shiftsRes.body || []).find(s => s.status === 'open');
  if (!openShift) {
    issue('No open shift found', 'P2');
    await browser.close();
    process.exit(1);
  }
  const shiftId = openShift.id;
  info(`Open shift: ${shiftId.slice(-8)}`);

  // Step 2: Snapshot consumption BEFORE
  await sleep(500);
  const beforeRes = await api(page, 'GET', `/supplier-consumption?shiftId=${shiftId}`);
  const beforeSuppliers = beforeRes.body || [];
  const beforeFrikomerc = beforeSuppliers.find(s => s.supplier_name === 'Фрикомерц');
  const beforeVitalia   = beforeSuppliers.find(s => s.supplier_name === 'Виталиа');
  const beforeFrTotal = parseFloat(beforeFrikomerc?.total_value || 0);
  const beforeVtTotal = parseFloat(beforeVitalia?.total_value || 0);
  console.log(`  Before snapshot: Фрикомерц=${beforeFrTotal}, Виталиа=${beforeVtTotal}`);
  if (beforeFrikomerc) {
    const svProduct = beforeFrikomerc.products?.find(p => p.product_id === SVINSKO_PRODUCT_ID);
    if (svProduct) info(`  Before Свинско: qty=${svProduct.quantity}, total=${svProduct.total}`);
  }
  if (beforeVitalia) {
    const maProduct = beforeVitalia.products?.find(p => p.product_id === MASLO_PRODUCT_ID);
    if (maProduct) info(`  Before Масло: qty=${maProduct.quantity}, total=${maProduct.total}`);
  }

  // Step 3: Find a free table
  await sleep(500);
  const tablesRes = await api(page, 'GET', '/tables');
  const freeTable = (tablesRes.body || []).find(t => t.status === 'free');
  if (!freeTable) {
    issue('No free table', 'P2');
    await browser.close();
    process.exit(1);
  }
  info(`Using table ${freeTable.number} (id: ${freeTable.id.slice(-8)})`);

  // Step 4: Create order with 2× vienska snicla
  await sleep(500);
  const orderRes = await api(page, 'POST', '/orders', {
    table_id: freeTable.id,
    order_type: 'dine_in',
    guest_count: 2,
    items: [{ menu_item_id: VIENSKA_SNICLA_ID, name: 'vienska snicla', quantity: 2, price: 410 }],
  });
  if (orderRes.status !== 201) {
    issue(`Order creation failed: HTTP ${orderRes.status} — ${JSON.stringify(orderRes.body).slice(0, 100)}`, 'P1');
    await browser.close();
    process.exit(1);
  }
  const orderId = orderRes.body.id;
  ok(`Order created: ${orderId.slice(-8)} with 2× vienska snicla`);

  // Step 5: Fetch order detail to get item ID (with retry on 429)
  let sniclaItem = null;
  for (let attempt = 1; attempt <= 4; attempt++) {
    await sleep(1500 * attempt);
    const orderDetail = await api(page, 'GET', `/orders/${orderId}`);
    if (orderDetail.status === 200) {
      sniclaItem = (orderDetail.body?.items || []).find(i => i.menu_item_id === VIENSKA_SNICLA_ID);
      if (sniclaItem) break;
      info(`Attempt ${attempt}: items in order: ${orderDetail.body?.items?.length ?? 'unknown'}, looking for ${VIENSKA_SNICLA_ID}`);
      const itemIds = (orderDetail.body?.items || []).map(i => `${i.name}(${i.menu_item_id?.slice(-8)})`);
      info(`  Item IDs: ${itemIds.join(', ')}`);
    } else if (orderDetail.status === 429) {
      info(`Attempt ${attempt}: 429 rate limit — waiting longer...`);
    } else {
      info(`Attempt ${attempt}: HTTP ${orderDetail.status}`);
    }
  }

  if (!sniclaItem) {
    issue('"vienska snicla" item not found in order after retries', 'P1');
    await browser.close();
    process.exit(1);
  }
  ok(`Order item: ${sniclaItem.id.slice(-8)}, qty=${sniclaItem.quantity}, name="${sniclaItem.name}"`);

  // Step 6: Mark item as "ready" → triggers deductForOrderItem()
  await sleep(500);
  const readyRes = await api(page, 'PUT', `/orders/${orderId}/items/${sniclaItem.id}`, { status: 'ready' });
  console.log(`  Mark-ready: HTTP ${readyRes.status}`);
  if (readyRes.status !== 200) {
    issue(`Mark-ready failed: ${readyRes.status} — ${JSON.stringify(readyRes.body).slice(0, 200)}`, 'P1');
    await browser.close();
    process.exit(1);
  }
  ok('Item marked ready — stock deduction should have run');

  // Step 7: Snapshot consumption AFTER (with short wait for DB write)
  await sleep(1500);
  const afterRes = await api(page, 'GET', `/supplier-consumption?shiftId=${shiftId}`);
  const afterSuppliers = afterRes.body || [];
  const afterFrikomerc = afterSuppliers.find(s => s.supplier_name === 'Фрикомерц');
  const afterVitalia   = afterSuppliers.find(s => s.supplier_name === 'Виталиа');
  const afterFrTotal = parseFloat(afterFrikomerc?.total_value || 0);
  const afterVtTotal = parseFloat(afterVitalia?.total_value || 0);
  console.log(`  After snapshot: Фрикомерц=${afterFrTotal}, Виталиа=${afterVtTotal}`);

  // Step 8: Verify deltas
  const deltaFr = afterFrTotal - beforeFrTotal;
  const deltaVt = afterVtTotal - beforeVtTotal;
  const expectedFr = 150; // 2 × 300g × 250 MKD/kg = 150 MKD
  const expectedVt = 24;  // 2 × 100ml × 120 MKD/l = 24 MKD

  console.log(`\n  Delta Фрикомерц: ${deltaFr.toFixed(2)} (expected: ${expectedFr})`);
  console.log(`  Delta Виталиа:   ${deltaVt.toFixed(2)} (expected: ${expectedVt})`);

  if (Math.abs(deltaFr - expectedFr) < 0.01) {
    ok(`Фрикомерц delta = ${deltaFr} MKD ✓ (2 × 0.3kg × 250 MKD/kg = 150 MKD)`);
  } else {
    issue(`Фрикомерц delta = ${deltaFr} (expected ${expectedFr}) — stock deduction math wrong`, 'P1');
  }

  if (Math.abs(deltaVt - expectedVt) < 0.01) {
    ok(`Виталиа delta = ${deltaVt} MKD ✓ (2 × 0.1l × 120 MKD/l = 24 MKD)`);
  } else {
    issue(`Виталиа delta = ${deltaVt} (expected ${expectedVt}) — stock deduction math wrong`, 'P1');
  }

  // Show product-level detail after
  if (afterFrikomerc) {
    const sv = afterFrikomerc.products?.find(p => p.product_id === SVINSKO_PRODUCT_ID);
    if (sv) info(`After Свинско: qty=${sv.quantity}, unit_price=${sv.unit_price}, total=${sv.total}`);
  }
  if (afterVitalia) {
    const ma = afterVitalia.products?.find(p => p.product_id === MASLO_PRODUCT_ID);
    if (ma) info(`After Масло: qty=${ma.quantity}, unit_price=${ma.unit_price}, total=${ma.total}`);
  }

  // Cleanup: cancel the test order (mark order as cancelled)
  await sleep(500);
  const cancelRes = await api(page, 'PUT', `/orders/${orderId}`, { status: 'cancelled' });
  console.log(`  Cleanup (cancel order): HTTP ${cancelRes.status}`);

  console.log('\n  S28 complete');
  await browser.close();
})();
