/**
 * F4 — capture missing screenshots (settings email + expanded supplier)
 */
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '../screenshots/feature-4');
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:4000';

async function login(page) {
  await page.goto(`${BASE}/`);
  await page.waitForSelector('input[type="password"]', { timeout: 15000 });
  await page.locator('input[type="email"], input[type="text"]').first().fill('admin@gastropro.mk');
  await page.locator('input[type="password"]').first().fill('admin123');
  await page.locator('button[type="submit"]').first().click();
  await page.waitForSelector('nav button', { timeout: 15000 });
  await page.waitForTimeout(1000);
}

async function scrollToBottom(page) {
  await page.evaluate(() => {
    // Try all possible scrollable containers
    const selectors = [
      '.overflow-y-auto',
      'main .flex-1',
      'main',
      '[class*="overflow-y-auto"]',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.scrollHeight > el.clientHeight) {
        el.scrollTop = el.scrollHeight * 2;
      }
    }
    window.scrollTo(0, document.body.scrollHeight * 2);
    document.documentElement.scrollTop = document.documentElement.scrollHeight * 2;
  });
  await page.waitForTimeout(800);
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  // ── Screenshot: Settings Email section ────────────────────────────────────
  {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1400, height: 900 });
    await login(page);

    await page.getByRole('button', { name: /Подесувања|Settings/i }).first().click();
    await page.waitForTimeout(2000);

    // Scroll to email settings section by finding its header
    const emailSection = page.locator('h2').filter({ hasText: /email.*settings|е-пошта/i });
    const emailCount = await emailSection.count();
    console.log('Email settings h2:', emailCount);
    if (emailCount > 0) {
      await emailSection.first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
    } else {
      // Scroll to the Mail icon section
      await scrollToBottom(page);
      // Try multiple scrolls
      for (let i = 0; i < 5; i++) {
        await scrollToBottom(page);
        await page.waitForTimeout(200);
      }
    }
    await page.screenshot({ path: path.join(OUT, 'f4-settings-email-section.png') });
    console.log('Settings email section screenshot');
    await page.close();
  }

  // ── Screenshot: Expanded supplier row ─────────────────────────────────────
  {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1400, height: 900 });
    await login(page);

    // Navigate to Staff
    await page.getByRole('button', { name: /Staff|Персонал/i }).first().click();
    await page.waitForTimeout(2000);

    // Click first shift row
    const shiftRows = page.locator('tbody tr');
    const rowCount = await shiftRows.count();
    console.log('Shift rows:', rowCount);
    if (rowCount > 0) {
      await shiftRows.first().click();
      await page.waitForTimeout(2500);

      // Scroll to supplier section
      const supplierH3 = page.locator('h3').filter({ hasText: /добавувач|Supplier/i });
      const h3Count = await supplierH3.count();
      console.log('Supplier h3:', h3Count);
      if (h3Count > 0) {
        await supplierH3.first().scrollIntoViewIfNeeded();
        await page.waitForTimeout(800);

        // Click expand on first supplier (any button with chevron/expand)
        // The expand buttons contain product count like "2 products"
        const allBtns = await page.locator('button').all();
        for (const btn of allBtns) {
          try {
            const txt = await btn.innerText({ timeout: 500 });
            if (/\d+\s*(product|производ)/i.test(txt)) {
              await btn.click();
              await page.waitForTimeout(600);
              console.log('Expanded supplier:', txt);
              break;
            }
          } catch {}
        }
        await page.screenshot({ path: path.join(OUT, 'f4-supplier-expanded.png') });
        console.log('Expanded supplier screenshot');
      }
    }
    await page.close();
  }

  await browser.close();
  console.log('Done');
}

main().catch(err => { console.error(err); process.exit(1); });
