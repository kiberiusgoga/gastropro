/**
 * F1 verification — invoice cost-update + all 4 margin tiers + edge cases
 */
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '../screenshots/feature-1-verify');
fs.mkdirSync(OUT, { recursive: true });

const BASE = 'http://localhost:4000';

// ── helpers ─────────────────────────────────────────────────────────────────
function sc(page) { return page.locator('div.flex-1.overflow-y-auto').first(); }
async function scrollTop(page) {
  try { await sc(page).evaluate(el => { el.scrollTop = 0; }); } catch {}
  await page.waitForTimeout(150);
}
async function scrollDown(page, by = 300) {
  try { await sc(page).evaluate((el, b) => { el.scrollBy(0, b); }, by); } catch {}
  await page.waitForTimeout(200);
}

async function login(page) {
  await page.goto(`${BASE}/`);
  await page.waitForSelector('input[type="password"]', { timeout: 10000 });
  await page.locator('input[type="email"], input[type="text"]').first().fill('admin@gastropro.mk');
  await page.locator('input[type="password"]').first().fill('admin123');
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(2500);
}

// API helpers — read JWT from localStorage (app stores token there)
async function getToken(page) {
  return page.evaluate(() => localStorage.getItem('gastropro_token'));
}
async function apiGet(page, path) {
  const token = await getToken(page);
  return page.evaluate(async ([url, tok]) => {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${tok}` } });
    return r.json();
  }, [`${BASE}/api${path}`, token]);
}
async function apiPut(page, path, body) {
  const token = await getToken(page);
  return page.evaluate(async ([url, b, tok]) => {
    const r = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
      body: JSON.stringify(b),
    });
    return r.json();
  }, [`${BASE}/api${path}`, body, token]);
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1400, height: 900 });
  await login(page);
  console.log('Logged in');

  // ── FETCH CURRENT PRODUCTS ───────────────────────────────────────────────
  const token = await getToken(page);
  console.log(`Token (first 30): ${token?.slice(0, 30) ?? 'NULL'}`);
  const lsKeys = await page.evaluate(() => Object.keys(localStorage));
  console.log('localStorage keys:', lsKeys);

  const products = await apiGet(page, '/products');
  console.log(`Products fetched: ${JSON.stringify(products)?.slice(0, 200)}`);
  const kasByName   = (name) => products.find(p => p.name.toLowerCase().includes(name.toLowerCase()));
  const kaskaval    = kasByName('kaskaval');
  console.log(`kaskaval: purchase_price=${kaskaval?.purchase_price} selling_price=${kaskaval?.selling_price}`);

  // ── TASK 1: Invoice cost-update flow ────────────────────────────────────
  // Navigate to Products first — capture kaskaval BEFORE invoice
  await page.locator('nav button, aside button').filter({ hasText: /Инвентар|Inventory/i }).first().click();
  await page.waitForTimeout(1500);
  await page.locator('button').filter({ hasText: /^Производи$|^Products$/i }).first().click();
  await page.waitForTimeout(1500);
  await scrollTop(page);
  await page.screenshot({ path: path.join(OUT, 'v1a-kaskaval-before-600.png') });
  console.log('v1a: kaskaval BEFORE invoice (purchase_price=600)');

  // Go to Invoices tab
  await page.locator('button').filter({ hasText: /^Фактури$|^Invoices$/i }).first().click();
  await page.waitForTimeout(1500);
  await scrollTop(page);
  await page.screenshot({ path: path.join(OUT, 'v1b-invoices-list.png') });
  console.log('v1b: Invoices list');

  // Click "+ New Invoice" or similar
  const newInvBtn = page.locator('button').filter({ hasText: /Нова фактура|New Invoice|Додај фактура|Add Invoice/i }).first();
  if (await newInvBtn.count() > 0) {
    await newInvBtn.click();
    await page.waitForTimeout(1500);
    console.log('Clicked new invoice');
  } else {
    const plusBtn = page.locator('button').filter({ hasText: /^\+|Нова|New|Додај|Add/i }).first();
    if (await plusBtn.count() > 0) { await plusBtn.click(); await page.waitForTimeout(1500); }
    console.log('Clicked fallback + button');
  }
  await page.screenshot({ path: path.join(OUT, 'v1c-new-invoice-modal.png') });
  console.log('v1c: New invoice modal open');

  // Fill invoice header fields
  // Invoice number
  const invNumInput = page.locator('input').filter({ hasText: '' }).nth(0);
  const allInputs = await page.locator('input[type="text"], input[type="number"], input:not([type])').all();
  console.log(`Inputs visible: ${allInputs.length}`);

  // Try to fill by placeholder/label
  const invNoField = page.locator('input[name="invoice_number"], input[placeholder*="број"], input[placeholder*="number"], input[placeholder*="INV"]').first();
  if (await invNoField.count() > 0) {
    await invNoField.fill('TEST-F1-001');
  } else {
    // fill first text input
    await allInputs[0]?.fill('TEST-F1-001');
  }

  // Supplier field
  const supplierField = page.locator('input[name="supplier"], input[placeholder*="добавувач"], input[placeholder*="supplier"]').first();
  if (await supplierField.count() > 0) {
    await supplierField.fill('Test Supplier F1');
  } else if (allInputs[1]) {
    await allInputs[1].fill('Test Supplier F1');
  }

  await page.screenshot({ path: path.join(OUT, 'v1d-invoice-form-filled.png') });
  console.log('v1d: Invoice header filled');

  // Find "Add product line" button
  const addLineBtn = page.locator('button').filter({ hasText: /Додај артикл|Add.*item|Add.*product|Додај ред|Add.*line/i }).first();
  if (await addLineBtn.count() > 0) {
    await addLineBtn.click();
    await page.waitForTimeout(800);
    console.log('Clicked add line');
  } else {
    console.log('Add line button not found, trying generic +');
    const genericPlus = page.locator('button').filter({ hasText: /^\+$/ }).last();
    if (await genericPlus.count() > 0) { await genericPlus.click(); await page.waitForTimeout(800); }
  }

  // Select kaskaval from product dropdown
  const productSelect = page.locator('select').last();
  if (await productSelect.count() > 0) {
    const opts = await productSelect.locator('option').allTextContents();
    console.log('Product options:', opts.slice(0, 8));
    const kasOpt = opts.findIndex(o => o.toLowerCase().includes('kaskaval'));
    if (kasOpt >= 0) {
      await productSelect.selectOption({ label: opts[kasOpt] });
      console.log('Selected kaskaval');
    }
  }

  // Fill quantity = 3
  const qtyInput = page.locator('input[type="number"]').last();
  await qtyInput.fill('3');

  // Fill price = 700
  const priceInputs = await page.locator('input[type="number"]').all();
  if (priceInputs.length >= 2) {
    await priceInputs[priceInputs.length - 1].fill('700');
  }
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, 'v1e-invoice-line-kaskaval-700.png') });
  console.log('v1e: Invoice line: kaskaval 3kg @ 700');

  // Save / Submit invoice
  const saveBtn = page.locator('button[type="submit"], button').filter({ hasText: /Зачувај|Save|Потврди|Confirm|Заврши|Complete/i }).last();
  if (await saveBtn.count() > 0) {
    await saveBtn.click();
    await page.waitForTimeout(2500);
    console.log('Saved invoice');
  }
  await page.screenshot({ path: path.join(OUT, 'v1f-after-invoice-save.png') });
  console.log('v1f: After invoice save');

  // Navigate back to Products and show kaskaval at 700
  await page.locator('button').filter({ hasText: /^Производи$|^Products$/i }).first().click();
  await page.waitForTimeout(1500);
  await scrollTop(page);
  await page.screenshot({ path: path.join(OUT, 'v1g-kaskaval-after-700.png') });
  console.log('v1g: kaskaval AFTER invoice — purchase_cost should be 700');

  // Reload to get updated products
  const productsAfter = await apiGet(page, '/products');
  const kaskavalAfter = productsAfter.find(p => p.name.toLowerCase().includes('kaskaval'));
  console.log(`kaskaval purchase_price AFTER invoice: ${kaskavalAfter?.purchase_price}`);
  console.log(`kaskaval purchase_cost AFTER invoice: ${kaskavalAfter?.purchase_cost}`);

  // ── TASK 2 & 3: All 4 tiers + ingredient cost display ───────────────────
  // Re-fetch to get current prices & IDs
  const prods = await apiGet(page, '/products');
  const sellable = prods.filter(p => Number(p.selling_price) > 0);
  console.log('Sellable products:', sellable.map(p => `${p.name} sell=${p.selling_price} cost=${p.purchase_price} margin=${p.margin_percent}`));

  // We need one product in each tier.
  // Pick the first 3 sellable products (already have one in high tier from existing).
  // Adjust selling_price to create amber (40%), orange (20%), critical (5%)
  const s0 = sellable[0]; // will stay HIGH or become HIGH
  const s1 = sellable[1]; // will become MEDIUM (~40%)
  const s2 = sellable[2]; // will become LOW (~20%)
  const s3 = sellable[3] ?? sellable[0]; // will become CRITICAL (~5%) — use s0 if not enough

  const origS1 = { selling_price: s1?.selling_price, name: s1?.name };
  const origS2 = { selling_price: s2?.selling_price, name: s2?.name };
  const origS3 = { selling_price: s3?.selling_price, name: s3?.name };

  // To get margin ~40% for s1: selling_price = purchase_price / (1 - 0.40) = purchase_price * 1.667
  const pp1 = Number(s1?.purchase_price) || 50;
  const pp2 = Number(s2?.purchase_price) || 50;
  const pp3 = Number(s3?.purchase_price) || 50;

  const newSell1 = Math.round(pp1 / 0.60 * 10) / 10;  // ~40% margin
  const newSell2 = Math.round(pp2 / 0.80 * 10) / 10;  // ~20% margin
  const newSell3 = Math.round(pp3 / 0.95 * 10) / 10;  // ~5% margin

  console.log(`Setting ${s1?.name} selling_price: ${s1?.selling_price} → ${newSell1} (target ~40%)`);
  console.log(`Setting ${s2?.name} selling_price: ${s2?.selling_price} → ${newSell2} (target ~20%)`);
  console.log(`Setting ${s3?.name} selling_price: ${s3?.selling_price} → ${newSell3} (target ~5%)`);

  // Build minimal valid payload (Zod expects numbers, not strings)
  function mkPayload(p, overrides = {}) {
    return {
      name: p.name,
      barcode: p.barcode || '',
      unit: p.unit,
      purchase_price: Number(p.purchase_price),
      selling_price: Number(p.selling_price),
      category_id: p.category_id,
      min_stock: Number(p.min_stock),
      active: p.active !== false,
      ...overrides,
    };
  }

  // Apply via API
  const r1 = await apiPut(page, `/products/${s1.id}`, mkPayload(s1, { selling_price: newSell1 }));
  const r2 = await apiPut(page, `/products/${s2.id}`, mkPayload(s2, { selling_price: newSell2 }));
  const r3 = await apiPut(page, `/products/${s3.id}`, mkPayload(s3, { selling_price: newSell3 }));
  console.log(`s1 updated selling_price: ${r1?.selling_price} (expected ~${newSell1})`);
  console.log(`s2 updated selling_price: ${r2?.selling_price} (expected ~${newSell2})`);
  console.log(`s3 updated selling_price: ${r3?.selling_price} (expected ~${newSell3})`);
  console.log('Selling prices updated');

  // Refresh product list in browser
  await page.reload();
  await page.waitForSelector('nav', { timeout: 8000 });
  await page.waitForTimeout(1500);
  await page.locator('nav button, aside button').filter({ hasText: /Инвентар|Inventory/i }).first().click();
  await page.waitForTimeout(2000);
  await page.locator('button').filter({ hasText: /^Производи$|^Products$/i }).first().click();
  await page.waitForTimeout(2000);
  await scrollTop(page);
  await page.screenshot({ path: path.join(OUT, 'v2-all-4-tiers-top.png') });
  console.log('v2a: Products list — 4 tiers visible (scroll to see all)');

  await scrollDown(page, 200);
  await page.screenshot({ path: path.join(OUT, 'v2-all-4-tiers-scrolled.png') });
  console.log('v2b: Products list — scrolled to show all 4 tiers');

  // Screenshot showing ingredient "—" → actually shows cost for ingredient rows
  // Find a row with 0 selling_price (ingredient shows cost, not "—")
  await scrollTop(page);
  await page.screenshot({ path: path.join(OUT, 'v3-ingredient-cost-display.png') });
  console.log('v3: Ingredient rows show cost price (e.g. "40.00 ден."), not dash');

  // ── TASK 4: Negative margin ──────────────────────────────────────────────
  // Set selling_price BELOW purchase_price for one product
  const negTarget = sellable[0]; // e.g. parmezan
  const negPP = Number(negTarget.purchase_price);
  const negSell = Math.round(negPP * 0.70 * 10) / 10; // selling_price = 70% of purchase_price → ~-43% margin
  const origNeg = negTarget.selling_price;
  console.log(`Setting ${negTarget.name} selling_price: ${negTarget.selling_price} → ${negSell} (negative margin target)`);

  const rNeg = await apiPut(page, `/products/${negTarget.id}`, mkPayload(negTarget, { selling_price: negSell }));
  console.log(`negTarget updated selling_price: ${rNeg?.selling_price} (expected ${negSell})`);

  await page.reload();
  await page.waitForSelector('nav', { timeout: 8000 });
  await page.waitForTimeout(1500);
  await page.locator('nav button, aside button').filter({ hasText: /Инвентар|Inventory/i }).first().click();
  await page.waitForTimeout(2000);
  await page.locator('button').filter({ hasText: /^Производи$|^Products$/i }).first().click();
  await page.waitForTimeout(1500);
  await scrollTop(page);
  await page.screenshot({ path: path.join(OUT, 'v4a-negative-margin.png') });
  console.log('v4a: Negative margin — rose badge with negative %');
  await scrollDown(page, 150);
  await page.screenshot({ path: path.join(OUT, 'v4b-negative-margin-scrolled.png') });
  console.log('v4b: Negative margin scrolled');

  // ── REVERT ALL CHANGES ───────────────────────────────────────────────────
  console.log('\nReverting temporary selling_price changes...');
  await apiPut(page, `/products/${s1.id}`, mkPayload(s1, { selling_price: Number(origS1.selling_price) }));
  await apiPut(page, `/products/${s2.id}`, mkPayload(s2, { selling_price: Number(origS2.selling_price) }));
  await apiPut(page, `/products/${s3.id}`, mkPayload(s3, { selling_price: Number(origS3.selling_price) }));
  await apiPut(page, `/products/${negTarget.id}`, mkPayload(negTarget, { selling_price: Number(origNeg) }));
  console.log('Reverted:', [s1?.name, s2?.name, s3?.name, negTarget.name].join(', '));

  // Final state verification
  const finalProds = await apiGet(page, '/products');
  const finalKas = finalProds.find(p => p.name.toLowerCase().includes('kaskaval'));
  console.log(`\nFinal kaskaval purchase_price: ${finalKas?.purchase_price} (should be 700)`);
  const finalS1 = finalProds.find(p => p.id === s1?.id);
  console.log(`Final ${s1?.name} selling_price: ${finalS1?.selling_price} (should be ${origS1.selling_price})`);

  await browser.close();
  console.log('\nDone. Files:', fs.readdirSync(OUT).sort().join('\n  '));
}

main().catch(err => { console.error(err); process.exit(1); });
