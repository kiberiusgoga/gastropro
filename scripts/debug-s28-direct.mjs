/**
 * S28 — Stock deduction + supplier consumption delta (direct HTTP, no browser).
 * Uses Node.js built-in fetch to avoid the React app hammering the rate limiter.
 */
const BASE = 'http://localhost:4000/api';

async function request(tok, method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (tok) headers['Authorization'] = `Bearer ${tok}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${BASE}${path}`, opts);
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: r.status, body: json };
}

function ok(msg) { console.log(`  ✓ ${msg}`); }
function info(msg) { console.log(`  ℹ️  ${msg}`); }
function issue(msg, sev) { console.log(`  ⚠️  [${sev}] ${msg}`); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  // Login
  const loginRes = await request(null, 'POST', '/auth/login', {
    email: 'admin@gastropro.mk',
    password: 'admin123',
  });
  const tok = loginRes.body?.token || loginRes.body?.accessToken;
  if (loginRes.status !== 200 || !tok) {
    console.log(`Login failed: HTTP ${loginRes.status}`, JSON.stringify(loginRes.body).slice(0, 200));
    process.exit(1);
  }
  ok(`Logged in as admin`);

  const api = (method, path, body) => request(tok, method, path, body);

  // Constants (pre-researched in debug-s24-s28.mjs)
  const VIENSKA_SNICLA_ID = 'a74514c9-19a8-4bd2-9a3b-0071c2bbe25d';
  const SVINSKO_PRODUCT_ID = '75e7fb33-e4d4-48b7-bee3-8e4dc4333cf2';
  const MASLO_PRODUCT_ID   = '4a581c68-6a53-482d-a1dc-254f7d7a5f18';
  // 2 portions of vienska snicla:
  //   Свинско месо: 2 × 0.3 kg × 250 MKD/kg = 150 MKD
  //   Масло:        2 × 0.1 l  × 120 MKD/l  =  24 MKD
  const EXPECTED_DELTA_FR = 150;
  const EXPECTED_DELTA_VT = 24;

  console.log('\n═══ S28: Stock deduction + supplier consumption ═══════════════');

  // Step 1: Get open shift
  const shiftsRes = await api('GET', '/shifts?status=open&limit=5');
  const openShift = (shiftsRes.body?.data || shiftsRes.body || []).find(s => s.status === 'open');
  if (!openShift) {
    issue('No open shift found', 'P2');
    process.exit(1);
  }
  const shiftId = openShift.id;
  info(`Open shift: ${shiftId.slice(-8)}`);

  // Step 2: BEFORE snapshot
  const beforeRes = await api('GET', `/supplier-consumption?shiftId=${shiftId}`);
  const beforeSuppliers = beforeRes.body || [];
  const beforeFrikomerc = beforeSuppliers.find(s => s.supplier_name === 'Фрикомерц');
  const beforeVitalia   = beforeSuppliers.find(s => s.supplier_name === 'Виталиа');
  const beforeFrTotal = parseFloat(beforeFrikomerc?.total_value || 0);
  const beforeVtTotal = parseFloat(beforeVitalia?.total_value || 0);
  console.log(`  Before: Фрикомерц=${beforeFrTotal}, Виталиа=${beforeVtTotal}`);

  const beforeSvinsko = beforeFrikomerc?.products?.find(p => p.product_id === SVINSKO_PRODUCT_ID);
  const beforeMaslo   = beforeVitalia?.products?.find(p => p.product_id === MASLO_PRODUCT_ID);
  if (beforeSvinsko) info(`Before Свинско: qty=${beforeSvinsko.quantity}, total=${beforeSvinsko.total}`);
  if (beforeMaslo)   info(`Before Масло: qty=${beforeMaslo.quantity}, total=${beforeMaslo.total}`);

  // Step 3: Find a free table
  const tablesRes = await api('GET', '/tables');
  const freeTable = (tablesRes.body || []).find(t => t.status === 'free');
  if (!freeTable) {
    issue('No free table', 'P2');
    process.exit(1);
  }
  info(`Using table ${freeTable.number} (id: ${freeTable.id.slice(-8)})`);

  // Step 4: Create order with 2× vienska snicla
  const orderRes = await api('POST', '/orders', {
    table_id: freeTable.id,
    order_type: 'dine_in',
    guest_count: 2,
    items: [{ menu_item_id: VIENSKA_SNICLA_ID, name: 'vienska snicla', quantity: 2, price: 410 }],
  });
  if (orderRes.status !== 201) {
    issue(`Order creation failed: HTTP ${orderRes.status} — ${JSON.stringify(orderRes.body).slice(0, 100)}`, 'P1');
    process.exit(1);
  }
  const orderId = orderRes.body.id;
  ok(`Order created: ${orderId.slice(-8)} with 2× vienska snicla`);

  // Step 5: Get order items via GET /orders (list) — no GET /orders/:id endpoint exists
  await sleep(500);
  const ordersListRes = await api('GET', '/orders?status=open');
  if (ordersListRes.status !== 200) {
    issue(`GET /orders returned ${ordersListRes.status}`, 'P1');
    process.exit(1);
  }
  const targetOrder = (ordersListRes.body || []).find(o => o.id === orderId);
  if (!targetOrder) {
    issue(`Order ${orderId.slice(-8)} not found in open orders list`, 'P1');
    process.exit(1);
  }
  const sniclaItem = (targetOrder.items || []).find(i => i.menu_item_id === VIENSKA_SNICLA_ID);
  if (!sniclaItem) {
    issue('"vienska snicla" item not found in order', 'P1');
    const itemsSummary = (targetOrder.items || []).map(i => `${i.name}(${i.menu_item_id?.slice(-8)})`);
    info(`Items in order: ${itemsSummary.join(', ') || 'none'}`);
    process.exit(1);
  }
  ok(`Order item: id=${sniclaItem.id.slice(-8)}, qty=${sniclaItem.quantity}, name="${sniclaItem.name}"`);

  // Step 6: Mark item "ready" → triggers deductForOrderItem()
  const readyRes = await api('PUT', `/orders/${orderId}/items/${sniclaItem.id}`, { status: 'ready' });
  console.log(`  Mark-ready: HTTP ${readyRes.status}`);
  if (readyRes.status !== 200) {
    issue(`Mark-ready failed: ${readyRes.status} — ${JSON.stringify(readyRes.body).slice(0, 200)}`, 'P1');
    process.exit(1);
  }
  ok('Item marked ready — deductForOrderItem() should have fired');

  // Step 7: AFTER snapshot (short wait for DB write)
  await sleep(1000);
  const afterRes = await api('GET', `/supplier-consumption?shiftId=${shiftId}`);
  const afterSuppliers = afterRes.body || [];
  const afterFrikomerc = afterSuppliers.find(s => s.supplier_name === 'Фрикомерц');
  const afterVitalia   = afterSuppliers.find(s => s.supplier_name === 'Виталиа');
  const afterFrTotal = parseFloat(afterFrikomerc?.total_value || 0);
  const afterVtTotal = parseFloat(afterVitalia?.total_value || 0);
  console.log(`  After:  Фрикомерц=${afterFrTotal}, Виталиа=${afterVtTotal}`);

  const afterSvinsko = afterFrikomerc?.products?.find(p => p.product_id === SVINSKO_PRODUCT_ID);
  const afterMaslo   = afterVitalia?.products?.find(p => p.product_id === MASLO_PRODUCT_ID);
  if (afterSvinsko) info(`After Свинско: qty=${afterSvinsko.quantity}, unit_price=${afterSvinsko.unit_price}, total=${afterSvinsko.total}`);
  if (afterMaslo)   info(`After Масло: qty=${afterMaslo.quantity}, unit_price=${afterMaslo.unit_price}, total=${afterMaslo.total}`);

  // Step 8: Verify deltas
  const deltaFr = afterFrTotal - beforeFrTotal;
  const deltaVt = afterVtTotal - beforeVtTotal;
  console.log(`\n  Delta Фрикомерц: ${deltaFr.toFixed(2)} (expected: ${EXPECTED_DELTA_FR})`);
  console.log(`  Delta Виталиа:   ${deltaVt.toFixed(2)} (expected: ${EXPECTED_DELTA_VT})`);

  if (Math.abs(deltaFr - EXPECTED_DELTA_FR) < 0.01) {
    ok(`Фрикомерц delta = ${deltaFr} MKD ✓ (2 × 0.3 kg × 250 MKD/kg = 150 MKD)`);
  } else {
    issue(`Фрикомерц delta = ${deltaFr} (expected ${EXPECTED_DELTA_FR}) — stock deduction math wrong`, 'P1');
  }

  if (Math.abs(deltaVt - EXPECTED_DELTA_VT) < 0.01) {
    ok(`Виталиа delta = ${deltaVt} MKD ✓ (2 × 0.1 l × 120 MKD/l = 24 MKD)`);
  } else {
    issue(`Виталиа delta = ${deltaVt} (expected ${EXPECTED_DELTA_VT}) — stock deduction math wrong`, 'P1');
  }

  // Cleanup
  await sleep(300);
  const cancelRes = await api('PUT', `/orders/${orderId}`, { status: 'cancelled' });
  console.log(`  Cleanup (cancel order): HTTP ${cancelRes.status}`);

  console.log('\n  S28 complete');
})();
