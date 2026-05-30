/**
 * Feature 3 HR screenshots for approval
 */
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:4000';
const BASE_API = `${BASE}/api`;
const DIR = path.join(__dirname, '..', 'screenshots', 'hr');
if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });

function ok(msg)   { console.log(`  ✓ ${msg}`); }
function info(msg) { console.log(`  ℹ️  ${msg}`); }
function issue(msg){ console.log(`  ⚠️  ${msg}`); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function api(tok, method, p, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (tok) headers['Authorization'] = `Bearer ${tok}`;
  const r = await fetch(`${BASE_API}${p}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  try { return { status: r.status, body: JSON.parse(text) }; } catch { return { status: r.status, body: text }; }
}

async function loginAndSetLang(page, lang) {
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
}

async function navToHR(page) {
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('nav button'))
      .find(b => /hours|часови|orët/i.test(b.textContent || ''));
    if (btn) btn.click();
  });
  await sleep(2500);
}

(async () => {
  // ── API setup: clock in the admin user ────────────────────────────────────
  const loginR = await api(null, 'POST', '/auth/login', { email: 'admin@gastropro.mk', password: 'admin123' });
  const tok = loginR.body?.token || loginR.body?.accessToken;
  if (!tok) { issue('Login failed'); process.exit(1); }

  // Clock out first (in case already clocked in from previous test)
  await api(tok, 'POST', '/work-entries/clock-out', { break_minutes: 0 }).catch(() => {});

  ok('API ready');

  const browser = await chromium.launch({ headless: true });

  // ── 1. HR page — not clocked in (MK) ─────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await loginAndSetLang(page, 'mk');
    await navToHR(page);
    await page.screenshot({ path: path.join(DIR, '1-hr-not-clocked-in.png') });
    info('→ 1-hr-not-clocked-in.png');
    ok('HR page (not clocked in)');
    await ctx.close();
  }

  // ── 2. Clock in via API, then screenshot (clocked in state) ───────────────
  await api(tok, 'POST', '/work-entries/clock-in');
  await sleep(500);

  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await loginAndSetLang(page, 'mk');
    await navToHR(page);
    await page.screenshot({ path: path.join(DIR, '2-hr-clocked-in-widget.png') });
    info('→ 2-hr-clocked-in-widget.png');
    ok('ClockWidget — clocked in');

    // ── 3. Open clock-out modal ─────────────────────────────────────────────
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button'))
        .find(b => /заврши работа|clock out/i.test(b.textContent || ''));
      if (btn) btn.click();
    });
    await sleep(1000);
    await page.screenshot({ path: path.join(DIR, '3-clock-out-modal.png') });
    info('→ 3-clock-out-modal.png');
    ok('ClockOut modal');

    await page.keyboard.press('Escape');
    await ctx.close();
  }

  // ── Clock out ─────────────────────────────────────────────────────────────
  await api(tok, 'POST', '/work-entries/clock-out', { break_minutes: 30, notes: 'Test shift' });
  ok('Clocked out');

  // ── Create manual entries for multiple users to populate weekly table ─────
  const usersR = await api(tok, 'GET', '/users');
  const users = usersR.body || [];
  const targetUsers = users.filter(u => u.active !== false).slice(0, 3);

  // Add entries for the past week
  const today = new Date();
  for (const u of targetUsers) {
    for (let dayOff = 1; dayOff <= 5; dayOff++) {
      const day = new Date(today);
      day.setDate(day.getDate() - dayOff);
      const clockIn = new Date(day); clockIn.setHours(8, 0, 0, 0);
      const clockOut = new Date(day); clockOut.setHours(16, 30, 0, 0);
      await api(tok, 'POST', '/work-entries', {
        user_id: u.id,
        clock_in: clockIn.toISOString(),
        clock_out: clockOut.toISOString(),
        break_minutes: 30,
        notes: `Demo entry day -${dayOff}`,
      }).catch(() => {});
    }
  }
  ok(`Created demo entries for ${targetUsers.length} users`);

  // ── 4. HR page with data (MK, full height) ────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 5000 } });
    const page = await ctx.newPage();
    await loginAndSetLang(page, 'mk');
    await navToHR(page);
    await page.screenshot({ path: path.join(DIR, '4-hr-page-full-mk.png') });
    info('→ 4-hr-page-full-mk.png');
    ok('HR page full (MK, 5000px)');
    await ctx.close();
  }

  // ── 5. HR page EN ─────────────────────────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 5000 } });
    const page = await ctx.newPage();
    await loginAndSetLang(page, 'en');
    await navToHR(page);
    await page.screenshot({ path: path.join(DIR, '5-hr-page-full-en.png') });
    info('→ 5-hr-page-full-en.png');
    ok('HR page full (EN)');
    await ctx.close();
  }

  // ── 6. Normal viewport — KPI cards visible ────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await loginAndSetLang(page, 'en');
    await navToHR(page);
    await page.screenshot({ path: path.join(DIR, '6-hr-kpi-cards.png') });
    info('→ 6-hr-kpi-cards.png');
    ok('KPI cards');
    await ctx.close();
  }

  // ── 7. Weekly table with overtime badges ─────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await loginAndSetLang(page, 'en');
    await navToHR(page);
    // Scroll to weekly table
    await page.evaluate(() => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (node.nodeValue?.trim() === 'Weekly view' || node.nodeValue?.trim() === 'WEEKLY VIEW') {
          node.parentElement?.scrollIntoView({ block: 'start' });
          return;
        }
      }
      window.scrollBy(0, 600);
    });
    await sleep(400);
    await page.screenshot({ path: path.join(DIR, '7-weekly-table.png') });
    info('→ 7-weekly-table.png');
    ok('Weekly table');
    await ctx.close();
  }

  // ── 8. Manual entry modal ─────────────────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await loginAndSetLang(page, 'en');
    await navToHR(page);
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button'))
        .find(b => /add manual|manual entry/i.test(b.textContent || ''));
      if (btn) btn.click();
    });
    await sleep(800);
    await page.screenshot({ path: path.join(DIR, '8-manual-entry-modal.png') });
    info('→ 8-manual-entry-modal.png');
    ok('Manual entry modal');
    await page.keyboard.press('Escape');
    await ctx.close();
  }

  // ── 9. HR settings modal ──────────────────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await loginAndSetLang(page, 'en');
    await navToHR(page);
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button'))
        .find(b => /hr settings/i.test(b.textContent || ''));
      if (btn) btn.click();
    });
    await sleep(800);
    await page.screenshot({ path: path.join(DIR, '9-hr-settings-modal.png') });
    info('→ 9-hr-settings-modal.png');
    ok('HR settings modal');
    await page.keyboard.press('Escape');
    await ctx.close();
  }

  // ── 10. Mobile viewport ───────────────────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await loginAndSetLang(page, 'mk');
    // open mobile menu
    await page.evaluate(() => {
      const menuBtn = document.querySelector('[class*="lg:hidden"]');
      if (menuBtn instanceof HTMLElement) menuBtn.click();
    });
    await sleep(500);
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button'))
        .find(b => /hours|часови|orët/i.test(b.textContent || ''));
      if (btn) btn.click();
    });
    await sleep(2000);
    await page.screenshot({ path: path.join(DIR, '10-hr-mobile.png') });
    info('→ 10-hr-mobile.png');
    ok('Mobile HR page');
    await ctx.close();
  }

  await browser.close();
  console.log('\n  HR screenshots in screenshots/hr/');
})();
