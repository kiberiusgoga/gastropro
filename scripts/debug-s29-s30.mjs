/**
 * S29 — Mobile responsive (400×812 viewport, 6 pages, overflow check + screenshots)
 * S30 — Language switching (MK→EN→SQ, sidebar labels, buttons, status badges)
 */
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:4000';
const DIR = path.join(__dirname, '..', 'screenshots', 's29-s30');
if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });

function ok(msg)    { console.log(`  ✓ ${msg}`); }
function info(msg)  { console.log(`  ℹ️  ${msg}`); }
function issue(msg, sev) { console.log(`  ⚠️  [${sev}] ${msg}`); }
function sleep(ms)  { return new Promise(r => setTimeout(r, ms)); }

async function ss(page, name) {
  const p = path.join(DIR, `${name}.png`);
  await page.screenshot({ path: p });
  info(`Screenshot → ${p}`);
  return p;
}

async function loginUI(page, lang = 'mk') {
  // Set language before app loads so i18next picks it up
  await page.goto(BASE + '/');
  await page.evaluate((l) => localStorage.setItem('i18nextLng', l), lang);
  await sleep(200);
  const tok = await page.evaluate(() => localStorage.getItem('gastropro_token'));
  if (!tok) {
    try {
      await page.waitForSelector('input[type="password"]', { timeout: 8000 });
      const emailInput = page.locator('input[type="email"], input[placeholder*="mail" i], input[name="email"]').first();
      await emailInput.fill('admin@gastropro.mk');
      await page.locator('input[type="password"]').first().fill('admin123');
      await page.locator('button[type="submit"], button').filter({ hasText: /login|влез/i }).first().click();
      await sleep(3000);
    } catch { /* ignore */ }
  } else {
    // Reload so i18next picks up the new lang from localStorage
    await page.reload();
    await sleep(2000);
  }
  const tok2 = await page.evaluate(() => localStorage.getItem('gastropro_token'));
  if (!tok2) throw new Error('Login failed — no token after form submit');
  ok('Logged in via UI');
}

// ═══════════════════════════════════════════════════════════════════════════════
// S29 — MOBILE RESPONSIVE
// Navigate at desktop (sidebar always visible), then resize to 400px for overflow check
// ═══════════════════════════════════════════════════════════════════════════════
async function s29(browser) {
  console.log('\n═══ S29: Mobile Responsive (400×812) ═════════════════════════════');

  // Start at desktop so sidebar is always visible for navigation
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await loginUI(page);
  await sleep(500);

  // English nav labels — fresh context defaults to navigator.language (en-US)
  const pages = [
    { tab: 'dashboard',    label: 'Dashboard',      navText: 'Dashboard' },
    { tab: 'stock',        label: 'Stock',           navText: 'Stock' },
    { tab: 'b2b-invoices', label: 'Invoices',        navText: 'Invoices' },
    { tab: 'crm',          label: 'CRM/Companies',   navText: 'CRM' },
    { tab: 'staff',        label: 'Staff/Z-report',  navText: 'Staff' },
    { tab: 'settings',     label: 'Email Settings',  navText: 'Settings' },
  ];

  const results = [];

  for (const pg of pages) {
    console.log(`\n  ─── ${pg.label} ───`);

    // Navigate at desktop (sidebar always visible)
    // Use evaluate to click by text — Playwright's text filter has issues with Cyrillic
    await page.waitForSelector('nav button', { timeout: 6000 }).catch(() => {});
    const clicked = await page.evaluate((navText) => {
      const buttons = Array.from(document.querySelectorAll('nav button'));
      for (const btn of buttons) {
        const txt = (btn.innerText || btn.textContent || '').trim();
        if (txt.includes(navText)) { btn.click(); return true; }
      }
      return false;
    }, pg.navText);
    if (clicked) {
      await sleep(1500);
      ok(`Navigated to ${pg.label}`);
    } else {
      issue(`Nav button not found for "${pg.navText}"`, 'P2');
    }

    // Resize to mobile
    await page.setViewportSize({ width: 400, height: 812 });
    await sleep(800);

    // Check horizontal overflow (skip fixed/sticky elements like sidebar)
    const overflow = await page.evaluate(() => {
      const scrollW = Math.max(
        document.body.scrollWidth,
        document.documentElement.scrollWidth,
      );
      const vw = window.innerWidth;
      const offenders = [];
      document.querySelectorAll('*').forEach(el => {
        const style = window.getComputedStyle(el);
        if (style.position === 'fixed' || style.position === 'sticky') return;
        if (style.overflow === 'hidden' || style.overflowX === 'hidden') return;
        const r = el.getBoundingClientRect();
        if (r.right > vw + 4 && r.width > 0) {
          // className can be SVGAnimatedString on SVG elements
          const cls = typeof el.className === 'string' ? el.className : (el.className?.baseVal || '');
          offenders.push({ tag: el.tagName, cls: cls.slice(0, 70), right: Math.round(r.right) });
        }
      });
      return { scrollW, vw, overflows: offenders.slice(0, 8) };
    });

    const hasOverflow = overflow.scrollW > overflow.vw + 4;
    if (hasOverflow) {
      issue(`${pg.label}: HORIZONTAL OVERFLOW — scrollWidth=${overflow.scrollW} > vw=${overflow.vw}`, 'P2');
      overflow.overflows.forEach(el => info(`  Offender: <${el.tag}> .${el.cls.split(' ')[0]} right=${el.right}px`));
    } else {
      ok(`${pg.label}: no horizontal overflow (scrollWidth=${overflow.scrollW})`);
    }

    await ss(page, `s29-${pg.tab}`);
    results.push({ label: pg.label, overflow: hasOverflow, overflowPx: overflow.scrollW - overflow.vw });

    // Resize back to desktop for next navigation
    await page.setViewportSize({ width: 1280, height: 900 });
    await sleep(300);
  }

  console.log('\n  S29 summary:');
  results.forEach(r => {
    if (r.overflow) issue(`${r.label}: overflow +${r.overflowPx}px`, 'P2');
    else ok(`${r.label}: OK`);
  });

  await ctx.close();
  console.log('  S29 complete');
}

// ═══════════════════════════════════════════════════════════════════════════════
// S30 — LANGUAGE SWITCHING
// ═══════════════════════════════════════════════════════════════════════════════
async function s30(browser) {
  console.log('\n═══ S30: Language Switching MK→EN→SQ ═════════════════════════════');

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await loginUI(page);
  await sleep(500);

  const langs = [
    {
      code: 'mk',
      navMain: 'ГЛАВНО',
      dashboard: 'Контролна табла',
      stock: 'Залиха',
      invoices: 'Фактури',
      settings: 'Подесувања',
      save: 'Зачувај',
      cancel: 'Откажи',
      edit: 'Измени',
      delete: 'Избриши',
      statusPending: 'Во тек',
      statusPaid: 'Платена',
      statusOverdue: 'Задоцнета',
    },
    {
      code: 'en',
      navMain: 'MAIN',
      dashboard: 'Dashboard',
      stock: 'Stock',
      invoices: 'Invoices',
      settings: 'Settings',
      save: 'Save',
      cancel: 'Cancel',
      edit: 'Edit',
      delete: 'Delete',
      statusPending: 'Pending',
      statusPaid: 'Paid',
      statusOverdue: 'Overdue',
    },
    {
      code: 'sq',
      navMain: 'KRYESORE',
      dashboard: 'Paneli',
      stock: 'Stoku',
      invoices: 'Fatura',
      settings: 'Cilësime',
      save: 'Ruaj',
      cancel: 'Anulo',
      edit: 'Ndrysho',
      delete: 'Fshi',
      statusPending: 'Në pritje',
      statusPaid: 'E paguar',
      statusOverdue: 'Me vonesë',
    },
  ];

  for (const lang of langs) {
    console.log(`\n  ─── ${lang.code.toUpperCase()} ───`);

    // Click language button in sidebar
    const langBtn = page.locator(`button`).filter({ hasText: new RegExp(`^${lang.code.toUpperCase()}$`) });
    try {
      await langBtn.first().click({ timeout: 5000 });
      await sleep(1200);
      ok(`Clicked ${lang.code.toUpperCase()} language button`);
    } catch (e) {
      issue(`Could not click ${lang.code.toUpperCase()} button: ${e.message.slice(0, 80)}`, 'P1');
      continue;
    }

    // Verify current language via localStorage
    const stored = await page.evaluate(() => localStorage.getItem('i18nextLng') || '');
    info(`localStorage i18nextLng = "${stored}"`);
    if (!stored.startsWith(lang.code)) {
      issue(`Language stored as "${stored}", expected "${lang.code}*"`, 'P1');
    }

    // Read sidebar text
    const navText = await page.evaluate(() => document.querySelector('nav')?.innerText || '');

    const sidebarChecks = [
      { key: 'nav_main',   expected: lang.navMain },
      { key: 'dashboard',  expected: lang.dashboard },
      { key: 'stock',      expected: lang.stock },
      { key: 'invoices',   expected: lang.invoices },
      { key: 'settings',   expected: lang.settings },
    ];

    for (const c of sidebarChecks) {
      if (navText.includes(c.expected)) {
        ok(`[${lang.code}] nav "${c.key}" = "${c.expected}" ✓`);
      } else {
        issue(`[${lang.code}] nav "${c.key}" not found — expected "${c.expected}"`, 'P1');
        // Show first 200 chars of nav for debugging
        if (c.key === 'dashboard') info(`  Nav text sample: ${navText.slice(0, 200).replace(/\n/g, ' | ')}`);
      }
    }

    await ss(page, `s30-${lang.code}-sidebar`);

    // Navigate to Invoices page to check status badges
    try {
      await page.locator('nav button').filter({ hasText: lang.invoices }).first().click({ timeout: 4000 });
      await sleep(1500);
    } catch {
      await page.locator('nav button').filter({ hasText: /фактури|invoices|fatura/i }).first().click({ timeout: 3000 }).catch(() => {});
      await sleep(1500);
    }

    const pageText = await page.evaluate(() => document.body.innerText);

    // Status badges (only visible if invoices exist with those statuses)
    for (const [key, val] of [['status_pending', lang.statusPending], ['status_paid', lang.statusPaid], ['status_overdue', lang.statusOverdue]]) {
      if (pageText.includes(val)) {
        ok(`[${lang.code}] status badge "${key}" = "${val}" ✓`);
      } else {
        info(`[${lang.code}] status "${key}" ("${val}") not visible — no invoices in this status or translation gap`);
      }
    }

    await ss(page, `s30-${lang.code}-invoices`);

    // Open create-invoice modal to test Save/Cancel buttons
    const addBtn = page.locator('button').filter({ hasText: /нова фактура|new invoice|faturë.*re|add invoice|shto/i });
    const addCount = await addBtn.count();
    if (addCount > 0) {
      await addBtn.first().click({ timeout: 3000 }).catch(() => {});
      await sleep(800);
      const modalText = await page.evaluate(() => document.body.innerText);
      const saveOk   = modalText.includes(lang.save);
      const cancelOk = modalText.includes(lang.cancel);
      if (saveOk)   ok(`[${lang.code}] modal Save = "${lang.save}" ✓`);
      else          issue(`[${lang.code}] modal Save "${lang.save}" not found`, 'P1');
      if (cancelOk) ok(`[${lang.code}] modal Cancel = "${lang.cancel}" ✓`);
      else          issue(`[${lang.code}] modal Cancel "${lang.cancel}" not found`, 'P1');
      await ss(page, `s30-${lang.code}-modal`);
      await page.keyboard.press('Escape');
      await sleep(400);
    } else {
      info(`[${lang.code}] No "new invoice" button found — skipping modal button check`);
      // Try to check Edit/Delete on any existing row
      const editBtn = page.locator('button').filter({ hasText: new RegExp(`^${lang.edit}$`, 'i') });
      const delBtn  = page.locator('button').filter({ hasText: new RegExp(`^${lang.delete}$`, 'i') });
      const editCount = await editBtn.count();
      const delCount  = await delBtn.count();
      if (editCount > 0) ok(`[${lang.code}] Edit button = "${lang.edit}" ✓ (${editCount} found)`);
      else info(`[${lang.code}] Edit button "${lang.edit}" not found in page`);
      if (delCount > 0)  ok(`[${lang.code}] Delete button = "${lang.delete}" ✓ (${delCount} found)`);
      else info(`[${lang.code}] Delete button "${lang.delete}" not found in page`);
    }

    // Navigate to Settings to check email section title
    try {
      await page.locator('nav button').filter({ hasText: lang.settings }).first().click({ timeout: 4000 });
      await sleep(1500);
    } catch {
      await page.locator('nav button').filter({ hasText: /подесувања|settings|cilësime/i }).first().click({ timeout: 3000 }).catch(() => {});
      await sleep(1500);
    }
    await ss(page, `s30-${lang.code}-settings`);

    // Navigate to Dashboard
    try {
      await page.locator('nav button').filter({ hasText: lang.dashboard }).first().click({ timeout: 4000 });
      await sleep(1200);
    } catch { /* ignore */ }
    await ss(page, `s30-${lang.code}-dashboard`);
  }

  // Reset to MK
  await page.locator('button').filter({ hasText: /^MK$/ }).first().click({ timeout: 3000 }).catch(() => {});

  await ctx.close();
  console.log('\n  S30 complete');
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    await s29(browser);
    await s30(browser);
  } finally {
    await browser.close();
    console.log('\n  All done. Screenshots in screenshots/s29-s30/');
  }
})();
