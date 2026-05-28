/**
 * F4 screenshot G — Failed email with Resend button
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

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1400, height: 900 });
  await login(page);

  // Save broken SMTP
  await api(page, 'PUT', '/email-settings', {
    smtpHost: 'smtp.ethereal.email',
    smtpPort: 587,
    smtpUser: 'bad.user@ethereal.email',
    smtpPass: 'wrongpassword',
    smtpFrom: 'GastroPro <noreply@gastropro.mk>',
    autoSendOnZClose: false,
    subjectTemplate: 'Дневна потрошувачка — {date} — {restaurant_name}',
    bodyTemplate: '',
  });

  // Get shift and send a failing email
  const shiftsRes = await api(page, 'GET', '/shifts?status=closed&limit=1', null);
  const shifts = shiftsRes.body?.data ?? shiftsRes.body ?? [];
  const targetShiftId = Array.isArray(shifts) && shifts.length > 0 ? (shifts[0].id ?? shifts[0].shift_id) : null;

  if (targetShiftId) {
    const consRes = await api(page, 'GET', `/supplier-consumption?shiftId=${targetShiftId}`, null);
    const suppliers = consRes.body ?? [];
    if (Array.isArray(suppliers) && suppliers.length > 0) {
      const sup = suppliers[0];
      const res = await api(page, 'POST', '/supplier-emails/send', {
        shiftId: targetShiftId,
        supplierId: sup.supplier_id,
        subject: `Тест — ${sup.supplier_name}`,
        body: `Почитуван/а,\n\nТест порака.\n\nСо почит,\nГастроПро`,
      });
      console.log('Failed send:', res.status, res.body?.status, res.body?.error?.slice?.(0, 80));
    }
  }

  // Navigate to Z-report
  await page.getByRole('button', { name: /Staff|Персонал/i }).first().click();
  await page.waitForTimeout(2000);

  const shiftRows = page.locator('tbody tr');
  if (await shiftRows.count() > 0) {
    await shiftRows.first().click();
    await page.waitForTimeout(3500);

    // Scroll to email log section
    await page.evaluate(() => {
      const main = document.querySelector('main .overflow-y-auto') || document.querySelector('main');
      if (main) main.scrollTop = main.scrollHeight;
      window.scrollTo(0, document.body.scrollHeight * 3);
    });
    await page.waitForTimeout(2000);

    // Check for Resend button
    const resendBtns = page.locator('button').filter({ hasText: /resend|повторно|испрати/i });
    const count = await resendBtns.count();
    console.log('Resend buttons:', count);

    // Also check for any "Неуспешно" / failed status badges
    const failedBadges = page.locator('span').filter({ hasText: /Неуспешно|Failed|failed/i });
    const badgeCount = await failedBadges.count();
    console.log('Failed badges:', badgeCount);

    await page.screenshot({ path: path.join(OUT, 'f4-g-failed-resend.png') });
    console.log('G: Screenshot captured');

    // If Resend button found, also screenshot after clicking it (modal open)
    if (count > 0) {
      await resendBtns.first().click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(OUT, 'f4-g2-resend-modal.png') });
      console.log('G2: Resend modal open');
      await page.keyboard.press('Escape');
    }
  }

  // Restore good SMTP (will be set by the full script later)
  await api(page, 'PUT', '/email-settings', {
    smtpHost: null,
    smtpPort: 587,
    smtpUser: null,
    smtpPass: null,
    smtpFrom: null,
    autoSendOnZClose: false,
    subjectTemplate: 'Дневна потрошувачка — {date} — {restaurant_name}',
    bodyTemplate: '',
  });

  await browser.close();
  console.log('Done');
}

main().catch(err => { console.error(err); process.exit(1); });
