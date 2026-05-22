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

  // ── Login ────────────────────────────────────────────────────────────────
  await page.goto(`${BASE}/`);
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"]', 'admin@gastropro.mk');
  await page.fill('input[type="password"]', 'admin123');
  await Promise.all([
    page.waitForLoadState('networkidle'),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForTimeout(1000);
  console.log(`✅ Logged in — URL: ${page.url()}`);

  // ── Navigate to Settings (sidebar) ──────────────────────────────────────
  await page.click('text=Settings, text=Подесувања', { timeout: 8000 }).catch(async () => {
    // Try sidebar link selector
    const links = await page.locator('a, button, [role="button"]').all();
    for (const link of links) {
      const txt = await link.textContent().catch(() => '');
      if (txt.toLowerCase().includes('settings') || txt.includes('Подесув')) {
        await link.click();
        break;
      }
    }
  });
  await page.waitForTimeout(1500);
  console.log(`✅ Navigated — URL: ${page.url()}`);

  // ── Scroll through Settings to find Warehouses section ──────────────────
  // The page is a long scroll; section title "Магацини" is rendered as uppercase via CSS
  // but DOM text is "Магацини" — scroll incrementally until found
  let warehousesFound = false;
  for (let scroll = 0; scroll <= 5000; scroll += 600) {
    await page.evaluate(y => window.scrollTo(0, y), scroll);
    await page.waitForTimeout(300);
    const found = await page.locator(':text-is("Магацини"), :text-is("МАГАЦИНИ"), :text-is("Warehouses")').count();
    if (found > 0) { warehousesFound = true; break; }
  }

  if (!warehousesFound) {
    // Full-page screenshot to diagnose
    await page.screenshot({ path: join(OUT, 'err-full-page.png'), fullPage: true });
    throw new Error('Warehouses section heading not found — see err-full-page.png');
  }
  console.log('✅ Found Warehouses section');

  // Scroll so section is in view
  await page.locator(':text-is("Магацини"), :text-is("МАГАЦИНИ"), :text-is("Warehouses")').first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);

  // Wait for warehouses list to load (the API call may take a moment)
  await page.waitForTimeout(1000);

  // (a) Warehouses list
  await page.screenshot({ path: join(OUT, 'a-warehouses-list.png') });
  console.log('📸 (a) Warehouses list with main badge');

  // ── (b) Create modal ─────────────────────────────────────────────────────
  await page.locator('button:has-text("Нов магацин"), button:has-text("New Warehouse")').first().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT, 'b-create-modal.png') });
  console.log('📸 (b) Create modal');

  // Fill and submit
  await page.locator('.fixed input[type="text"], .fixed input:not([type="password"]), dialog input').first().fill('Тераса');
  await page.click('.fixed button[type="submit"]');
  await page.waitForTimeout(1200);
  console.log('✅ Created Тераса');

  // Scroll to warehouses again (might have shifted)
  await page.locator(':text-is("Магацини"), :text-is("МАГАЦИНИ"), :text-is("Warehouses")').first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);

  // ── (c) Edit modal ───────────────────────────────────────────────────────
  // Find the Тераса row — it's a grid row; click the first action button (pencil)
  const terAsaLocator = page.locator('text=Тераса').first();
  await terAsaLocator.scrollIntoViewIfNeeded();
  // The row container has two buttons; first is edit (pencil), second is delete (trash)
  // Navigate to parent grid row and find first button
  const editBtn = page.locator('[title*="Уреди"], [title*="Edit"]').first();
  await editBtn.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT, 'c-edit-modal.png') });
  console.log('📸 (c) Edit modal');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // ── (d) Delete dialog (for Тераса) ───────────────────────────────────────
  await page.locator('[title*="Избриши"], [title*="Delete"]').first().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT, 'd-delete-dialog.png') });
  console.log('📸 (d) Delete confirmation dialog');

  // Cancel, then try delete on main warehouse
  await page.click('button:has-text("Откажи"), button:has-text("Cancel")');
  await page.waitForTimeout(400);

  // ── (e) Main warehouse delete button is disabled ─────────────────────────
  await page.locator(':text-is("Магацини"), :text-is("МАГАЦИНИ")').first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const mainDeleteBtn = page.locator('[title*="Не може"], [title*="cannot"], [title*="Cannot"]').first();
  const isDisabled = await mainDeleteBtn.isDisabled().catch(() => {
    return page.locator('button[disabled]').count().then(n => n > 0);
  });
  console.log(`Main delete disabled: ${isDisabled}`);
  await page.screenshot({ path: join(OUT, 'e-main-disabled.png') });
  console.log('📸 (e) Main warehouse — delete button disabled');

  await browser.close();
  console.log(`\n✅ All screenshots saved to: ${OUT}`);
})().catch(async err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
