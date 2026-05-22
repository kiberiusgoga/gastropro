import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'tmp-screenshots');
mkdirSync(OUT, { recursive: true });

const BASE = 'http://localhost:4000';

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
  await Promise.all([
    page.waitForLoadState('networkidle'),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForTimeout(800);

  // Navigate to Settings
  await page.click('text=Settings');
  await page.waitForTimeout(1000);

  // Scroll to Warehouses
  for (let y = 0; y <= 5000; y += 400) {
    await page.evaluate(sy => window.scrollTo(0, sy), y);
    await page.waitForTimeout(200);
    if (await page.locator('text=Тераса').count() > 0) break;
  }
  await page.waitForTimeout(600);

  // ── (c) Edit modal for Тераса ────────────────────────────────────────────
  const editBtns = page.locator('[title="Edit Warehouse"]');
  // Second edit button is for Тераса (first is for Главен магацин)
  await editBtns.nth(1).click();
  await page.waitForSelector('[class*="bg-surface"][class*="rounded-card"]', { state: 'visible', timeout: 5000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(OUT, 'c-edit-modal.png') });
  console.log('📸 (c) Edit modal');
  // Close via Cancel button (no ESC handler in modal)
  await page.click('button:has-text("Cancel")');
  await page.waitForTimeout(600);

  // ── (d) Delete dialog for Тераса ────────────────────────────────────────
  // Scroll back to warehouses section
  await page.locator('text=Тераса').first().scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(400);

  const deleteBtns = page.locator('[title="Delete Warehouse"]');
  await deleteBtns.nth(0).click();
  // Wait for the dialog: look for the rose/danger confirm button
  await page.waitForSelector('.bg-rose-600', { state: 'visible', timeout: 5000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(OUT, 'd-delete-dialog.png') });
  console.log('📸 (d) Delete dialog');

  // ── (e) Click confirm to delete Тераса ───────────────────────────────────
  await page.click('.bg-rose-600');
  await page.waitForTimeout(2000);
  await page.waitForTimeout(600);
  console.log('✅ Тераса deleted');

  // Now try to delete main warehouse — button should be disabled
  await page.screenshot({ path: join(OUT, 'e-after-delete.png') });
  console.log('📸 (e) After delete — main warehouse remains');

  // Confirm delete button for main warehouse is disabled
  const mainDeleteTitle = await page.locator('[title="Cannot delete main warehouse"], [title*="cannot"], [title*="Не може"]').first().isDisabled().catch(() => null);
  console.log(`Main delete disabled: ${mainDeleteTitle}`);

  // Open new warehouse, name it "Тест" and try to delete THAT as main — no, instead
  // let's just show the disabled state: main's trash icon has opacity-30 per CSS
  await page.screenshot({ path: join(OUT, 'e-main-only.png') });
  console.log('📸 (e) Main warehouse only — trash button disabled/dimmed');

  await browser.close();
  console.log(`\n✅ Done. Screenshots in: ${OUT}`);
})().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
