/**
 * F1 tier screenshots — all 4 margin tiers + negative margin
 */
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '../screenshots/feature-1-verify');
fs.mkdirSync(OUT, { recursive: true });

const BASE = 'http://localhost:4000';

async function scrollDown(page, by = 300) {
  try { await page.locator('div.flex-1.overflow-y-auto').first().evaluate((el, b) => { el.scrollBy(0, b); }, by); } catch {}
  await page.waitForTimeout(200);
}
async function scrollTop(page) {
  try { await page.locator('div.flex-1.overflow-y-auto').first().evaluate(el => { el.scrollTop = 0; }); } catch {}
  await page.waitForTimeout(150);
}
async function login(page) {
  await page.goto(`${BASE}/`);
  await page.waitForSelector('input[type="password"]', { timeout: 10000 });
  await page.locator('input[type="email"], input[type="text"]').first().fill('admin@gastropro.mk');
  await page.locator('input[type="password"]').first().fill('admin123');
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(2500);
}
async function getToken(page) { return page.evaluate(() => localStorage.getItem('gastropro_token')); }
async function apiGet(page, path) {
  const tok = await getToken(page);
  return page.evaluate(async ([url, t]) => { const r = await fetch(url, { headers: { Authorization: `Bearer ${t}` } }); return r.json(); }, [`${BASE}/api${path}`, tok]);
}
async function apiPut(page, path, body) {
  const tok = await getToken(page);
  return page.evaluate(async ([url, b, t]) => {
    const r = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }, body: JSON.stringify(b) });
    return r.json();
  }, [`${BASE}/api${path}`, body, tok]);
}
function mkPayload(p, overrides = {}) {
  // barcode: empty string → undefined so pg writes NULL (avoids unique constraint with other NULL-barcode products)
  const barcode = p.barcode ? p.barcode : undefined;
  return { name: p.name, barcode, unit: p.unit, purchase_price: Number(p.purchase_price), selling_price: Number(p.selling_price), category_id: p.category_id, min_stock: Number(p.min_stock), active: p.active !== false, ...overrides };
}
async function goProducts(page) {
  await page.locator('nav button, aside button').filter({ hasText: /Инвентар|Inventory/i }).first().click();
  await page.waitForTimeout(1500);
  await page.locator('button').filter({ hasText: /^Производи$|^Products$/i }).first().click();
  await page.waitForTimeout(2000);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1400, height: 900 });
  await login(page);

  // Fetch products via API
  const prods = await apiGet(page, '/products');
  const sellable = prods.filter(p => Number(p.selling_price) > 0);
  console.log('Sellable products:', sellable.map(p => `${p.name}: sell=${p.selling_price} cost=${p.purchase_price} margin=${p.margin_percent}`));

  if (sellable.length < 4) { console.error('Need ≥4 sellable products'); await browser.close(); process.exit(1); }

  // Choose 4 products: s0 stays HIGH, s1→MEDIUM(40%), s2→LOW(20%), s3→CRITICAL(5%)
  const [s0, s1, s2, s3] = sellable;
  const origSell = [s0, s1, s2, s3].map(p => Number(p.selling_price));

  const pp = (p) => Number(p.purchase_price);
  const targets = [
    Number(s0.selling_price),             // keep HIGH (62-73%)
    Math.round(pp(s1) / 0.60 * 10) / 10, // ~40% → MEDIUM
    Math.round(pp(s2) / 0.80 * 10) / 10, // ~20% → LOW
    Math.round(pp(s3) / 0.95 * 10) / 10, // ~5%  → CRITICAL
  ];

  console.log(`Targets: ${[s0,s1,s2,s3].map((p,i) => `${p.name}→${targets[i]}`).join(', ')}`);

  // Apply changes sequentially
  const r1 = await apiPut(page, `/products/${s1.id}`, mkPayload(s1, { selling_price: targets[1] }));
  const r2 = await apiPut(page, `/products/${s2.id}`, mkPayload(s2, { selling_price: targets[2] }));
  const r3 = await apiPut(page, `/products/${s3.id}`, mkPayload(s3, { selling_price: targets[3] }));
  console.log(`s1: ${r1?.name} sell=${r1?.selling_price} margin=${r1?.margin_percent}`);
  console.log(`s2: ${r2?.name} sell=${r2?.selling_price} margin=${r2?.margin_percent}`);
  console.log(`s3: ${r3?.name} sell=${r3?.selling_price} margin=${r3?.margin_percent}`);

  // Reload and navigate to Products
  await page.reload();
  await page.waitForSelector('nav button', { timeout: 8000 });
  await page.waitForTimeout(1000);
  await goProducts(page);
  await scrollTop(page);

  await page.screenshot({ path: path.join(OUT, 'v2a-4-tiers-top.png') });
  console.log('v2a: Products list top — should show HIGH + MEDIUM');
  await scrollDown(page, 250);
  await page.screenshot({ path: path.join(OUT, 'v2b-4-tiers-more.png') });
  console.log('v2b: Scrolled — should show LOW + CRITICAL');
  await scrollDown(page, 300);
  await page.screenshot({ path: path.join(OUT, 'v2c-4-tiers-rest.png') });
  console.log('v2c: Rest of products — ingredients showing cost');

  // ── Item 4: Negative margin (sell < cost) ────────────────────────────────
  const neg = s0; // highest margin product → set sell below cost
  const negSell = Math.round(pp(neg) * 0.70 * 10) / 10;
  console.log(`\nSetting ${neg.name} sell ${neg.selling_price} → ${negSell} (below cost ${neg.purchase_price})`);

  const rn = await apiPut(page, `/products/${neg.id}`, mkPayload(neg, { selling_price: negSell }));
  console.log(`Updated: ${rn.name} sell=${rn.selling_price} margin=${rn.margin_percent}`);

  await page.reload();
  await page.waitForSelector('nav button', { timeout: 8000 });
  await page.waitForTimeout(1000);
  await goProducts(page);
  await scrollTop(page);
  await page.screenshot({ path: path.join(OUT, 'v4-negative-margin.png') });
  console.log('v4: Negative margin — rose badge with negative %');
  await scrollDown(page, 250);
  await page.screenshot({ path: path.join(OUT, 'v4b-negative-margin-more.png') });

  // ── Revert all ───────────────────────────────────────────────────────────
  console.log('\nReverting...');
  await apiPut(page, `/products/${s0.id}`, mkPayload(s0, { selling_price: origSell[0] }));
  await apiPut(page, `/products/${s1.id}`, mkPayload(s1, { selling_price: origSell[1] }));
  await apiPut(page, `/products/${s2.id}`, mkPayload(s2, { selling_price: origSell[2] }));
  await apiPut(page, `/products/${s3.id}`, mkPayload(s3, { selling_price: origSell[3] }));
  const check = await apiGet(page, '/products');
  const sellCheck = check.filter(p => Number(p.selling_price) > 0);
  console.log('Post-revert sellable prices:', sellCheck.map(p => `${p.name}=${p.selling_price}`).join(', '));

  await browser.close();
  const files = fs.readdirSync(OUT).sort();
  console.log('\nAll files in', OUT, ':\n ', files.join('\n  '));
}

main().catch(err => { console.error(err); process.exit(1); });
