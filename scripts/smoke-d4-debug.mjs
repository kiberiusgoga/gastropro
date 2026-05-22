import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'tmp-screenshots', 'd4');
mkdirSync(OUT, { recursive: true });

const BASE = 'http://localhost:4000';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // Capture console errors
  page.on('console', msg => { if (msg.type() === 'error') console.log('CONSOLE ERROR:', msg.text()); });
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  // Capture network
  page.on('response', resp => {
    if (resp.url().includes('/api/')) console.log('API:', resp.status(), resp.url());
  });

  page.setDefaultTimeout(15000);

  await page.goto(`${BASE}/`);
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"]', 'admin@gastropro.mk');
  await page.fill('input[type="password"]', 'admin123');
  await Promise.all([page.waitForLoadState('networkidle'), page.click('button[type="submit"]')]);
  await page.waitForTimeout(800);

  await page.click('text=Transfers');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: join(OUT, 'debug-transfers-loaded.png') });
  console.log('📸 debug screenshot taken');

  const html = await page.evaluate(() => document.querySelector('main')?.innerHTML?.substring(0, 2000) ?? 'no main');
  console.log('PAGE HTML snippet:', html);

  const selectCount = await page.locator('select').count();
  console.log('Select count:', selectCount);

  await browser.close();
})().catch(err => { console.error('CRASH:', err.message); process.exit(1); });
