/**
 * Phase E: Z-report per-warehouse screenshots (tall viewport + eval navigation)
 */
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:4000';
const DIR = path.join(__dirname, '..', 'screenshots', 'phase-e');
if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });

function ok(msg)   { console.log(`  ✓ ${msg}`); }
function info(msg) { console.log(`  ℹ️  ${msg}`); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function setup(page, lang) {
  await page.goto(BASE + '/');
  await sleep(1500);
  await page.evaluate(l => localStorage.setItem('i18nextLng', l), lang);
  const tok = await page.evaluate(() => localStorage.getItem('gastropro_token'));
  if (!tok) {
    await page.waitForSelector('input[type="password"]', { timeout: 8000 });
    await page.locator('input[type="email"], input[placeholder*="mail" i]').first().fill('admin@gastropro.mk');
    await page.locator('input[type="password"]').first().fill('admin123');
    await page.locator('button[type="submit"], button').filter({ hasText: /login|влез/i }).first().click();
    await sleep(3000);
    await page.evaluate(l => localStorage.setItem('i18nextLng', l), lang);
    await page.reload();
    await sleep(1500);
  } else {
    await page.reload();
    await sleep(1500);
  }
  // Nav to Staff via evaluate (avoids viewport-edge click issues)
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('nav button'))
      .find(b => /staff|персонал/i.test(b.textContent || ''));
    if (btn) btn.click();
  });
  await sleep(2000);
  // Click first shift row via evaluate
  await page.evaluate(() => {
    const rows = document.querySelectorAll('table tbody tr');
    if (rows[0]) rows[0].click();
  });
  await sleep(3500);
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  // ── MK viewport (good for per-location section) ─────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
    const page = await ctx.newPage();
    await setup(page, 'mk');

    // Per-location section scrolled to center
    await page.evaluate(() => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (node.nodeValue?.trim() === 'Поделба по локации') {
          node.parentElement?.scrollIntoView({ block: 'center', behavior: 'instant' });
          return;
        }
      }
    });
    await sleep(400);
    await page.screenshot({ path: path.join(DIR, '5-per-location-mk.png') });
    info('→ 5-per-location-mk.png');
    ok('Per-location MK');
    await ctx.close();
  }

  // ── EN viewport ──────────────────────────────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
    const page = await ctx.newPage();
    await setup(page, 'en');

    await page.evaluate(() => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (node.nodeValue?.trim() === 'Per-Location Breakdown') {
          node.parentElement?.scrollIntoView({ block: 'center', behavior: 'instant' });
          return;
        }
      }
    });
    await sleep(400);
    await page.screenshot({ path: path.join(DIR, '6-per-location-en.png') });
    info('→ 6-per-location-en.png');
    ok('Per-location EN');
    await ctx.close();
  }

  // ── Full Z-report: use tall viewport with eval nav ────────────────────────
  for (const lang of ['mk', 'en']) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 5000 } });
    const page = await ctx.newPage();
    await setup(page, lang);
    await page.screenshot({ path: path.join(DIR, `7-zreport-${lang}-tall.png`) });
    info(`→ 7-zreport-${lang}-tall.png`);
    ok(`Z-report full ${lang.toUpperCase()} (5000px)`);

    if (lang === 'mk') {
      const text = await page.evaluate(() => document.body.innerText);
      const checks = [
        ['Поделба по локации', text.includes('Поделба по локации')],
        ['Главен магацин', text.includes('Главен магацин')],
        ['Takeaway', text.includes('Takeaway')],
        ['Информативно note', text.includes('Информативно')],
        ['Финансиско резиме', text.includes('Финансиско резиме')],
        ['ДДВ разбивање', text.includes('ДДВ разбивање')],
      ];
      for (const [k, v] of checks) {
        if (v) ok(`  ${k} ✓`); else info(`  ${k} — not found`);
      }
    }
    await ctx.close();
  }

  await browser.close();
  console.log('\n  Phase E screenshots in screenshots/phase-e/');
})();
