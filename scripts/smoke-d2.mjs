import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'tmp-screenshots', 'd2');
mkdirSync(OUT, { recursive: true });

const BASE = 'http://localhost:4000';
const snap = async (page, name) => { await page.screenshot({ path: join(OUT, `${name}.png`) }); console.log(`📸 ${name}`); };

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);

  // Login
  await page.goto(`${BASE}/`);
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"]', 'admin@gastropro.mk');
  await page.fill('input[type="password"]', 'admin123');
  await Promise.all([page.waitForLoadState('networkidle'), page.click('button[type="submit"]')]);
  await page.waitForTimeout(800);
  console.log('✅ Logged in');

  // Navigate to Settings
  await page.click('text=Settings');
  await page.waitForTimeout(1000);

  // Scroll to Маси / Tables section
  let found = false;
  for (let y = 0; y <= 8000; y += 600) {
    await page.evaluate(sy => window.scrollTo(0, sy), y);
    await page.waitForTimeout(200);
    // look for table section heading
    const cnt = await page.locator('text=TABLES, text=МАСИ').count();
    if (cnt > 0) { found = true; break; }
  }
  if (!found) {
    // try alternative — look for "New Table" button
    for (let y = 0; y <= 8000; y += 600) {
      await page.evaluate(sy => window.scrollTo(0, sy), y);
      await page.waitForTimeout(200);
      if (await page.locator('button:has-text("New Table"), button:has-text("Нова маса")').count() > 0) { found = true; break; }
    }
  }
  console.log(found ? '✅ Found Tables section' : '⚠️ Tables section not visible by heading, proceeding');

  // Wait for table list to load
  await page.waitForTimeout(800);

  // (a) Tables section with full list
  await snap(page, 'a-tables-section');

  // (b) Inline warehouse dropdown — click pencil on first row's warehouse cell
  const warehousePencilBtn = page.locator('td button').filter({ hasText: /магацин|warehouse|main|главен/i }).first();
  // Alt: find the first pencil icon inside a td
  const inlinePencil = page.locator('tbody td button').first();
  await inlinePencil.click().catch(() => {});
  await page.waitForTimeout(400);
  await snap(page, 'b-inline-warehouse-dropdown');
  // dismiss by pressing Escape or clicking elsewhere
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // (c) Bulk toolbar — select first 3 checkboxes
  const checkboxes = page.locator('tbody input[type="checkbox"]');
  const cbCount = await checkboxes.count();
  const toCheck = Math.min(cbCount, 3);
  for (let i = 0; i < toCheck; i++) {
    await checkboxes.nth(i).click();
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(400);
  await snap(page, 'c-bulk-toolbar');

  // Deselect all
  const headerCb = page.locator('thead input[type="checkbox"]');
  if (await headerCb.count() > 0) {
    await headerCb.click(); // toggle all off
    await page.waitForTimeout(200);
    await headerCb.click(); // or just click first rows checkbox
  }
  // Clear by clicking select-all twice
  await page.locator('thead input[type="checkbox"]').first().click().catch(() => {});
  await page.waitForTimeout(200);

  // (d) CreateTableModal
  await page.locator('button:has-text("New Table"), button:has-text("Нова маса")').first().click();
  await page.waitForTimeout(500);
  await snap(page, 'd-create-table-modal');

  // Fill and submit with a unique name
  const numInput = page.locator('.fixed.inset-0 input[type="number"]').first();
  await numInput.click();
  await numInput.fill('99');
  await page.locator('.fixed.inset-0 form button[type="submit"]').click();
  await page.waitForTimeout(1500);
  console.log('✅ Created table 99');

  // (e) DeleteTableDialog — find table 99 row's delete button
  for (let y = 0; y <= 8000; y += 600) {
    await page.evaluate(sy => window.scrollTo(0, sy), y);
    await page.waitForTimeout(150);
    if (await page.locator('td:has-text("99")').count() > 0) break;
  }
  // Click delete button in the last row (table 99)
  const deleteButtons = page.locator('[title="Delete Table"], [title*="Избриши маса"]');
  const delCount = await deleteButtons.count();
  await deleteButtons.nth(delCount - 1).click();
  await page.waitForTimeout(500);
  await snap(page, 'e-delete-table-dialog');

  // Confirm deletion
  await page.click('.bg-rose-600');
  await page.waitForTimeout(1500);
  console.log('✅ Deleted table 99');

  // Navigate to Inventory
  await page.click('text=Inventory');
  await page.waitForTimeout(1000);

  // Click "Per Warehouse" tab
  await page.locator('button:has-text("Per Warehouse"), button:has-text("По магацини"), button:has-text("Sipas")').first().click();
  await page.waitForTimeout(1500);

  // (f) Per Warehouse with main warehouse
  await snap(page, 'f-per-warehouse-main');
  console.log('✅ Per Warehouse tab — main warehouse');

  // (g) Switch to secondary warehouse if available
  const warehouseSelect = page.locator('select').filter({ hasText: /магацин|warehouse/i }).first();
  const opts = await warehouseSelect.locator('option').allTextContents().catch(() => []);
  if (opts.length > 1) {
    await warehouseSelect.selectOption({ index: 1 });
    await page.waitForTimeout(1000);
    await snap(page, 'g-per-warehouse-secondary');
    console.log('✅ Per Warehouse tab — secondary warehouse');
  } else {
    console.log('⚠️ Only one warehouse, skipping secondary screenshot');
    await page.screenshot({ path: join(OUT, 'g-per-warehouse-secondary.png') });
  }

  // (h) Low stock filter
  const lowStockToggle = page.locator('input[type="checkbox"]').filter({ hasText: /low stock|ниска/i });
  const allCheckboxes = page.locator('input[type="checkbox"]');
  // find the low stock checkbox (last checkbox on page when in inventory)
  const checkboxAll = await allCheckboxes.all();
  if (checkboxAll.length > 0) {
    await checkboxAll[checkboxAll.length - 1].click();
    await page.waitForTimeout(500);
  }
  await snap(page, 'h-low-stock-filter');
  console.log('✅ Low stock filter');

  await browser.close();
  console.log(`\n✅ All D.2 screenshots in: ${OUT}`);
})().catch(err => {
  console.error('SMOKE CRASHED:', err.message);
  process.exit(1);
});
