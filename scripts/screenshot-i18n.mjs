/**
 * Screenshot i18n changes for approval: Settings EN, Settings SQ, Dashboard EN, Invoices EN, ShiftHistory EN
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
  await sleep(2000);
}

async function navTo(page, label) {
  const btn = page.locator('nav button').filter({ hasText: label }).first();
  const count = await btn.count();
  if (count > 0) {
    await btn.click({ timeout: 5000 });
    await sleep(2000);
  } else {
    info(`Nav button "${label}" not found`);
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  await login(page);
  ok('Logged in');

  // ── 1. Dashboard EN ────────────────────────────────────────────────────────
  await setLang(page, 'en');
  await navTo(page, 'Dashboard');
  const p1 = path.join(DIR, '1-dashboard-en.png');
  await page.screenshot({ path: p1 });
  info(`→ ${p1}`);
  ok('Dashboard EN');

  // ── 2. B2B Invoices EN ────────────────────────────────────────────────────
  // Try clicking on Invoices nav button
  const invBtn = page.locator('nav button').filter({ hasText: /invoices|фактури/i }).first();
  if (await invBtn.count() > 0) {
    await invBtn.click({ timeout: 5000 });
    await sleep(2000);
  }
  const p2 = path.join(DIR, '2-invoices-en.png');
  await page.screenshot({ path: p2 });
  info(`→ ${p2}`);
  ok('Invoices EN');

  // ── 3. Staff / Shift History EN ───────────────────────────────────────────
  const staffBtn = page.locator('nav button').filter({ hasText: /staff|персонал/i }).first();
  if (await staffBtn.count() > 0) {
    await staffBtn.click({ timeout: 5000 });
    await sleep(2000);
  }
  // Click Shift History tab if present
  const shiftHistTab = page.locator('button').filter({ hasText: /shift history|историја/i }).first();
  if (await shiftHistTab.count() > 0) {
    await shiftHistTab.click({ timeout: 3000 });
    await sleep(1500);
  }
  const p3 = path.join(DIR, '3-shifthistory-en.png');
  await page.screenshot({ path: p3 });
  info(`→ ${p3}`);
  ok('Shift History EN');

  // ── 4. Settings EN ─────────────────────────────────────────────────────────
  const settingsBtn = page.locator('nav button').filter({ hasText: /settings|подесувања/i }).first();
  if (await settingsBtn.count() > 0) {
    await settingsBtn.click({ timeout: 5000 });
    await sleep(2000);
  }
  const p4 = path.join(DIR, '4-settings-en-top.png');
  await page.screenshot({ path: p4 });
  info(`→ ${p4}`);
  // Scroll to printers section
  await page.evaluate(() => window.scrollTo(0, 600));
  await sleep(500);
  const p4b = path.join(DIR, '4-settings-en-printers.png');
  await page.screenshot({ path: p4b });
  info(`→ ${p4b}`);
  // Scroll to password section
  await page.evaluate(() => window.scrollTo(0, 9999));
  await sleep(500);
  const p4c = path.join(DIR, '4-settings-en-bottom.png');
  await page.screenshot({ path: p4c });
  info(`→ ${p4c}`);
  ok('Settings EN');

  // ── 5. Settings SQ ─────────────────────────────────────────────────────────
  await setLang(page, 'sq');
  const settingsBtnSq = page.locator('nav button').filter({ hasText: /settings|cilësime|подесувања/i }).first();
  if (await settingsBtnSq.count() > 0) {
    await settingsBtnSq.click({ timeout: 5000 });
    await sleep(2000);
  }
  const p5 = path.join(DIR, '5-settings-sq-top.png');
  await page.screenshot({ path: p5 });
  info(`→ ${p5}`);
  await page.evaluate(() => window.scrollTo(0, 600));
  await sleep(500);
  const p5b = path.join(DIR, '5-settings-sq-printers.png');
  await page.screenshot({ path: p5b });
  info(`→ ${p5b}`);
  await page.evaluate(() => window.scrollTo(0, 9999));
  await sleep(500);
  const p5c = path.join(DIR, '5-settings-sq-bottom.png');
  await page.screenshot({ path: p5c });
  info(`→ ${p5c}`);
  ok('Settings SQ');

  // Reset to MK
  await setLang(page, 'mk');

  await browser.close();
  console.log('\n  Screenshots saved in screenshots/i18n-fix/');
})();
