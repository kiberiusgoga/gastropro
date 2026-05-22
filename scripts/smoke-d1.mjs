import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'tmp-screenshots', 'smoke');
mkdirSync(OUT, { recursive: true });

const BASE = 'http://localhost:4000';
const steps = [];
const pass = (label) => { steps.push(`✅ ${label}`); console.log(`✅ ${label}`); };
const fail = (label, detail) => { steps.push(`❌ ${label}: ${detail}`); console.error(`❌ ${label}: ${detail}`); };
const snap = async (page, name) => page.screenshot({ path: join(OUT, `${name}.png`) });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(12000);

  // (a) Login
  await page.goto(`${BASE}/`);
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"]', 'admin@gastropro.mk');
  await page.fill('input[type="password"]', 'admin123');
  await Promise.all([page.waitForLoadState('networkidle'), page.click('button[type="submit"]')]);
  await page.waitForTimeout(800);
  pass('Login as Admin');

  // (b) Navigate to Settings
  await page.click('text=Settings');
  await page.waitForTimeout(1000);
  pass('Navigate to Settings');

  // (c) Scroll to Магацини
  let found = false;
  for (let y = 0; y <= 6000; y += 500) {
    await page.evaluate(sy => window.scrollTo(0, sy), y);
    await page.waitForTimeout(200);
    if (await page.locator('text=Главен магацин').count() > 0) { found = true; break; }
  }
  if (!found) { fail('Scroll to Магацини', 'section not found'); await browser.close(); process.exit(1); }
  pass('Scroll to Магацини section');

  // (d) Click "+ Нов магацин"
  await page.locator('button:has-text("New Warehouse"), button:has-text("Нов магацин")').first().click();
  await page.waitForTimeout(500);
  pass('Click + New Warehouse — modal opened');

  // (e) Type "Тестен" in name field
  await page.waitForSelector('.fixed.inset-0 input', { state: 'visible', timeout: 8000 });
  const input = page.locator('.fixed.inset-0 input').first();
  await input.click();
  await input.type('Тестен');
  await page.waitForTimeout(300);
  pass('Type "Тестен" in name field');

  // (f) Click Save — target submit inside modal form (not the header "+ New Warehouse" button)
  await page.locator('.fixed.inset-0 form button[type="submit"]').click();
  await page.waitForTimeout(2000);
  await snap(page, 'f-after-submit');
  // Check if modal closed (success) or error appeared
  const modalStillOpen = await page.locator('.fixed.inset-0 input').count();
  if (modalStillOpen > 0) {
    // Modal still open — check for inline error (text-rose-400)
    const errText = await page.locator('.fixed.inset-0 p.text-rose-400, .fixed.inset-0 [class*="text-rose"]').first().textContent().catch(() => '');
    if (errText) {
      fail('Create "Тестен"', `409 inline error: "${errText.trim()}" — will proceed with existing`);
      await page.locator('.fixed.inset-0 button').filter({ hasText: /cancel|откажи/i }).first().click();
      await page.waitForTimeout(400);
    } else {
      fail('Create "Тестен"', 'modal still open, no error message visible');
      await browser.close(); process.exit(1);
    }
  } else {
    pass('Create "Тестен" — modal closed, warehouse created');
  }
  await snap(page, 'f-after-create');

  // (g) Verify "Тестен" in list
  await page.waitForTimeout(400);
  // Scroll to section
  for (let y = 0; y <= 6000; y += 500) {
    await page.evaluate(sy => window.scrollTo(0, sy), y);
    await page.waitForTimeout(150);
    if (await page.locator('text=Тестен').count() > 0) break;
  }
  const testenVisible = await page.locator('text=Тестен').count();
  if (testenVisible > 0) pass('Verify "Тестен" appears in list'); else fail('Verify "Тестен" in list', 'not found');
  await snap(page, 'g-list-with-testen');

  // (h) Click edit icon on "Тестен" row
  // Find the row containing "Тестен" and click its edit button
  const testenRow = page.locator('tr, [class*="row"], div').filter({ hasText: /^Тестен$/ }).first();
  const editBtn = page.locator('[title="Edit Warehouse"]').last(); // last = newest warehouse
  await editBtn.click();
  await page.waitForTimeout(500);
  pass('Click edit icon on "Тестен"');
  await snap(page, 'h-edit-modal');

  // (i) Rename to "Тестен Updated"
  await page.waitForSelector('.fixed.inset-0 input', { state: 'visible', timeout: 8000 });
  const editInput = page.locator('.fixed.inset-0 input').first();
  await editInput.click();
  // Clear and type to trigger React onChange
  await editInput.selectText();
  await editInput.type('Тестен Updated');
  await page.waitForTimeout(300);
  pass('Rename to "Тестен Updated"');

  // (j) Save
  await page.click('button:has-text("Save")');
  await page.waitForTimeout(1200);
  pass('Save rename');
  await snap(page, 'j-after-rename');

  // (k) Verify name changed
  for (let y = 0; y <= 6000; y += 500) {
    await page.evaluate(sy => window.scrollTo(0, sy), y);
    await page.waitForTimeout(150);
    if (await page.locator('text=Тестен Updated').count() > 0) break;
  }
  const renamedVisible = await page.locator('text=Тестен Updated').count();
  if (renamedVisible > 0) pass('Verify "Тестен Updated" shown in list'); else fail('Verify rename', '"Тестен Updated" not visible');

  // (l) Click delete on "Тестен Updated"
  const deleteBtns = page.locator('[title="Delete Warehouse"]');
  const deleteBtnCount = await deleteBtns.count();
  await deleteBtns.nth(deleteBtnCount - 1).click(); // last = "Тестен Updated"
  await page.waitForSelector('.bg-rose-600', { state: 'visible', timeout: 5000 });
  await page.waitForTimeout(400);
  pass('Click delete icon — dialog opened');
  await snap(page, 'l-delete-dialog');

  // (m) Confirm deletion
  await page.click('.bg-rose-600');
  await page.waitForTimeout(1500);
  pass('Confirm delete');
  await snap(page, 'm-after-delete');

  // (n) Verify gone from list
  for (let y = 0; y <= 6000; y += 500) {
    await page.evaluate(sy => window.scrollTo(0, sy), y);
    await page.waitForTimeout(150);
    if (await page.locator('text=Главен магацин').count() > 0) break;
  }
  const updatedGone = await page.locator('text=Тестен Updated').count();
  if (updatedGone === 0) pass('"Тестен Updated" gone from list'); else fail('"Тестен Updated" still visible after delete', '');
  await snap(page, 'n-list-after-delete');

  // (o) Click delete on Главен магацин — should be disabled
  const mainDeleteDisabled = await page.locator('[title="Delete Warehouse"][disabled], button[disabled][title*="delete"], button[disabled][title*="Delete"]').count();
  // Try clicking via the trash icon for Главен магацин — it should be disabled (opacity-30)
  // The first delete button (if there's only one warehouse left) should be for Главен
  const allDelBtns = page.locator('[title="Delete Warehouse"]');
  const allCount = await allDelBtns.count();

  if (allCount === 0) {
    // Button disabled completely (not in DOM as [title="Delete Warehouse"])
    pass('Delete button for Главен магацин is disabled/removed from DOM — cannot click');
  } else {
    const isDisabled = await allDelBtns.first().isDisabled();
    if (isDisabled) {
      pass('Delete button for Главен магацин is disabled attribute');
    } else {
      // Try clicking it anyway — should show CANNOT_DELETE_MAIN error
      await allDelBtns.first().click();
      await page.waitForTimeout(800);
      const dialogOpen = await page.locator('.bg-rose-600').count();
      if (dialogOpen > 0) {
        // dialog opened — click confirm to trigger error
        await page.click('.bg-rose-600');
        await page.waitForTimeout(1000);
        const errorMsg = await page.locator('text=главниот, text=Главен, text=main, text=cannot').first().textContent().catch(() => '');
        await snap(page, 'o-main-delete-error');
        if (errorMsg) pass(`Delete main → inline error: "${errorMsg.trim()}"`);
        else fail('Delete main', 'dialog opened but no error message found');
        // (r) Cancel
        await page.click('button:has-text("Cancel"), button:has-text("Откажи")');
        await page.waitForTimeout(400);
        pass('Cancel dialog');
      } else {
        pass('Delete button for Главен магацин is visually dimmed (opacity-30) but click has no effect');
      }
    }
  }

  await snap(page, 'p-final-state');

  await browser.close();

  console.log('\n─────────────────────────────────────────');
  console.log('SMOKE TEST RESULTS:');
  steps.forEach(s => console.log(s));
  const failed = steps.filter(s => s.startsWith('❌'));
  console.log(`\n${failed.length === 0 ? '✅ ALL STEPS PASSED' : `❌ ${failed.length} STEP(S) FAILED`}`);
})().catch(err => {
  console.error('SMOKE TEST CRASHED:', err.message);
  process.exit(1);
});
