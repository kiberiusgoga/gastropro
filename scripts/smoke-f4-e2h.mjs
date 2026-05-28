/**
 * Re-capture E2 (success toast) and H (mobile email section)
 */
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '../screenshots/feature-4');
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
    try { return { status: r.status, body: JSON.parse(text) }; } catch { return { status: r.status, body: text }; }
  }, [`${BASE}/api${urlPath}`, method, body, tok]);
}

async function scrollToElement(page, text) {
  await page.evaluate((t) => {
    const all = document.querySelectorAll('*');
    for (const el of all) {
      if (el.children.length === 0 && el.textContent?.includes(t)) {
        el.scrollIntoView({ behavior: 'instant', block: 'center' });
        return;
      }
    }
    // fallback: scroll main container
    const main = document.querySelector('main .overflow-y-auto, main [class*="overflow-y-auto"]') || document.querySelector('main');
    if (main) main.scrollTop = main.scrollHeight;
  }, text);
  await page.waitForTimeout(600);
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  // ── E2: Settings page with Send Test button + success toast ────────────────
  {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1400, height: 900 });
    await login(page);
    console.log('E2: capturing success toast...');

    await page.getByRole('button', { name: /Подесувања|Settings/i }).first().click();
    await page.waitForTimeout(2000);

    // Scroll to email section
    await page.evaluate(() => {
      const main = document.querySelector('main .overflow-y-auto, [class*="overflow-y-auto"]') || document.querySelector('main');
      if (main) main.scrollTop = main.scrollHeight;
      window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(500);

    // Fill test email input
    const testInput = page.locator('input[placeholder*="test@"], input[placeholder*="Test"], input[placeholder*="е-пошта"]').last();
    const tiCount = await testInput.count();
    if (tiCount > 0) {
      await testInput.fill('kuculovgoga@gmail.com');
    }

    // Click Send Test button — shoot immediately after to catch the toast
    const sendTestBtn = page.locator('button').filter({ hasText: /Испрати тест|Send.*test|test.*send|испраќање/i });
    const stCount = await sendTestBtn.count();
    console.log('Send test buttons:', stCount);

    if (stCount > 0) {
      await sendTestBtn.first().click();
      // Capture quickly — toast shows briefly
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(OUT, 'f4-e2-test-email-success.png') });
      console.log('E2 captured');
    } else {
      // Try any button near the test email input
      const allBtns = await page.locator('button').all();
      for (const btn of allBtns) {
        const txt = await btn.innerText({ timeout: 300 }).catch(() => '');
        if (/ИСПРАЌАЊЕ|Send|Испрати/i.test(txt) && txt.length < 30) {
          console.log('Found button:', txt.trim());
        }
      }
      await page.screenshot({ path: path.join(OUT, 'f4-e2-test-email-success.png') });
      console.log('E2 fallback (no send test button found)');
    }
    await page.close();
  }

  // ── H: Mobile — Settings page scrolled to Email Settings section ───────────
  {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    console.log('\nH: mobile email settings...');

    // JS click Settings button (may be hidden behind hamburger on mobile)
    const clicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, a'));
      const target = btns.find(b => /Подесувања|Settings/i.test(b.textContent || ''));
      if (target) { target.dispatchEvent(new MouseEvent('click', { bubbles: true })); return true; }
      return false;
    });
    console.log('Clicked Settings:', clicked);
    await page.waitForTimeout(2000);

    // Scroll to EMAIL SETTINGS heading using evaluate with scrollable container
    const scrolled = await page.evaluate(() => {
      // Find any container with SMTP text and scroll it into view
      const all = document.querySelectorAll('h2, h3, div, section');
      for (const el of all) {
        if (el.textContent?.trim() === 'EMAIL SETTINGS' || /email.*settings/i.test(el.textContent || '')) {
          el.scrollIntoView({ behavior: 'instant', block: 'start' });
          return el.textContent?.trim().slice(0, 30);
        }
      }
      // Fallback: scroll any overflow container to bottom
      const scrollables = document.querySelectorAll('[class*="overflow"]');
      for (const s of scrollables) {
        if (s.scrollHeight > s.clientHeight) {
          s.scrollTop = s.scrollHeight;
        }
      }
      window.scrollTo(0, document.body.scrollHeight * 3);
      return 'scrolled-to-bottom';
    });
    console.log('Scroll result:', scrolled);
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT, 'f4-h-mobile-view.png') });
    console.log('H captured');
    await page.close();
  }

  await browser.close();
  console.log('\nDone. Files:');
  console.log(fs.readdirSync(OUT).sort().join('\n'));
}

main().catch(err => { console.error(err); process.exit(1); });
