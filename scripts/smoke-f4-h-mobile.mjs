/**
 * F4 screenshot H — Mobile view showing Email Settings section
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

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  // iPhone 14 Pro
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);

  // Navigate to Settings via JS
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button, a'));
    const target = btns.find(b => /Подесувања|Settings/i.test(b.textContent || ''));
    if (target) target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(2500);

  // Scroll to EMAIL SETTINGS section by finding it and using scrollIntoView
  const emailHeader = page.locator('h2, h3').filter({ hasText: /EMAIL SETTINGS/i });
  const ehCount = await emailHeader.count();
  console.log('EMAIL SETTINGS headers:', ehCount);

  if (ehCount > 0) {
    await emailHeader.first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    console.log('Scrolled to EMAIL SETTINGS heading');
  } else {
    // Try to find any element containing "SMTP SERVER" text
    const smtpLabel = page.locator('text=SMTP SERVER, text=SMTP Server, label:has-text("SMTP")').first();
    const slCount = await smtpLabel.count();
    console.log('SMTP label count:', slCount);
    if (slCount > 0) {
      await smtpLabel.scrollIntoViewIfNeeded();
      await page.waitForTimeout(800);
    } else {
      // Brute force: scroll all possible containers to max
      await page.evaluate(() => {
        const allScrollable = Array.from(document.querySelectorAll('*')).filter(el => {
          const style = window.getComputedStyle(el);
          return (style.overflow === 'auto' || style.overflow === 'scroll' ||
                  style.overflowY === 'auto' || style.overflowY === 'scroll') &&
                  el.scrollHeight > el.clientHeight;
        });
        allScrollable.forEach(el => { el.scrollTop = el.scrollHeight; });
        window.scrollTo(0, document.body.scrollHeight * 10);
      });
      await page.waitForTimeout(1000);
    }
  }

  await page.screenshot({ path: path.join(OUT, 'f4-h-mobile-view.png') });
  const files = fs.readdirSync(OUT).sort();
  const newFile = files.find(f => f === 'f4-h-mobile-view.png');
  console.log('Captured:', newFile);

  // Also capture a second mobile screenshot: the SMTP fields layout
  await page.screenshot({ path: path.join(OUT, 'f4-h2-mobile-smtp-fields.png') });

  await browser.close();
  console.log('Done');
}

main().catch(err => { console.error(err); process.exit(1); });
