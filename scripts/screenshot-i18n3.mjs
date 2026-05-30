/**
 * Full Settings page screenshots using tall viewport
 */
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:4000';
const DIR = path.join(__dirname, '..', 'screenshots', 'i18n-fix');
if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });

function info(msg) { console.log(`  ℹ️  ${msg}`); }
function ok(msg)   { console.log(`  ✓ ${msg}`); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function login(page) {
  await page.goto(BASE + '/');
  await sleep(1500);
  const tok = await page.evaluate(() => localStorage.getItem('gastropro_token'));
  if (!tok) {
    await page.waitForSelector('input[type="password"]', { timeout: 8000 });
    await page.locator('input[type="email"], input[placeholder*="mail" i]').first().fill('admin@gastropro.mk');
    await page.locator('input[type="password"]').first().fill('admin123');
    await page.locator('button[type="submit"], button').filter({ hasText: /login|влез/i }).first().click();
    await sleep(3000);
  }
}

async function setLang(page, lang) {
  await page.evaluate(l => localStorage.setItem('i18nextLng', l), lang);
  await page.reload();
  await sleep(2500);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  // Use very tall viewport to capture full settings page
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 6000 } });
  const page = await ctx.newPage();

  await login(page);
  ok('Logged in');

  // Settings EN
  await setLang(page, 'en');
  const settingsBtn = page.locator('nav button').filter({ hasText: /^Settings$/i }).first();
  await settingsBtn.click({ timeout: 5000 });
  await sleep(3000);
  const p1 = path.join(DIR, '8-settings-en-tall.png');
  await page.screenshot({ path: p1 });
  info(`→ ${p1}`);
  ok('Settings EN (tall viewport)');

  // Settings SQ
  await setLang(page, 'sq');
  const settingsBtnSq = page.locator('nav button').filter({ hasText: /settings|cilësime/i }).first();
  if (await settingsBtnSq.count() > 0) {
    await settingsBtnSq.click({ timeout: 5000 });
    await sleep(2500);
  }
  const p2 = path.join(DIR, '9-settings-sq-tall.png');
  await page.screenshot({ path: p2 });
  info(`→ ${p2}`);
  ok('Settings SQ (tall viewport)');

  await setLang(page, 'mk');
  await browser.close();
  console.log('\n  Done.');
})();
