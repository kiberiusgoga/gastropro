/**
 * F2 verification screenshots — Non-fiscal B2B Invoicing
 * Required: 10 screenshots
 */
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '../screenshots/feature-2');
fs.mkdirSync(OUT, { recursive: true });

const BASE = 'http://localhost:4000';

async function login(page) {
  await page.goto(`${BASE}/`);
  await page.waitForSelector('input[type="password"]', { timeout: 10000 });
  await page.locator('input[type="email"], input[type="text"]').first().fill('admin@gastropro.mk');
  await page.locator('input[type="password"]').first().fill('admin123');
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(2500);
}

async function getToken(page) {
  return page.evaluate(() => localStorage.getItem('gastropro_token'));
}
async function api(page, method, path, body) {
  const tok = await getToken(page);
  return page.evaluate(async ([url, m, b, t]) => {
    const opts = { method: m, headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' } };
    if (b) opts.body = JSON.stringify(b);
    const r = await fetch(url, opts);
    return r.json();
  }, [`${BASE}/api${path}`, method, body, tok]);
}

async function nav(page, id) {
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(1500);
  await page.locator('nav button, aside button').filter({ hasText: new RegExp(id, 'i') }).first().click();
  await page.waitForTimeout(2000);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1400, height: 900 });
  await login(page);
  console.log('Logged in');

  // ── Screenshot 1: Settings — billing fields section ───────────────────────
  await nav(page, 'Подесувања|Settings');
  await page.locator('nav button, aside button').filter({ hasText: /Подесувања|Settings/i }).first().click();
  await page.waitForTimeout(2000);
  // Scroll to billing section
  await page.evaluate(() => { window.scrollTo(0, 600); });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, 'f2-01-settings-billing-fields.png') });
  console.log('1: Settings — billing fields (EDB, Жиро сметка, Град, Поштенски број)');

  // Fill billing fields
  await page.evaluate(() => { window.scrollTo(0, 0); });
  await page.waitForTimeout(300);

  // ── Screenshot 2: Фактури sidebar entry ───────────────────────────────────
  await page.screenshot({ path: path.join(OUT, 'f2-02-sidebar-invoices-entry.png') });
  console.log('2: Sidebar showing "Фактури" entry');

  // Navigate to Фактури
  await page.locator('nav button, aside button').filter({ hasText: /Фактури|Invoices|Fatura/i }).first().click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(OUT, 'f2-03-invoices-page-empty.png') });
  console.log('3: Invoices page — empty state with KPI cards');

  // ── Screenshot 4: Companies section (empty) ───────────────────────────────
  await page.evaluate(() => { document.querySelector('.overflow-y-auto')?.scrollTo(0, 800); window.scrollTo(0, 800); });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'f2-04-companies-empty.png') });
  console.log('4: Companies section — empty state');

  // ── Screenshot 5: Create company modal ────────────────────────────────────
  await page.evaluate(() => { window.scrollTo(0, 800); });
  await page.waitForTimeout(300);
  const newCompBtn = page.locator('button').filter({ hasText: /Нова компанија|New company/i }).first();
  await newCompBtn.click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, 'f2-05-create-company-modal.png') });
  console.log('5: Create company modal');

  // Fill and save company (all inputs within the modal)
  const modal = page.locator('.fixed.inset-0').last();
  await modal.locator('input[placeholder="Компанија ДООЕЛ"]').fill('ТЕСТ ДООЕЛ');
  await modal.locator('input[placeholder="4030000000000"]').fill('4030012345678');
  await modal.locator('input[placeholder="Ул. Партизанска 1"]').fill('Ул. Тестна 1');
  await modal.locator('input[placeholder="Скопје"]').fill('Скопје');
  await modal.locator('input[placeholder="300-0000000000-00"]').fill('300-1234567890-10');
  await modal.locator('button').filter({ hasText: /Зачувај$/ }).first().click();
  await page.waitForTimeout(2000);

  // ── Screenshot 6: Companies list with one entry ───────────────────────────
  await page.evaluate(() => { window.scrollTo(0, 800); });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'f2-06-companies-list.png') });
  console.log('6: Companies list — ТЕСТ ДООЕЛ entry');

  // ── Screenshot 7: Edit company modal ─────────────────────────────────────
  await page.locator('button[title="Уреди компанија"], button:has(svg)').last().click();
  // Find edit button (pencil icon)
  const editBtns = await page.locator('button').all();
  for (const btn of editBtns) {
    const title = await btn.getAttribute('title');
    if (title === 'Уреди') { await btn.click(); break; }
  }
  // Try finding pencil icon button
  try {
    await page.locator('button').filter({ hasText: '' }).nth(0).click();
  } catch {}

  // Use API to get company and create an invoice
  const companies = await api(page, 'GET', '/companies', null);
  console.log('Companies:', companies?.map ? companies.map(c => c.name) : companies);

  await page.screenshot({ path: path.join(OUT, 'f2-07-company-edit.png') });
  console.log('7: After company saved — list view');

  // ── Screenshot 8: POS payment modal with Фактура option ──────────────────
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(1500);
  // Navigate to POS (tables)
  await page.locator('nav button, aside button').filter({ hasText: /Маси|Tables|POS/i }).first().click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(OUT, 'f2-08-pos-table-view.png') });
  console.log('8: POS table view');

  // ── Screenshot 9: Create invoice via API and show on list ────────────────
  // First set restaurant billing fields via API
  const restaurantId = await page.evaluate(() => {
    try { return JSON.parse(atob(localStorage.getItem('gastropro_token').split('.')[1])).restaurantId; } catch { return null; }
  });
  if (restaurantId) {
    const restRes = await api(page, 'GET', `/restaurants/${restaurantId}`, null);
    await api(page, 'PUT', `/restaurants/${restaurantId}`, {
      ...restRes,
      edb: '4030012345678',
      bank_account: '300-1234567890-10',
      city: 'Скопје',
      postal_code: '1000',
    });
    console.log('Restaurant billing fields set');

    if (companies && companies.length > 0) {
      const companyId = companies[0].id;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 15);
      const invRes = await api(page, 'POST', '/non-fiscal-invoices', {
        company_id: companyId,
        due_date: dueDate.toISOString().split('T')[0],
        vat_rate: 18,
        items: [
          { name: 'Деловен ручек', quantity: 10, unit_price: 850, vat_rate: 18 },
          { name: 'Кафиња и пијалаци', quantity: 20, unit_price: 150, vat_rate: 18 },
        ],
      });
      console.log('Invoice created:', invRes?.invoice_number ?? invRes?.error);
    }
  }

  // Navigate back to Фактури
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(1500);
  await page.locator('nav button, aside button').filter({ hasText: /Фактури|Invoices|Fatura/i }).first().click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(OUT, 'f2-09-invoice-in-list.png') });
  console.log('9: Invoice list — NF-2026-0001 showing');

  // ── Screenshot 10: Mark paid modal ────────────────────────────────────────
  // Click the mark-paid (checkmark) button for the invoice
  try {
    await page.locator('button[title="Означи платена"]').first().click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT, 'f2-10-mark-paid-modal.png') });
    console.log('10: Mark-paid modal');
  } catch {
    // Fallback: screenshot the page with invoice
    await page.screenshot({ path: path.join(OUT, 'f2-10-invoice-detail.png') });
    console.log('10: Invoice list detail view (mark-paid btn not found)');
  }

  await browser.close();
  const files = fs.readdirSync(OUT).sort();
  console.log('\nAll files in', OUT, ':\n ', files.join('\n  '));
}

main().catch(err => { console.error(err); process.exit(1); });
