/**
 * Debug scenarios 6–10 — single browser session to avoid rate-limit (1000 req/15min)
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

async function goToInventory(page) {
  await page.locator('nav button').filter({ hasText: /Inventory/i }).first().click();
  await page.waitForTimeout(1500);
}

async function clickInventoryTab(page, labelPattern) {
  // Scope to the inventory tab bar (min-w-max container), not global nav
  const tabBar = page.locator('[class*="min-w-max"] button');
  const tab = tabBar.filter({ hasText: labelPattern });
  const cnt = await tab.count();
  if (cnt > 0) {
    await tab.first().click({ force: true });
  } else {
    // fallback: buttons NOT in nav that match label
    await page.locator('button:not(nav button)').filter({ hasText: labelPattern }).first().click({ force: true });
  }
  await page.waitForTimeout(1200);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setViewportSize({ width: 1400, height: 900 });

  // Single login for all S6–S10
  const consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  await page.goto(BASE + '/');
  await page.waitForSelector('input[type="password"]', { timeout: 15000 });
  await page.locator('input[type="email"], input[type="text"]').first().fill('admin@gastropro.mk');
  await page.locator('input[type="password"]').first().fill('admin123');
  await page.locator('button[type="submit"]').first().click();
  await page.waitForSelector('nav button', { timeout: 15000 });
  await page.waitForTimeout(1500);
  console.log('  Logged in. Starting S6–S10.');

  // ══════════════════════════════════════════════════════════════════════════
  // S6 — PRODUCTS LIST cost/margin column
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n═══ S6: Products list — cost/margin column ═══════════════════');
  {
    await goToInventory(page);
    // Products tab is already active by default, but click explicitly
    await clickInventoryTab(page, /^Products$|^Артикли$/i);
    await shot(page, 's6-01-products-list');

    const thText = await page.locator('thead').innerText().catch(() => '');
    console.log('  Table headers:', thText.replace(/\n/g, ' | ').slice(0, 200));
    const hasCostCol = /cost.*margin|margin.*cost|COST.*MARGIN|Трошок/i.test(thText);
    if (!hasCostCol) issue(6, 'Cost/margin column header not found in products table', 'P1');
    else ok('Cost/margin column header visible');

    const badgeStats = await page.evaluate(() => {
      let emerald = 0, amber = 0, orange = 0, rose = 0;
      document.querySelectorAll('tbody td span').forEach(s => {
        const cls = s.className || '';
        if (cls.includes('emerald')) emerald++;
        else if (cls.includes('amber')) amber++;
        else if (cls.includes('orange')) orange++;
        else if (cls.includes('rose')) rose++;
      });
      return { emerald, amber, orange, rose };
    });
    console.log('  Margin badge counts:', badgeStats);
    await shot(page, 's6-02-products-badges');

    const total = badgeStats.emerald + badgeStats.amber + badgeStats.orange + badgeStats.rose;
    if (total === 0) issue(6, 'No colored margin badges found — all products may be ingredients', 'P2');
    else ok(`Margin badges: ${badgeStats.emerald} emerald, ${badgeStats.amber} amber, ${badgeStats.orange} orange, ${badgeStats.rose} rose`);

    if (badgeStats.emerald === 0) issue(6, 'No emerald (≥60%) badges', 'P3');
    if (badgeStats.amber + badgeStats.orange === 0) issue(6, 'No amber/orange (10-60%) badges', 'P3');
    if (badgeStats.rose === 0) issue(6, 'No rose (<10%) badges', 'P3');

    console.log('  S6 complete');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // S7 — INVOICE RECEIPT updates purchase_price + stock
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n═══ S7: Invoice receipt — purchase_price + stock update ══════');
  let targetProductId = null;
  let targetProductName = '';
  let preBuyPrice = 0;
  let preBuyStock = 0;
  let newPrice = 0;
  {
    const productsRes = await api(page, 'GET', '/products');
    const products = productsRes.body || [];
    const brashno = products.find(p => /брашно|Брашно/i.test(p.name));
    const target = brashno || products.find(p => parseFloat(p.purchase_price) > 0 && p.active);
    if (!target) { issue(7, 'No suitable product for invoice test', 'P1'); }
    else {
      targetProductId = target.id;
      targetProductName = target.name;
      preBuyPrice = parseFloat(target.purchase_price ?? 0);
      preBuyStock = parseFloat(target.current_stock ?? 0);
      newPrice = Math.round(preBuyPrice * 1.25) || 50;
      console.log(`  Target: "${targetProductName}", purchase_price=${preBuyPrice}, stock=${preBuyStock}`);
      console.log(`  Invoice at: ${newPrice} ден. × 5`);

      // Get pre-invoice stock dashboard value
      const preStats = await api(page, 'GET', '/dashboard/stats');
      const preInvValue = parseFloat(preStats.body?.inventory_value ?? 0);
      console.log(`  Pre-invoice inventory_value: ${preInvValue.toFixed(2)} ден.`);

      await goToInventory(page);
      await clickInventoryTab(page, /^Invoices$|^Фактури$/i);
      await shot(page, 's7-01-invoices-tab');

      const newInvBtn = page.locator('button').filter({ hasText: /New invoice|New Invoice|Нова фактура/i });
      const nibCount = await newInvBtn.count();
      console.log(`  "New Invoice" buttons: ${nibCount}`);

      if (nibCount === 0) {
        issue(7, '"New Invoice" button not found in Invoices tab', 'P1');
        // debug: list all buttons on page
        const allBtns = await page.locator('button:not(nav button)').all();
        for (const b of allBtns.slice(0, 15)) {
          const txt = await b.innerText({ timeout: 300 }).catch(() => '');
          if (txt.trim()) console.log(`    button: "${txt.trim().slice(0,40)}"`);
        }
      } else {
        await newInvBtn.first().click();
        await page.waitForTimeout(1000);
        await shot(page, 's7-02-invoice-modal');

        // Fill invoice header — find inputs inside modal (not nav)
        const modal = page.locator('.fixed.inset-0');
        const inputs = modal.locator('input');
        const inputCount = await inputs.count();
        console.log(`  Inputs in modal: ${inputCount}`);

        // Invoice number (first text input)
        const invoiceNum = `TEST-${Date.now()}`;
        await inputs.nth(0).fill(invoiceNum);
        // Supplier (second text input)
        await inputs.nth(1).fill('Test Supplier');
        // Date (third — type=date, already has today)

        // Add item
        const addItemBtn = modal.locator('button').filter({ hasText: /Add Item|Додај ставка/i });
        const aibCount = await addItemBtn.count();
        console.log(`  "Add Item" buttons in modal: ${aibCount}`);
        if (aibCount === 0) {
          issue(7, '"Add Item" button not found in invoice modal', 'P1');
        } else {
          await addItemBtn.first().click();
          await page.waitForTimeout(400);

          // Product select (last select in modal)
          const productSelect = modal.locator('select').last();
          await productSelect.selectOption({ value: targetProductId });
          await page.waitForTimeout(300);

          // Quantity and price inputs (last two number inputs)
          const numInputs = modal.locator('input[type="number"]');
          const numCount = await numInputs.count();
          console.log(`  Number inputs in modal: ${numCount}`);
          if (numCount >= 2) {
            await numInputs.nth(numCount - 2).fill('5');
            await numInputs.nth(numCount - 1).fill(String(newPrice));
          } else if (numCount === 1) {
            await numInputs.first().fill('5');
          }

          await shot(page, 's7-03-invoice-filled');

          // Submit
          const submitBtn = modal.locator('button[type="submit"]');
          if (await submitBtn.count() > 0) {
            await submitBtn.first().click();
            await page.waitForTimeout(2500);
            await shot(page, 's7-04-after-submit');

            // Verify via /products list
            await page.waitForTimeout(1000);
            const updatedRes = await api(page, 'GET', '/products');
            const updated = (updatedRes.body || []).find(p => p.id === targetProductId);
            const updatedPrice = parseFloat(updated?.purchase_price ?? NaN);
            const updatedStock = parseFloat(updated?.current_stock ?? NaN);
            console.log(`  Post-invoice: purchase_price=${updatedPrice}, current_stock=${updatedStock}`);

            if (Math.abs(updatedPrice - newPrice) < 0.01) {
              ok(`purchase_price updated: ${preBuyPrice} → ${updatedPrice} ден.`);
            } else {
              issue(7, `purchase_price NOT updated: expected ${newPrice}, got ${updatedPrice}`, 'P1');
            }
            if (updatedStock >= preBuyStock + 5 - 0.01) {
              ok(`stock increased: ${preBuyStock} → ${updatedStock} (+5)`);
            } else {
              issue(7, `stock NOT increased: was ${preBuyStock}, now ${updatedStock}`, 'P1');
            }

            // Store updated values for S8
            preBuyStock = updatedStock;
            const postStats = await api(page, 'GET', '/dashboard/stats');
            const postInvValue = parseFloat(postStats.body?.inventory_value ?? 0);
            console.log(`  Post-invoice inventory_value: ${postInvValue.toFixed(2)} ден.`);
            if (postInvValue > preInvValue) {
              ok(`S8 preview: inventory_value increased from ${preInvValue.toFixed(2)} → ${postInvValue.toFixed(2)} ден.`);
            } else {
              console.log(`  ⚠ S8 preview: inventory_value did NOT increase (${preInvValue} → ${postInvValue})`);
            }
          } else {
            issue(7, 'Submit button not found in invoice form', 'P1');
          }
        }
      }
    }
    console.log('  S7 complete');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // S8 — STOCK DASHBOARD reflects cost change
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n═══ S8: Stock dashboard — cost change reflected ══════════════');
  try {
    // Use /stock/summary which feeds StockSummaryCards
    const summaryRes = await api(page, 'GET', '/stock/summary');
    const totalValue = parseFloat(summaryRes.body?.total_stock_value ?? 0);
    console.log(`  API /stock/summary total_stock_value: ${totalValue.toFixed(2)}`);

    if (totalValue === 0) {
      issue(8, 'total_stock_value is 0 in /stock/summary', 'P2');
    } else {
      ok(`/stock/summary total_stock_value = ${totalValue.toFixed(2)} (non-zero)`);
    }

    // Navigate to Stock page (nav label: 'Stock' in EN; may have badge number appended)
    await page.locator('nav button').filter({ hasText: /Stock|Залиха/i }).first().click();
    await page.waitForTimeout(2500);
    await shot(page, 's8-01-stock-dashboard');

    // StockSummaryCards renders: `${value} ${t('mkd_short')}` → "63,889 MKD" in EN locale
    const pageText = await page.locator('body').innerText();
    // Match both "MKD" and "ден." suffixes
    const mkdValues = [...pageText.matchAll(/([\d,]+)\s*MKD/gi)].map(m => parseFloat(m[1].replace(/,/g, '')));
    const denValues = [...pageText.matchAll(/([\d,]+\.?\d*)\s*ден\./g)].map(m => parseFloat(m[1].replace(/,/g, '')));
    const allValues = [...mkdValues, ...denValues];
    console.log(`  MKD values on Stock page: ${mkdValues.slice(0,4).join(', ')}`);
    console.log(`  ден. values on Stock page: ${denValues.slice(0,4).join(', ')}`);

    // Value displayed rounds to integer, so compare within 1 unit
    const found = allValues.some(v => Math.abs(v - Math.round(totalValue)) <= 1);
    if (found) {
      ok(`Stock page shows value ~${Math.round(totalValue).toLocaleString()} matching /stock/summary`);
    } else {
      issue(8, `Stock page value not matching /stock/summary (${totalValue.toFixed(0)}). Found: ${allValues.slice(0,4).join(', ')}`, 'P2');
    }

    console.log('  S8 complete');
  } catch (e) {
    issue(8, `S8 error: ${e.message}`, 'P2');
    console.log('  S8 error:', e.message);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // S9 — PER-WAREHOUSE cost-weighted total
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n═══ S9: Per-warehouse cost-weighted total ════════════════════');
  try {
    await goToInventory(page);
    await clickInventoryTab(page, /^Per Warehouse$|^По магацини$/i);
    // Main warehouse auto-selected on load — wait for products to render
    await page.waitForTimeout(2500);
    await shot(page, 's9-01-per-warehouse');

    // Verify selected warehouse (the <select> shows the warehouse name, and h3 also shows it)
    const whHeading = await page.locator('h3').first().innerText().catch(() => '');
    console.log(`  Warehouse heading: "${whHeading}"`);
    ok(`Per Warehouse page loaded, showing: "${whHeading}"`);

    // Check cost/margin column header
    const thText = await page.locator('thead').innerText().catch(() => '');
    console.log(`  Table headers: ${thText.replace(/\n/g, ' | ').slice(0, 200)}`);
    if (!/cost.*margin|margin.*cost|COST.*MARGIN/i.test(thText)) {
      issue(9, 'Cost/margin column missing from per-warehouse table', 'P2');
    } else {
      ok('Cost/margin column visible');
    }

    // API cross-check against the stats card value
    const warehousesRes = await api(page, 'GET', '/warehouses');
    const warehouses = warehousesRes.body || [];
    const mainWh = warehouses.find(w => w.is_main);
    if (!mainWh) { issue(9, 'Main warehouse not found via API', 'P1'); }
    else {
      const whProductsRes = await api(page, 'GET', `/warehouses/${mainWh.id}/products`);
      const whProducts = whProductsRes.body || [];
      console.log(`  Products in main warehouse: ${whProducts.length}`);

      const expectedTotal = whProducts.reduce((acc, p) => {
        return acc + parseFloat(p.warehouse_stock ?? 0) * parseFloat(p.purchase_cost ?? p.purchase_price ?? 0);
      }, 0);
      console.log(`  API-calculated total: ${expectedTotal.toFixed(2)} ден.`);

      // Show first 5
      for (const p of whProducts.slice(0, 5)) {
        const s = parseFloat(p.warehouse_stock ?? 0), c = parseFloat(p.purchase_cost ?? p.purchase_price ?? 0);
        console.log(`    "${p.name}": ${s} × ${c} = ${(s * c).toFixed(2)} ден.`);
      }

      // Read displayed total — stats card uses 'mk-MK' locale → "58,314.00 ден." in headless
      const pageText = await page.locator('body').innerText();
      const denValues = [...pageText.matchAll(/([\d,]+\.?\d*)\s*ден\./g)]
        .map(m => parseFloat(m[1].replace(/,/g, '')))
        .filter(v => v > 100);
      console.log(`  ден. values on page (>100): ${denValues.slice(0,5).join(', ')}`);

      if (denValues.length === 0) {
        issue(9, 'No ден. values found on Per Warehouse page — stats card may not be rendering', 'P2');
      } else {
        const closestToExpected = denValues.reduce((closest, v) =>
          Math.abs(v - expectedTotal) < Math.abs(closest - expectedTotal) ? v : closest,
          0
        );
        console.log(`  Closest displayed value to expected: ${closestToExpected.toFixed(2)}`);

        if (Math.abs(closestToExpected - expectedTotal) <= 2) {
          ok(`Per-warehouse total matches: ${closestToExpected.toFixed(2)} ≈ ${expectedTotal.toFixed(2)} ден.`);
        } else {
          issue(9, `Total mismatch: displayed ${closestToExpected.toFixed(2)}, API calc ${expectedTotal.toFixed(2)} ден.`, 'P2');
        }
      }
    }
    await shot(page, 's9-03-total-verified');
    console.log('  S9 complete');
  } catch (e) {
    issue(9, `S9 error: ${e.message}`, 'P2');
    console.log('  S9 error:', e.message);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // S10 — MARGIN EDGE CASES
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n═══ S10: Margin edge cases ═══════════════════════════════════');
  try {
    const productsRes = await api(page, 'GET', '/products');
    const products = productsRes.body || [];

    // Case A: product with selling_price=0 → product_type='ingredient' → shows cost, not "0%"
    const zeroSell = products.find(p => parseFloat(p.selling_price) === 0);
    console.log(`  Products with selling_price=0: ${products.filter(p => parseFloat(p.selling_price) === 0).length}`);
    if (zeroSell) {
      console.log(`  Zero-sell product: "${zeroSell.name}", margin_percent=${zeroSell.margin_percent}`);
      if (zeroSell.margin_percent !== null && zeroSell.margin_percent !== undefined) {
        issue(10, `Product "${zeroSell.name}" with selling_price=0 has non-null margin_percent=${zeroSell.margin_percent}`, 'P2');
      } else {
        ok(`Selling_price=0 → margin_percent=null in API response`);
      }
    }

    // Case B: negative margin — edit a sellable product to have purchase > selling
    const sellable = products.find(p =>
      parseFloat(p.selling_price) > 0 && p.active
    );
    if (!sellable) {
      issue(10, 'No sellable product found for negative margin test', 'P2');
    } else {
      const origPP = parseFloat(sellable.purchase_price ?? 0);
      const origSP = parseFloat(sellable.selling_price ?? 0);
      const inflated = origSP * 1.5; // purchase > selling → negative margin
      console.log(`  Testing negative margin on: "${sellable.name}" (sell=${origSP})`);
      console.log(`  Setting purchase_price=${inflated} > selling=${origSP}`);

      const putRes = await api(page, 'PUT', `/products/${sellable.id}`, {
        name: sellable.name,
        barcode: sellable.barcode,
        unit: sellable.unit,
        purchase_price: inflated,
        selling_price: origSP,
        category_id: sellable.category_id || sellable.categoryId,
        min_stock: parseFloat(sellable.min_stock ?? sellable.minStock ?? 0),
        active: true,
      });
      console.log(`  PUT status: ${putRes.status}`);

      if (putRes.status === 200) {
        // Verify API returns negative margin
        const verifyRes = await api(page, 'GET', '/products');
        const updated = (verifyRes.body || []).find(p => p.id === sellable.id);
        const margin = parseFloat(updated?.margin_percent ?? NaN);
        console.log(`  Updated margin_percent: ${margin}`);

        if (margin < 0) {
          ok(`API returns negative margin_percent=${margin} for purchase > selling`);
        } else {
          issue(10, `API margin_percent=${margin} not negative after purchase_price > selling_price`, 'P1');
        }

        // Navigate to Products page and verify rose badge
        await goToInventory(page);
        await clickInventoryTab(page, /^Products$|^Артикли$/i);
        await page.waitForTimeout(1000);
        await shot(page, 's10-01-negative-margin-products');

        const productRow = page.locator('tbody tr').filter({ hasText: sellable.name });
        const rowCount = await productRow.count();
        console.log(`  "${sellable.name}" rows: ${rowCount}`);
        if (rowCount > 0) {
          const rowHtml = await productRow.first().innerHTML();
          const hasRose = rowHtml.includes('rose');
          const badgeText = await productRow.first().locator('[class*="rose"]').first().innerText().catch(() => '');
          console.log(`  Rose class in row: ${hasRose}, badge text: "${badgeText}"`);
          if (!hasRose) {
            issue(10, `Negative margin for "${sellable.name}" NOT showing rose badge`, 'P1');
          } else {
            ok(`Negative margin shows rose badge: "${badgeText}"`);
          }
        }

        // Revert
        const revertRes = await api(page, 'PUT', `/products/${sellable.id}`, {
          name: sellable.name,
          barcode: sellable.barcode,
          unit: sellable.unit,
          purchase_price: origPP,
          selling_price: origSP,
          category_id: sellable.category_id || sellable.categoryId,
          min_stock: parseFloat(sellable.min_stock ?? sellable.minStock ?? 0),
          active: true,
        });
        if (revertRes.status === 200) ok(`Reverted "${sellable.name}" to purchase_price=${origPP}`);
        else issue(10, `Failed to revert purchase_price for "${sellable.name}"`, 'P2');
        await shot(page, 's10-02-after-revert');
      } else {
        issue(10, `PUT failed (${putRes.status}): ${JSON.stringify(putRes.body).slice(0,100)}`, 'P2');
      }
    }

    // Case C: ingredient product (selling_price=0) shows cost, not "0%" badge
    if (zeroSell) {
      await goToInventory(page);
      await clickInventoryTab(page, /^Products$|^Артикли$/i);
      await page.waitForTimeout(1000);
      const zeroRow = page.locator('tbody tr').filter({ hasText: zeroSell.name });
      if (await zeroRow.count() > 0) {
        const rowText = await zeroRow.first().innerText();
        console.log(`  Zero-sell row: ${rowText.replace(/\t|\n/g,' ').slice(0,120)}`);
        if (rowText.includes('0.0%') || rowText.includes('0%')) {
          issue(10, `Ingredient "${zeroSell.name}" shows "0%" badge — should show cost`, 'P2');
        } else {
          ok(`Ingredient "${zeroSell.name}" shows no "0%" badge`);
        }
        if (rowText.includes('ден.')) {
          ok(`Ingredient "${zeroSell.name}" shows cost in ден.`);
        }
      }
    }

    console.log('  S10 complete');
  } catch (e) {
    issue(10, `S10 error: ${e.message}`, 'P2');
    console.log('  S10 error:', e.message);
  }

  await browser.close();

  // ── Final report ───────────────────────────────────────────────────────────
  console.log('\n\n══════════════════════════════════════════════════════════════');
  console.log('ISSUES FOUND (S6–S10):');
  if (issues.length === 0) console.log('  ✓ No issues');
  else issues.forEach(i => console.log(`  S${i.scenario} | ${i.desc} | ${i.sev}`));
  console.log(`\nTotal: ${issues.length} issue(s)`);
  const files = fs.readdirSync(OUT).filter(f => /^s([6-9]|10)/.test(f)).sort();
  console.log('Screenshots:', files.map(f => `  ${f}`).join('\n'));
}

main().catch(err => { console.error(err.message); process.exit(1); });
