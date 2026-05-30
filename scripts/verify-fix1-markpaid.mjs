/**
 * Empirically verify Fix 1: MarkPaidModal
 * - Find pending NF invoice, click mark-paid icon, fill form, submit
 * - Capture network payload + response + final invoice status
 */
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:4000';
const BASE_API = `${BASE}/api`;
const DIR = path.join(__dirname, '..', 'screenshots', 'batch-fix');
if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });

function ok(msg)   { console.log(`  ✓ ${msg}`); }
function info(msg) { console.log(`  ℹ️  ${msg}`); }
function issue(msg){ console.log(`  ⚠️  ${msg}`); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function apiReq(tok, method, p, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (tok) headers['Authorization'] = `Bearer ${tok}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${BASE_API}${p}`, opts);
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: r.status, body: json };
}

(async () => {
  // API login
  const loginR = await apiReq(null, 'POST', '/auth/login', { email: 'admin@gastropro.mk', password: 'admin123' });
  const tok = loginR.body?.token || loginR.body?.accessToken;
  if (!tok) { issue('Login failed'); process.exit(1); }
  ok('API login OK');

  // Ensure pending invoice exists
  const invR = await apiReq(tok, 'GET', '/non-fiscal-invoices?status=pending&limit=5');
  let invoices = invR.body?.data || invR.body || [];
  if (!Array.isArray(invoices)) invoices = [];

  if (invoices.length === 0) {
    const compR = await apiReq(tok, 'GET', '/companies');
    const companies = compR.body || [];
    if (companies.length === 0) { issue('No companies'); process.exit(1); }
    const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 15);
    const createR = await apiReq(tok, 'POST', '/non-fiscal-invoices', {
      company_id: companies[0].id,
      due_date: dueDate.toISOString().split('T')[0], vat_rate: 18,
      items: [{ name: 'Test service', quantity: 1, unit_price: 500, vat_rate: 18 }],
    });
    if (createR.status !== 201) { issue(`Create failed: ${createR.status}`); process.exit(1); }
    invoices = [createR.body];
    ok(`Created test invoice: ${createR.body.id?.slice(-8)}`);
  }

  const targetInvoice = invoices[0];
  info(`Target: id=${targetInvoice.id?.slice(-8)} status="${targetInvoice.status}" total=${targetInvoice.total_amount}`);

  // ── Browser test ──────────────────────────────────────────────────────────
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // Capture network for mark-paid
  const networkLog = [];
  page.on('request', req => {
    if (req.url().includes('/mark-paid')) {
      let postBody;
      try { postBody = JSON.parse(req.postData() || '{}'); } catch { postBody = req.postData(); }
      networkLog.push({ type: 'REQUEST', url: req.url(), body: postBody });
      console.log(`\n  [NETWORK REQUEST] POST ${req.url()}`);
      console.log(`  [PAYLOAD] ${JSON.stringify(postBody, null, 2)}`);
    }
  });
  page.on('response', async resp => {
    if (resp.url().includes('/mark-paid')) {
      let respBody;
      try { respBody = await resp.json(); } catch { respBody = '?'; }
      networkLog.push({ type: 'RESPONSE', status: resp.status(), body: respBody });
      console.log(`\n  [NETWORK RESPONSE] HTTP ${resp.status()}`);
      console.log(`  [RESP BODY] ${JSON.stringify(respBody, null, 2)?.slice(0, 400)}`);
    }
  });

  // Login via UI
  await page.goto(BASE + '/');
  await sleep(1500);
  const uiTok = await page.evaluate(() => localStorage.getItem('gastropro_token'));
  if (!uiTok) {
    await page.waitForSelector('input[type="password"]', { timeout: 8000 });
    await page.locator('input[type="email"], input[placeholder*="mail" i]').first().fill('admin@gastropro.mk');
    await page.locator('input[type="password"]').first().fill('admin123');
    await page.locator('button[type="submit"], button').filter({ hasText: /login|влез/i }).first().click();
    await sleep(3000);
  }
  ok('UI login OK');

  // Navigate to Invoices via nav
  const navInvoiceBtn = page.locator('nav button').filter({ hasText: /invoices|фактури/i }).first();
  await navInvoiceBtn.click({ timeout: 5000 });
  await sleep(2500);

  const p1 = path.join(DIR, 'fix1-invoices-page.png');
  await page.screenshot({ path: p1 });
  info(`Screenshot → ${p1}`);

  // Switch to Pending filter to make sure target invoice is visible
  const pendingTab = page.locator('button').filter({ hasText: /^pending$|^Pending$/i });
  if (await pendingTab.count() > 0) {
    await pendingTab.first().click({ timeout: 3000 });
    await sleep(1000);
  }

  // Use Playwright locator with title attribute
  const markPaidBtn = page.locator('button[title="Означи платена"]').first();
  const markPaidCount = await markPaidBtn.count();
  info(`Mark-paid icon buttons (title="Означи платена"): ${markPaidCount}`);

  if (markPaidCount === 0) {
    issue('No mark-paid buttons found — check if invoices are rendering');
    const p2 = path.join(DIR, 'fix1-no-buttons.png');
    await page.screenshot({ path: p2, fullPage: true });
    info(`Screenshot → ${p2}`);
    await browser.close();
    process.exit(1);
  }

  // Playwright proper click (triggers React synthetic events)
  await markPaidBtn.click({ timeout: 5000 });
  await sleep(1200);

  const p3 = path.join(DIR, 'fix1-modal-opened.png');
  await page.screenshot({ path: p3 });
  info(`Screenshot → ${p3}`);

  // Check modal opened
  const modalRoot = page.locator('.fixed.inset-0').first();
  const modalCount = await modalRoot.count();
  info(`Modal visible: ${modalCount > 0}`);

  if (modalCount === 0) {
    issue('Modal did NOT open after clicking "Означи платена"');
    const pText = await page.evaluate(() => document.body.innerText.slice(0, 500));
    info(`Page text: ${pText.replace(/\n/g, ' | ')}`);
    await browser.close();
    process.exit(1);
  }
  ok('MarkPaidModal opened');

  // Read form state
  const amountInput = page.locator('.fixed input[type="number"]').first();
  const amountVal = await amountInput.inputValue().catch(() => '?');
  info(`Amount pre-filled: "${amountVal}"`);

  // Verify method buttons visible
  const bankBtn = page.locator('.fixed button').filter({ hasText: 'Банка' }).first();
  const cashBtn = page.locator('.fixed button').filter({ hasText: 'Готовина' }).first();
  const otherBtn = page.locator('.fixed button').filter({ hasText: 'Друго' }).first();
  info(`Method buttons: Банка=${await bankBtn.count()}, Готовина=${await cashBtn.count()}, Друго=${await otherBtn.count()}`);

  // Choose bank_transfer (click Банка)
  if (await bankBtn.count() > 0) {
    await bankBtn.click();
    await sleep(300);
    ok('Selected "Банка" (bank_transfer)');
  }

  // Fill reference
  const refInput = page.locator('.fixed input[placeholder="Референтен број"]').first();
  const refCount = await refInput.count();
  if (refCount > 0) {
    await refInput.fill('TEST-REF-001');
    await sleep(200);
    ok('Filled reference: "TEST-REF-001"');
  }

  const p4 = path.join(DIR, 'fix1-modal-filled.png');
  await page.screenshot({ path: p4 });
  info(`Screenshot → ${p4}`);
  info(`  Shows: amount="${amountVal}", method=bank_transfer, ref=TEST-REF-001`);

  // Submit via "Потврди" button
  const submitBtn = page.locator('.fixed button').filter({ hasText: /потврди|confirm|submit/i }).first();
  const submitCount = await submitBtn.count();
  info(`Submit button ("Потврди"): ${submitCount}`);

  if (submitCount > 0) {
    await submitBtn.click({ timeout: 5000 });
    ok('Clicked submit ("Потврди")');
  } else {
    // Fallback: click any non-cancel button in modal
    const allModalBtns = await page.locator('.fixed button').all();
    info(`Total modal buttons: ${allModalBtns.length}`);
    for (const btn of allModalBtns) {
      const txt = await btn.innerText().catch(() => '');
      if (!txt.match(/откажи|cancel|close/i) && txt.length > 0) {
        await btn.click(); break;
      }
    }
  }

  // Wait for request/response
  await sleep(2500);

  const p5 = path.join(DIR, 'fix1-after-submit.png');
  await page.screenshot({ path: p5 });
  info(`Screenshot → ${p5}`);

  // Verify via API
  const checkR = await apiReq(tok, 'GET', `/non-fiscal-invoices/${targetInvoice.id}`);
  const finalStatus = checkR.body?.status;
  info(`\n  API invoice status after submit: "${finalStatus}"`);

  console.log('\n  ── Network intercept summary ─────────────────────────────────────');
  if (networkLog.length === 0) {
    issue('No /mark-paid network request intercepted');
  } else {
    networkLog.forEach((n, i) => {
      if (n.type === 'REQUEST') {
        console.log(`\n  [${i}] REQUEST payload:`, JSON.stringify(n.body, null, 4));
      } else {
        console.log(`  [${i}] RESPONSE HTTP ${n.status}:`, JSON.stringify(n.body, null, 4)?.slice(0, 300));
      }
    });
  }

  if (finalStatus === 'paid') {
    ok('\n  Invoice status = "paid" ✓ FIX 1 VERIFIED — MarkPaidModal works correctly');
    ok('  The S16 report issue was transient or resolved by another fix');
  } else if (finalStatus === 'pending') {
    issue('\n  Invoice STILL "pending" — mark-paid FAILED');
    if (networkLog.length > 0) {
      issue('  Request was sent but API may have rejected it — see response above');
    } else {
      issue('  No request was intercepted — form submit may not have triggered');
    }
  } else {
    info(`  Unexpected status: "${finalStatus}"`);
  }

  await browser.close();
})();
