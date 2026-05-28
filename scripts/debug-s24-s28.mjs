/**
 * Debug scenarios 24–28 — F1/F2 cost data, Z-report fiscal isolation,
 * multi-warehouse, and stock deduction in supplier consumption.
 * These are primarily API-level tests; browser used only for Z-report view.
 */
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '../screenshots/debug');
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:4000';

const issues = [];
function issue(scenario, desc, sev) {
  issues.push({ scenario, desc, sev });
  console.log(`  ⚠️  [${sev}] S${scenario}: ${desc}`);
}
function ok(msg) { console.log(`  ✓ ${msg}`); }
function info(msg) { console.log(`  ℹ️  ${msg}`); }
async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
}
async function getToken(page) {
  return page.evaluate(() => localStorage.getItem('gastropro_token'));
}
async function api(page, method, urlPath, body) {
  const tok = await getToken(page);
  return page.evaluate(async ([url, m, b, t]) => {
    const opts = { method: m, headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' } };
    if (b) opts.body = JSON.stringify(b);
    const r = await fetch(url, opts);
    const text = await r.text();
    try { return { status: r.status, body: JSON.parse(text) }; }
    catch { return { status: r.status, body: text }; }
  }, [`${BASE}/api${urlPath}`, method, body, tok]);
}

async function goTo(page, navText) {
  await page.locator('nav button').filter({ hasText: navText }).first().click();
  await page.waitForTimeout(1800);
}

async function closeAnyModal(page) {
  let cnt = await page.locator('.fixed.inset-0').count();
  if (cnt === 0) return;
  for (let attempt = 0; attempt < 4 && cnt > 0; attempt++) {
    const modal = page.locator('.fixed.inset-0').last();
    const allBtns = modal.locator('button');
    const btnCount = await allBtns.count();
    let clicked = false;
    for (let i = 0; i < btnCount; i++) {
      const btn = allBtns.nth(i);
      const inner = await btn.innerText({ timeout: 400 }).catch(() => 'ERR');
      if (inner.trim() === '') {
        await btn.click({ force: true, timeout: 2000 }).catch(() => {});
        clicked = true;
        break;
      }
    }
    if (!clicked) {
      const cancel = modal.locator('button').filter({ hasText: /Откажи|Затвори|Cancel|Close|✕/i });
      if (await cancel.count() > 0) await cancel.first().click({ force: true, timeout: 2000 }).catch(() => {});
    }
    await page.waitForTimeout(600);
    cnt = await page.locator('.fixed.inset-0').count();
  }
  if (await page.locator('.fixed.inset-0').count() > 0) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setViewportSize({ width: 1400, height: 900 });

  page.on('console', msg => {
    if (msg.type() === 'error' && !msg.text().includes('favicon'))
      console.log('  [console.error]', msg.text().slice(0, 120));
  });

  // Single login
  await page.goto(BASE + '/');
  await page.waitForSelector('input[type="password"]', { timeout: 15000 });
  await page.locator('input[type="email"], input[type="text"]').first().fill('admin@gastropro.mk');
  await page.locator('input[type="password"]').first().fill('admin123');
  await page.locator('button[type="submit"]').first().click();
  await page.waitForSelector('nav button', { timeout: 15000 });
  await page.waitForTimeout(1500);
  console.log('  Logged in. Starting S24–S28.');

  // ── S24: Non-fiscal invoice respects F1 cost data ────────────────────────
  console.log('\n═══ S24: Non-fiscal invoice — cost/margin visibility ══════════');
  let s24InvoiceId = null;
  try {
    // Find a known invoice to inspect
    const invRes = await api(page, 'GET', '/non-fiscal-invoices?limit=5');
    const invoices = invRes.body || [];
    const testInv = invoices.find(i => i.status === 'paid' || i.status === 'pending');
    if (!testInv) {
      issue(24, 'No non-fiscal invoices to inspect for cost data', 'P2');
    } else {
      s24InvoiceId = testInv.id;
      const detailRes = await api(page, 'GET', `/non-fiscal-invoices/${testInv.id}`);
      const inv = detailRes.body;

      console.log(`  Invoice: ${inv.invoice_number}, total: ${inv.total_amount}`);
      info('Invoice fields: ' + Object.keys(inv).join(', '));

      // Check: does invoice detail expose purchase_cost or margin?
      const hasMargin = 'margin' in inv || 'margin_percent' in inv || 'purchase_cost' in inv || 'cost' in inv;
      const hasCostInItems = (inv.items || []).some(item => 'purchase_cost' in item || 'margin' in item || 'cost_price' in item);

      if (hasMargin || hasCostInItems) {
        issue(24, 'Non-fiscal invoice EXPOSES cost/margin data — should show only selling price (customer-facing document)', 'P2');
      } else {
        ok('Non-fiscal invoice correctly does NOT expose purchase_cost/margin — customer-facing document shows selling price only');
      }

      // Verify item prices are selling prices (positive, reasonable)
      const items = inv.items || [];
      console.log(`  Invoice items: ${items.length}`);
      items.forEach(it => {
        console.log(`    Item: "${it.name}", qty=${it.quantity}, unit_price=${it.unit_price}, total=${it.total}`);
      });
      if (items.length > 0) {
        const allPricesPositive = items.every(it => parseFloat(it.unit_price) > 0);
        if (allPricesPositive) ok('All invoice item prices are positive (selling prices)');
        else issue(24, 'Some invoice item prices are zero or negative', 'P2');
      }

      // Document: expected behavior
      info('Expected design: non-fiscal invoice shows selling prices (billed to customer), not purchase costs');
      info('Purchase costs are only visible in: supplier consumption report (Z-report), stock dashboard, product margin report');

      // Screenshot of invoice in UI
      await goTo(page, /^Invoices$|^Фактури$/i);
      await page.waitForTimeout(1000);
      const invRow = page.locator('div.rounded-card tbody tr').first();
      if (await invRow.count() > 0) {
        await invRow.locator('button').first().click({ force: true }); // Eye icon
        await page.waitForTimeout(800);
        await shot(page, 's24-01-invoice-detail');
        const modalText = await page.locator('.fixed.inset-0').last().innerText().catch(() => '');
        const hasCostInUI = /purchase|cost|набавка|набавен|margin|маргина/i.test(modalText);
        if (hasCostInUI) issue(24, 'Invoice detail UI shows cost/margin text — should be customer-facing only', 'P3');
        else ok('Invoice detail UI: no cost/margin data visible (correct)');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(400);
      }
    }
    console.log('  S24 complete');
  } catch (e) {
    issue(24, `S24 error: ${e.message}`, 'P2');
    console.log('  S24 error:', e.message);
  }

  // ── S25: Supplier consumption uses purchase_cost ──────────────────────────
  console.log('\n═══ S25: Supplier consumption uses purchase_cost ═════════════');
  try {
    // Use the closed shift which has consumption data
    const closedShiftsRes = await api(page, 'GET', '/shifts?status=closed&limit=1');
    const closedShift = (closedShiftsRes.body?.data || [])[0];
    if (!closedShift) {
      issue(25, 'No closed shift for consumption verification', 'P2');
    } else {
      const shiftId = closedShift.id;
      const consumptionRes = await api(page, 'GET', `/supplier-consumption?shiftId=${shiftId}`);
      const suppliers = consumptionRes.body || [];
      console.log(`  Closed shift ${shiftId.slice(-8)} has ${suppliers.length} suppliers in consumption`);

      if (suppliers.length === 0) {
        issue(25, 'No supplier consumption data for closed shift', 'P2');
      } else {
        // For each supplier, manually verify: sum(product.quantity × product.unit_price) = supplier.total_value
        let allCorrect = true;
        for (const sup of suppliers) {
          const productSum = sup.products.reduce((acc, p) => {
            const val = parseFloat(p.quantity) * parseFloat(p.unit_price);
            return acc + Math.round(val * 100) / 100;
          }, 0);
          const supTotal = parseFloat(sup.total_value);
          const diff = Math.abs(productSum - supTotal);
          console.log(`  ${sup.supplier_name}: sum(qty×unit_price)=${productSum.toFixed(2)}, total_value=${supTotal.toFixed(2)}, diff=${diff.toFixed(4)}`);
          if (diff > 0.05) {
            issue(25, `Math mismatch for ${sup.supplier_name}: products sum=${productSum.toFixed(2)} ≠ total_value=${supTotal.toFixed(2)}`, 'P1');
            allCorrect = false;
          }

          // Verify unit_price looks like a purchase price (not a selling price)
          // Purchase prices tend to be lower than selling prices
          for (const p of sup.products) {
            console.log(`    Product: "${p.product_name}", qty=${p.quantity}, unit_price=${p.unit_price} (purchase_cost), total=${p.total}`);
          }
        }
        if (allCorrect) ok(`All ${suppliers.length} supplier totals correctly calculated using purchase_cost`);

        // Cross-check: compare unit_price in consumption vs purchase_price in products DB
        // We check "Масло" which should be 120 MKD/l
        const vitalia = suppliers.find(s => s.supplier_name === 'Виталиа');
        if (vitalia) {
          const maslo = vitalia.products.find(p => /масло|maslo/i.test(p.product_name));
          if (maslo) {
            const expectedPurchasePrice = 120; // from DB: p.purchase_price = 120
            if (parseFloat(maslo.unit_price) === expectedPurchasePrice) {
              ok(`"Масло" unit_price = ${maslo.unit_price} MKD/l (matches DB purchase_price = ${expectedPurchasePrice} ✓)`);
            } else {
              issue(25, `"Масло" unit_price = ${maslo.unit_price} but DB purchase_price = ${expectedPurchasePrice} — consumption uses WRONG price`, 'P1');
            }
          }
        }
      }
    }
    console.log('  S25 complete');
  } catch (e) {
    issue(25, `S25 error: ${e.message}`, 'P2');
    console.log('  S25 error:', e.message);
  }

  // ── S26: Non-fiscal sales reflected in Z-report ──────────────────────────
  console.log('\n═══ S26: Non-fiscal sales in Z-report (fiscal isolation) ══════');
  try {
    // Use the closed shift Z-report
    const closedRes = await api(page, 'GET', '/shifts?status=closed&limit=1');
    const closedShift = (closedRes.body?.data || [])[0];
    if (!closedShift) {
      issue(26, 'No closed shift for Z-report test', 'P2');
    } else {
      const shiftId = closedShift.id;
      const zreportRes = await api(page, 'GET', `/shifts/${shiftId}/zreport`);
      const z = zreportRes.body;
      console.log(`  Z-report for shift ${shiftId.slice(-8)}`);

      if (!z || !z.totals) {
        issue(26, 'Z-report data missing or malformed', 'P1');
      } else {
        // Check: non_fiscal_sales section exists
        const hasNonFiscalSection = z.non_fiscal_sales !== undefined;
        console.log(`  non_fiscal_sales section present: ${hasNonFiscalSection}`);
        console.log(`  non_fiscal_sales: ${JSON.stringify(z.non_fiscal_sales)}`);
        if (!hasNonFiscalSection) {
          issue(26, 'Z-report missing "non_fiscal_sales" section', 'P2');
        } else {
          ok('"non_fiscal_sales" section present in Z-report');
          const nf = z.non_fiscal_sales;
          if (nf.order_linked?.count > 0 || nf.standalone?.count > 0) {
            ok(`Non-fiscal counts: order_linked=${nf.order_linked.count} (${nf.order_linked.total_amount} ден.), standalone=${nf.standalone.count} (${nf.standalone.total_amount} ден.)`);
          } else {
            info('No non-fiscal invoices in this shift period (totals are zero — OK)');
          }
        }

        // CRITICAL CHECK: verify fiscal totals are NOT contaminated by non-fiscal orders
        // Non-fiscal invoice orders have status='paid', payment_method=null
        // They would show in grossRevenue if not filtered out
        const grossRevenue = parseFloat(z.totals.gross_revenue || 0);
        const orderCount = z.totals.order_count;
        console.log(`  Fiscal gross_revenue: ${grossRevenue} ден., orders: ${orderCount}`);

        // Check payment_breakdown for null/undefined method (indicates non-fiscal order contamination)
        const payBreakdown = z.payment_breakdown || [];
        console.log(`  Payment breakdown entries: ${payBreakdown.length}`);
        payBreakdown.forEach(pb => console.log(`    method="${pb.method}", count=${pb.count}, total=${pb.total}`));

        const nullMethodEntry = payBreakdown.find(pb => pb.method === null || pb.method === undefined || pb.method === 'null');
        if (nullMethodEntry) {
          issue(26, `CRITICAL: payment_breakdown has "null" method entry (${nullMethodEntry.count} orders, ${nullMethodEntry.total} ден.) — non-fiscal invoice orders contaminate fiscal totals`, 'P1');
        } else {
          ok('No null payment_method in Z-report payment_breakdown');
        }

        // Double-count check: if non_fiscal order_linked.total_amount > 0,
        // those amounts should NOT appear in fiscal gross_revenue
        // We check this by seeing if any paid orders with non_fiscal_invoice_id exist in this shift
        const nfLinkedTotal = parseFloat(z.non_fiscal_sales?.order_linked?.total_amount || 0);
        if (nfLinkedTotal > 0) {
          // These orders exist in the shift; if they're in grossRevenue, it's contamination
          // We can verify by comparing grossRevenue with what we know about cash/card payments
          info(`Non-fiscal linked invoices total: ${nfLinkedTotal} ден. — checking if this amount is also in fiscal gross_revenue...`);
          // Note: if payment_breakdown shows a non-null method covering 100% of gross_revenue,
          // and the sum matches, then non-fiscal orders are NOT in gross_revenue. Otherwise, they are.
          const sumOfBreakdown = payBreakdown.reduce((s, pb) => s + parseFloat(pb.total || 0), 0);
          const diff = Math.abs(sumOfBreakdown - grossRevenue);
          console.log(`  Payment breakdown sum: ${sumOfBreakdown.toFixed(2)}, grossRevenue: ${grossRevenue.toFixed(2)}, diff: ${diff.toFixed(2)}`);
          if (diff < 0.01) {
            ok('Payment breakdown sum matches gross_revenue (all paid orders accounted for in breakdown)');
          } else {
            issue(26, `Payment breakdown sum (${sumOfBreakdown.toFixed(2)}) ≠ gross_revenue (${grossRevenue.toFixed(2)}) by ${diff.toFixed(2)} ден. — some paid orders missing from breakdown (likely null-method non-fiscal orders)`, 'P1');
          }
        }

        // Screenshot Z-report non-fiscal section in UI
        await goTo(page, /^Персонал$|^Staff$/i);
        await page.waitForTimeout(1500);
        await page.evaluate(() => {
          const rows = document.querySelectorAll('table tbody tr');
          if (rows.length) rows[0].scrollIntoView({ block: 'center' });
        });
        await page.waitForTimeout(400);
        const firstRow = page.locator('table tbody tr').first();
        if (await firstRow.count() > 0) {
          await firstRow.click({ force: true });
          await page.waitForTimeout(2000);
          // Scroll to non-fiscal section in Z-report
          await page.evaluate(() => {
            const headings = document.querySelectorAll('h3');
            const nfHeading = Array.from(headings).find(h => /non.fiscal|нефискал|b2b|invoice/i.test(h.textContent));
            if (nfHeading) nfHeading.scrollIntoView({ block: 'center' });
          });
          await page.waitForTimeout(600);
          await shot(page, 's26-01-zreport-nonfiscal-section');

          // Check if non-fiscal section is rendered in UI
          const nfSectionText = await page.locator('body').innerText().catch(() => '');
          const hasNfSectionUI = /NF-\d{4}-\d{4}|non.fiscal|нефискал|B2B|Фактури.*наруч/i.test(nfSectionText);
          if (hasNfSectionUI) ok('Non-fiscal section visible in Z-report UI');
          else issue(26, 'Non-fiscal invoices section not visible in Z-report UI', 'P2');
        }
      }
    }
    console.log('  S26 complete');
  } catch (e) {
    issue(26, `S26 error: ${e.message}`, 'P2');
    console.log('  S26 error:', e.message);
  }

  // ── S27: Multi-warehouse + non-fiscal invoice ──────────────────────────────
  console.log('\n═══ S27: Multi-warehouse + non-fiscal invoice ═════════════════');
  let s27TableId = null;
  let s27OrigWarehouseId = null;
  const SECONDARY_WAREHOUSE_ID = '15047841-73a4-40ee-9e89-fa0e40e63ace'; // Летна тераса
  let s27OrderId = null;
  try {
    // Find a free table and reassign to secondary warehouse (Летна тераса)
    const tablesRes = await api(page, 'GET', '/tables');
    const tables = tablesRes.body || [];
    const freeTable = tables.find(t => t.status === 'free' && t.number !== '1' && t.number !== '2');
    if (!freeTable) {
      issue(27, 'No free table to use for multi-warehouse test', 'P2');
    } else {
      s27TableId = freeTable.id;
      s27OrigWarehouseId = freeTable.warehouse_id;
      console.log(`  Using table ${freeTable.number} (id: ${freeTable.id}), original warehouse: ${freeTable.warehouse_id}`);

      // Reassign table to secondary warehouse
      const reassignRes = await api(page, 'PUT', `/tables/${freeTable.id}`, {
        number: freeTable.number,
        capacity: freeTable.capacity ?? 4,
        zone: freeTable.zone ?? null,
        status: 'free',
        active: freeTable.active !== false,
        warehouse_id: SECONDARY_WAREHOUSE_ID,
      });
      if (reassignRes.status === 200) {
        ok(`Table ${freeTable.number} reassigned to "Летна тераса" warehouse`);
      } else {
        issue(27, `Failed to reassign table to secondary warehouse: ${reassignRes.status}`, 'P1');
        s27TableId = null;
      }
    }

    if (s27TableId) {
      // Get company for invoice
      const cosRes = await api(page, 'GET', '/companies');
      const company = (cosRes.body || []).find(c => c.name && !c.deleted_at) || (cosRes.body || [])[0];
      if (!company) {
        issue(27, 'No company available for non-fiscal invoice', 'P2');
      } else {
        // Get menu item
        const menuRes = await api(page, 'GET', '/menu-items');
        const mi = (menuRes.body || [])[0];

        // Create order on the reassigned table
        const orderRes = await api(page, 'POST', '/orders', {
          table_id: s27TableId,
          order_type: 'dine_in',
          guest_count: 2,
          items: [{ menu_item_id: mi.id, name: mi.name, quantity: 1, price: parseFloat(mi.price) }],
        });
        if (orderRes.status !== 201) {
          issue(27, `Order creation failed for S27: ${orderRes.status}`, 'P1');
        } else {
          s27OrderId = orderRes.body.id;
          const ordTotal = parseFloat(orderRes.body.total_amount || orderRes.body.subtotal || mi.price);
          console.log(`  Order created: id=${s27OrderId.slice(-8)}, total=${ordTotal}, on table in Летна тераса`);

          // Issue non-fiscal invoice
          const today = new Date();
          const dueDate = new Date(today);
          dueDate.setDate(dueDate.getDate() + 30);
          const invRes = await api(page, 'POST', '/non-fiscal-invoices', {
            company_id: company.id,
            order_id: s27OrderId,
            due_date: dueDate.toISOString().split('T')[0],
            vat_rate: 18,
            items: [{ name: mi.name, quantity: 1, unit_price: parseFloat(mi.price), vat_rate: 18 }],
          });
          console.log(`  Non-fiscal invoice: ${invRes.status}, number: ${invRes.body?.invoice_number}`);
          if (invRes.status !== 201) {
            issue(27, `Non-fiscal invoice creation failed: ${invRes.status}`, 'P1');
          } else {
            ok(`Non-fiscal invoice issued: ${invRes.body.invoice_number} for order on secondary warehouse table`);
          }

          // Close the current open shift to get a fresh Z-report that includes this order
          // First check if there are other open orders
          const openShiftsRes = await api(page, 'GET', '/shifts?status=open&limit=1');
          const openShift = (openShiftsRes.body?.data || openShiftsRes.body || []).find(s => s.status === 'open');
          if (openShift) {
            const openOrdersCheck = await api(page, 'POST', `/shifts/${openShift.id}/close`, { actual_cash: 0 });
            if (openOrdersCheck.status === 409) {
              console.log(`  Open shift has open orders — cannot close for S27 Z-report test`);
              info('Cannot close shift (open orders exist) — verifying S27 using supplier consumption API directly');

              // Instead, check the per_warehouse via the Z-report of the CLOSED shift
              // and compare with the invoice we just created (it's in the current OPEN shift)
              info('S27 design doc: non-fiscal invoice orders appear in per_warehouse (same as fiscal orders) — testing with closed shift data');

              // Use the closed shift Z-report to check per_warehouse structure
              const closedZ = await api(page, 'GET', `/shifts/${(await api(page, 'GET', '/shifts?status=closed&limit=1')).body?.data?.[0]?.id}/zreport`);
              if (closedZ.body?.per_warehouse) {
                const pw = closedZ.body.per_warehouse;
                console.log(`  Per-warehouse breakdown (closed shift): ${pw.length} entries`);
                pw.forEach(w => console.log(`    warehouse="${w.warehouse_name}", is_main=${w.is_main}, orders=${w.order_count}, subtotal=${w.subtotal}`));
                ok('Per-warehouse breakdown present in Z-report');
                // Note design: non-fiscal orders with table_id end up in their table's warehouse
                info('Design: non-fiscal invoice orders route to their table\'s warehouse (same JOIN as fiscal orders)');
                info('Implication: non-fiscal orders are included in per-warehouse subtotals even though they are parallel to fiscal totals');
                if (pw.some(w => !w.is_main && w.order_count > 0)) {
                  ok('Secondary warehouse entries have orders — multi-warehouse tracking works');
                } else {
                  info('No secondary warehouse orders in closed shift (expected — test order is in open shift)');
                }
              }
            } else if (openOrdersCheck.status === 200 || openOrdersCheck.status === 201) {
              // Shift closed! Check the new Z-report
              const newZReport = openOrdersCheck.body?.zreport || openOrdersCheck.body;
              const pw = newZReport?.per_warehouse || [];
              console.log(`  NEW Z-report per-warehouse: ${pw.length} entries`);
              pw.forEach(w => console.log(`    warehouse="${w.warehouse_name}", is_main=${w.is_main}, orders=${w.order_count}, subtotal=${w.subtotal}`));
              const letnaEntry = pw.find(w => w.warehouse_name === 'Летна тераса');
              if (letnaEntry) {
                ok(`"Летна тераса" warehouse entry found in Z-report: ${letnaEntry.order_count} orders, ${letnaEntry.subtotal} ден.`);
                info('Non-fiscal invoice order routes to secondary warehouse in per-warehouse breakdown');
              } else {
                issue(27, '"Летна тераса" warehouse not found in Z-report per-warehouse breakdown', 'P2');
              }
              await shot(page, 's27-01-zreport-per-warehouse');
            }
          }
        }
      }
    }

    // Restore table to original warehouse
    if (s27TableId && s27OrigWarehouseId) {
      const tblInfo = (await api(page, 'GET', '/tables')).body?.find(t => t.id === s27TableId) || {};
      const restoreRes = await api(page, 'PUT', `/tables/${s27TableId}`, {
        number: tblInfo.number || '3',
        capacity: tblInfo.capacity ?? 4,
        zone: tblInfo.zone ?? null,
        status: tblInfo.status || 'free',
        active: tblInfo.active !== false,
        warehouse_id: s27OrigWarehouseId,
      });
      console.log(`  Restored table warehouse: ${restoreRes.status}`);
    }

    console.log('  S27 complete');
  } catch (e) {
    // Safety: restore table
    if (s27TableId && s27OrigWarehouseId) {
      await api(page, 'PUT', `/tables/${s27TableId}`, {
        number: '3', capacity: 4, zone: null, status: 'free', active: true,
        warehouse_id: s27OrigWarehouseId,
      }).catch(() => {});
    }
    issue(27, `S27 error: ${e.message}`, 'P2');
    console.log('  S27 error:', e.message);
  }

  // ── S28: Stock deduction + supplier consumption ───────────────────────────
  console.log('\n═══ S28: Stock deduction + supplier consumption ═══════════════');
  try {
    // "vienska snicla" has recipe ingredients with 2 suppliers:
    //   Свинско месо (300g) → Фрикомерц @ 250 MKD/kg → expected consumption: 75 MKD
    //   Масло (100ml) → Виталиа @ 120 MKD/l → expected consumption: 12 MKD
    const VIENSKA_SNICLA_ID = 'a74514c9-19a8-4bd2-9a3b-0071c2bbe25d';
    const SVINSKO_PRODUCT_ID = '75e7fb33-e4d4-48b7-bee3-8e4dc4333cf2';
    const MASLO_PRODUCT_ID = '4a581c68-6a53-482d-a1dc-254f7d7a5f18';
    const SVINKSO_PURCHASE_PRICE = 250; // MKD/kg
    const MASLO_PURCHASE_PRICE = 120;   // MKD/l

    // Get open shift
    const openShiftsRes = await api(page, 'GET', '/shifts?status=open&limit=1');
    const openShift = (openShiftsRes.body?.data || openShiftsRes.body || []).find(s => s.status === 'open');
    if (!openShift) {
      issue(28, 'No open shift for stock deduction test', 'P2');
    } else {
      const shiftId = openShift.id;
      console.log(`  Open shift: ${shiftId.slice(-8)}`);

      // Snapshot consumption BEFORE
      const beforeConsumption = await api(page, 'GET', `/supplier-consumption?shiftId=${shiftId}`);
      const beforeSuppliers = beforeConsumption.body || [];
      const beforeFrikomerc = beforeSuppliers.find(s => s.supplier_name === 'Фрикомерц');
      const beforeVitalia = beforeSuppliers.find(s => s.supplier_name === 'Виталиа');
      const beforeFrMaslo = beforeVitalia?.products?.find(p => p.product_id === MASLO_PRODUCT_ID);
      const beforeFrSvinsko = beforeFrikomerc?.products?.find(p => p.product_id === SVINSKO_PRODUCT_ID);
      const beforeFrTotal = parseFloat(beforeFrikomerc?.total_value || 0);
      const beforeVtTotal = parseFloat(beforeVitalia?.total_value || 0);
      console.log(`  Before: Фрикомерц total=${beforeFrTotal}, Виталиа total=${beforeVtTotal}`);

      // Find a free table
      const tablesRes = await api(page, 'GET', '/tables');
      const freeTable = (tablesRes.body || []).find(t => t.status === 'free');
      if (!freeTable) {
        issue(28, 'No free table for S28 order', 'P2');
      } else {
        // Create order with vienska snicla
        const orderRes = await api(page, 'POST', '/orders', {
          table_id: freeTable.id,
          order_type: 'dine_in',
          guest_count: 2,
          items: [{ menu_item_id: VIENSKA_SNICLA_ID, name: 'vienska snicla', quantity: 2, price: 410 }],
        });
        if (orderRes.status !== 201) {
          issue(28, `Order creation failed: ${orderRes.status}`, 'P1');
        } else {
          const orderId = orderRes.body.id;
          console.log(`  Order created: ${orderId.slice(-8)} with 2× vienska snicla`);

          // Get the order item ID
          const orderDetail = await api(page, 'GET', `/orders/${orderId}`);
          const sniclaItem = (orderDetail.body?.items || []).find(i => i.menu_item_id === VIENSKA_SNICLA_ID);
          console.log(`  Order item: ${sniclaItem?.id?.slice(-8)}, qty=${sniclaItem?.quantity}`);

          if (!sniclaItem) {
            issue(28, 'vienska snicla item not found in order', 'P1');
          } else {
            // Mark item as "ready" → triggers stock deduction
            const readyRes = await api(page, 'PUT', `/orders/${orderId}/items/${sniclaItem.id}`, {
              status: 'ready',
            });
            console.log(`  Mark-ready status: ${readyRes.status}`);
            if (readyRes.status !== 200) {
              issue(28, `Mark-ready failed: ${readyRes.status} ${JSON.stringify(readyRes.body).slice(0, 80)}`, 'P1');
            } else {
              const warnings = readyRes.body?.deductionWarnings || [];
              if (warnings.length > 0) console.log(`  Deduction warnings: ${JSON.stringify(warnings)}`);
              else ok('Item marked ready — no deduction warnings');

              await page.waitForTimeout(500); // let transactions commit

              // Check consumption AFTER
              const afterConsumption = await api(page, 'GET', `/supplier-consumption?shiftId=${shiftId}`);
              const afterSuppliers = afterConsumption.body || [];
              const afterFrikomerc = afterSuppliers.find(s => s.supplier_name === 'Фрикомерц');
              const afterVitalia = afterSuppliers.find(s => s.supplier_name === 'Виталиа');
              const afterFrTotal = parseFloat(afterFrikomerc?.total_value || 0);
              const afterVtTotal = parseFloat(afterVitalia?.total_value || 0);
              console.log(`  After: Фрикомерц total=${afterFrTotal}, Виталиа total=${afterVtTotal}`);

              // Expected delta for 2× vienska snicla:
              // Свинско месо: 2 × 0.3 kg × 250 MKD/kg = 150 MKD
              // Масло: 2 × 0.1 l × 120 MKD/l = 24 MKD
              const expectedFrDelta = 150; // 2 × 300g × 250 MKD/kg
              const expectedVtDelta = 24;  // 2 × 100ml × 120 MKD/l

              const actualFrDelta = afterFrTotal - beforeFrTotal;
              const actualVtDelta = afterVtTotal - beforeVtTotal;
              console.log(`  Delta: Фрикомерц ${actualFrDelta.toFixed(2)} (expected ${expectedFrDelta}), Виталиа ${actualVtDelta.toFixed(2)} (expected ${expectedVtDelta})`);

              if (Math.abs(actualFrDelta - expectedFrDelta) < 0.01) {
                ok(`Фрикомерц consumption delta correct: +${actualFrDelta.toFixed(2)} MKD (expected +${expectedFrDelta})`);
              } else if (actualFrDelta === 0 && beforeFrTotal === 0 && afterFrTotal === 0) {
                issue(28, 'Фрикомерц consumption is 0 before AND after — recipe deduction may not have triggered', 'P1');
              } else {
                issue(28, `Фрикомерц delta wrong: got +${actualFrDelta.toFixed(2)} expected +${expectedFrDelta}`, 'P1');
              }

              if (Math.abs(actualVtDelta - expectedVtDelta) < 0.01) {
                ok(`Виталиа consumption delta correct: +${actualVtDelta.toFixed(2)} MKD (expected +${expectedVtDelta})`);
              } else {
                issue(28, `Виталиа delta wrong: got +${actualVtDelta.toFixed(2)} expected +${expectedVtDelta}`, 'P1');
              }

              // Also check the Масло product specifically in Виталиа after
              const afterMaslo = afterVitalia?.products?.find(p => p.product_id === MASLO_PRODUCT_ID);
              if (afterMaslo) {
                const masloBeforeQty = parseFloat(beforeFrMaslo?.quantity || 0);
                const masloAfterQty = parseFloat(afterMaslo.quantity);
                const masloQtyDelta = masloAfterQty - masloBeforeQty;
                console.log(`  Масло qty delta: +${masloQtyDelta.toFixed(4)} l (expected +0.2 l)`);
                if (Math.abs(masloQtyDelta - 0.2) < 0.001) {
                  ok(`Масло deduction correct: +0.2 l consumed (2 × 100ml)`);
                } else {
                  issue(28, `Масло quantity delta wrong: got +${masloQtyDelta.toFixed(4)} l expected +0.2 l`, 'P1');
                }
              }
            }
          }
        }
      }
    }

    console.log('  S28 complete');
  } catch (e) {
    issue(28, `S28 error: ${e.message}`, 'P2');
    console.log('  S28 error:', e.message);
  }

  await browser.close();

  // ── Final report ──────────────────────────────────────────────────────────
  console.log('\n\n══════════════════════════════════════════════════════════════');
  console.log('ISSUES FOUND (S24–S28):');
  if (issues.length === 0) console.log('  ✓ No issues');
  else issues.forEach(i => console.log(`  S${i.scenario} | ${i.sev} | ${i.desc}`));
  console.log(`\nTotal: ${issues.length} issue(s)`);
  const files = fs.readdirSync(OUT).filter(f => /^s(2[4-8])/.test(f)).sort();
  console.log('Screenshots:', files.length ? files.map(f => `  ${f}`).join('\n') : '  none');
}

main().catch(err => { console.error(err.message); process.exit(1); });
