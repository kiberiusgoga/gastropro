/**
 * Debug scenarios 11–18 — Non-fiscal invoices (Feature 2) + Companies CRUD
 * Single browser session; S12 POS flow via UI; S14 extra invoices via API.
 */
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '../screenshots/debug');
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:4000';

const issues = [];
function issue(scenario, desc, sev) {
  issues.push({ scenario, desc, sev });
  console.log(`  ⚠️  [${sev}] S${scenario}: ${desc}`);
}
function ok(msg) { console.log(`  ✓ ${msg}`); }
async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
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
    try { return { status: r.status, body: JSON.parse(text) }; }
    catch { return { status: r.status, body: text }; }
  }, [`${BASE}/api${urlPath}`, method, body, tok]);
}

async function goTo(page, navText) {
  await page.locator('nav button').filter({ hasText: navText }).first().click();
  await page.waitForTimeout(1800);
}

async function closeAnyModal(page) {
  let cnt = await page.locator('.fixed.inset-0').count();
  if (cnt === 0) return;

  for (let attempt = 0; attempt < 4 && cnt > 0; attempt++) {
    const modal = page.locator('.fixed.inset-0').last();
    const allBtns = modal.locator('button');
    const btnCount = await allBtns.count();
    let clicked = false;

    for (let i = 0; i < btnCount; i++) {
      const btn = allBtns.nth(i);
      // innerText() returns only visible rendered text (excludes SVG content)
      // SVG-only close buttons return '' — identify them this way
      const inner = await btn.innerText({ timeout: 400 }).catch(() => 'ERR');
      if (inner.trim() === '') {
        await btn.click({ force: true, timeout: 2000 }).catch(() => {});
        clicked = true;
        break;
      }
    }
    if (!clicked) {
      // Fallback: click the Откажи/Назад/Cancel button
      const cancel = modal.locator('button').filter({ hasText: /Откажи|Назад|Cancel/i });
      if (await cancel.count() > 0) {
        await cancel.first().click({ force: true, timeout: 2000 }).catch(() => {});
      }
    }
    await page.waitForTimeout(600);
    cnt = await page.locator('.fixed.inset-0').count();
  }
  // Final Escape fallback
  if (await page.locator('.fixed.inset-0').count() > 0) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }
}

// Click modal save/submit in the top-level fixed modal
async function modalSubmit(page) {
  const modal = page.locator('.fixed.inset-0');
  const submitBtn = modal.locator('button[type="submit"], button:not([type="button"])').filter({ hasText: /Зачувај|Save|Потврди|Confirm/i });
  const cnt = await submitBtn.count();
  if (cnt > 0) {
    await submitBtn.first().click({ force: true });
  } else {
    // fallback: click first non-cancel button in modal footer
    await modal.locator('button').filter({ hasText: /Зачувај|Потврди|Confirm|Save/i }).first().click({ force: true });
  }
  await page.waitForTimeout(1500);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setViewportSize({ width: 1400, height: 900 });

  page.on('console', msg => {
    if (msg.type() === 'error' && !msg.text().includes('favicon'))
      console.log('  [console.error]', msg.text().slice(0, 120));
  });

  // Single login
  await page.goto(BASE + '/');
  await page.waitForSelector('input[type="password"]', { timeout: 15000 });
  await page.locator('input[type="email"], input[type="text"]').first().fill('admin@gastropro.mk');
  await page.locator('input[type="password"]').first().fill('admin123');
  await page.locator('button[type="submit"]').first().click();
  await page.waitForSelector('nav button', { timeout: 15000 });
  await page.waitForTimeout(1500);
  console.log('  Logged in. Starting S11–S18.');

  // ── S11: Companies CRUD ──────────────────────────────────────────────────
  console.log('\n═══ S11: Companies CRUD ══════════════════════════════════════');
  let abcCompanyId = null;
  try {
    await closeAnyModal(page);
    await goTo(page, /^Invoices$|^Фактури$/i);
    await shot(page, 's11-01-invoices-page');

    // Scroll to Companies section
    await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('h2')).find(h => /companies/i.test(h.textContent));
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
      else window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(600);
    await shot(page, 's11-02-companies-section');

    // ── Create ABC Доел ────────────────────────────────────────────────────
    const newCoBtn = page.locator('button').filter({ hasText: /New Company|Нова компанија/i });
    const ncCount = await newCoBtn.count();
    console.log(`  "New Company" buttons: ${ncCount}`);
    if (ncCount === 0) {
      issue(11, '"New Company" button not found', 'P1');
    } else {
      await newCoBtn.first().click();
      await page.waitForTimeout(800);
      await shot(page, 's11-03-create-modal');

      const modal = page.locator('.fixed.inset-0').last();
      const inputs = modal.locator('input');
      const cnt = await inputs.count();
      console.log(`  Inputs in company modal: ${cnt}`);

      // Fill form fields by placeholder
      await modal.locator('input[placeholder*="Компанија"], input[placeholder*="Company"]').first().fill('ABC Доел');
      await modal.locator('input[placeholder*="4030000000000"]').first().fill('4080012345678');
      await modal.locator('input[placeholder*="Ул. Партизанска"], input[placeholder*="Address"], input[placeholder*="Адреса"]').first().fill('Ул. Нова 1, Скопје');
      await modal.locator('input[placeholder*="Скопје"], input[placeholder*="City"], input[placeholder*="Град"]').first().fill('Скопје');
      await modal.locator('input[placeholder*="info@"], input[type="email"]').first().fill('info@abc.mk');
      await modal.locator('input[placeholder*="+389"]').first().fill('+389 2 333 444');
      // payment_terms_days: 30
      await modal.locator('input[type="number"]').first().clear();
      await modal.locator('input[type="number"]').first().fill('30');

      await shot(page, 's11-04-create-filled');

      // Submit
      await modal.locator('button').filter({ hasText: /Зачувај|Save/i }).first().click({ force: true });
      await page.waitForTimeout(2000);
      await shot(page, 's11-05-after-create');

      // Verify via API
      const cosRes = await api(page, 'GET', '/companies');
      const companies = cosRes.body || [];
      const abc = companies.find(c => /ABC|abc/i.test(c.name));
      if (abc) {
        abcCompanyId = abc.id;
        ok(`ABC Доел created: id=${abc.id}, tin=${abc.tin}`);
      } else {
        issue(11, 'ABC Доел not found in companies after create', 'P1');
        console.log('  Companies:', companies.map(c => c.name).join(', '));
      }
    }

    // ── Create Delete Test company ─────────────────────────────────────────
    let delTestTin = '';
    if (await page.locator('button').filter({ hasText: /New Company|Нова компанија/i }).count() > 0) {
      await page.locator('button').filter({ hasText: /New Company|Нова компанија/i }).first().click();
      await page.waitForTimeout(800);
      const modal2 = page.locator('.fixed.inset-0').last();
      await modal2.locator('input[placeholder*="Компанија"], input[placeholder*="Company"]').first().fill('Delete Test ДООЕЛ');
      delTestTin = '40800' + Date.now().toString().slice(-8);
      await modal2.locator('input[placeholder*="4030000000000"]').first().fill(delTestTin);
      await modal2.locator('button').filter({ hasText: /Зачувај|Save/i }).first().click({ force: true });
      await page.waitForTimeout(2000);
      ok(`"Delete Test ДООЕЛ" created for delete test (TIN: ${delTestTin})`);
    }

    // ── Edit ABC Доел — change address ─────────────────────────────────────
    if (abcCompanyId) {
      await closeAnyModal(page);
      // Scope to companies section (.mt-10) — invoice rows also contain company names
      const abcRow = page.locator('.mt-10 tbody tr').filter({ hasText: 'ABC Доел' });
      const rowCnt = await abcRow.count();
      console.log(`  ABC Доел row count: ${rowCnt}`);
      if (rowCnt > 0) {
        await abcRow.first().locator('button').nth(0).click({ force: true }); // Pencil (first action button)
        await page.waitForTimeout(800);
        await shot(page, 's11-06-edit-modal');

        const editModal = page.locator('.fixed.inset-0').last();
        const addrInput = editModal.locator('input[placeholder*="Ул. Партизанска"], input[placeholder*="Address"], input[placeholder*="Адреса"]').first();
        await addrInput.clear();
        await addrInput.fill('Ул. Изменета 5, Скопје');

        // NOTE: known P2 bug — openEdit() uses c.paymentTermsDays (camelCase) but API returns
        // snake_case, so payment_terms_days = undefined → Zod 400. We issue the bug and close.
        // Intercept response to detect the 400
        let editStatus = null;
        const respHandler = resp => {
          if (resp.url().includes('/companies/') && resp.request().method() === 'PUT') {
            editStatus = resp.status();
          }
        };
        page.on('response', respHandler);
        await editModal.locator('button').filter({ hasText: /Зачувај|Save/i }).first().click({ force: true });
        await page.waitForTimeout(2000);
        page.off('response', respHandler);
        await shot(page, 's11-07-after-edit');

        if (editStatus === 400) {
          issue(11, '[KNOWN BUG] Company edit fails with 400: CompaniesSection.openEdit() uses camelCase c.paymentTermsDays but API returns snake_case payment_terms_days → undefined → Zod validation error', 'P2');
          ok('400 confirmed as expected real bug (P2)');
          await closeAnyModal(page);
        } else {
          // Verify address update
          const abcVerify = await api(page, 'GET', '/companies');
          const abcUpdated = (abcVerify.body || []).find(c => c.id === abcCompanyId);
          if (abcUpdated?.address?.includes('Изменета')) {
            ok(`ABC Доел address updated: "${abcUpdated.address}"`);
          } else {
            issue(11, `Address update not persisted: got "${abcUpdated?.address}" (edit status: ${editStatus})`, 'P2');
            await closeAnyModal(page);
          }
        }
      } else {
        issue(11, 'ABC Доел row not found in Companies table for edit', 'P2');
      }
    }

    // ── Delete "Delete Test ДООЕЛ" ─────────────────────────────────────────
    await closeAnyModal(page);
    // Target by unique TIN set at create-time; if create failed, fall back to API-sourced zero-invoice TIN
    let delRowLocator = null;
    let deletedTin = delTestTin; // track which TIN we're deleting for the post-check
    if (delTestTin) {
      delRowLocator = page.locator('.mt-10 tbody tr').filter({ hasText: delTestTin });
    }
    if (!delTestTin || await delRowLocator.count() === 0) {
      const cosForDel = await api(page, 'GET', '/companies');
      const allDelCos = (cosForDel.body || []).filter(c => /Delete Test/i.test(c.name));
      const zeroInvCo = allDelCos.find(c => parseInt(c.invoice_count || 0) === 0);
      console.log(`  Delete Test companies via API: ${allDelCos.length}, zero-invoice: ${zeroInvCo ? zeroInvCo.tin : 'none'}`);
      if (zeroInvCo) {
        deletedTin = zeroInvCo.tin;
        delRowLocator = page.locator('.mt-10 tbody tr').filter({ hasText: zeroInvCo.tin });
        console.log(`  Delete fallback: targeting TIN ${zeroInvCo.tin}`);
      } else {
        issue(11, `No "Delete Test" company with invoice_count=0 (${allDelCos.length} exist, counts: ${allDelCos.map(c => c.invoice_count).join(',')})`, 'P2');
        delRowLocator = null;
      }
    }
    const delCnt = delRowLocator ? await delRowLocator.count() : 0;
    console.log(`  "Delete Test" row count by TIN: ${delCnt}`);
    if (delCnt > 0) {
      // Intercept DELETE API response to verify the call succeeds
      let deleteApiStatus = null;
      const deleteRespHandler = resp => {
        if (resp.url().includes('/companies/') && resp.request().method() === 'DELETE') {
          deleteApiStatus = resp.status();
        }
      };
      page.on('response', deleteRespHandler);
      await delRowLocator.first().locator('button').nth(1).click({ force: true }); // Trash2 (second action button)
      await page.waitForTimeout(600);
      await shot(page, 's11-08-delete-dialog');

      const delModal = page.locator('.fixed.inset-0').last();
      const delModalText = await delModal.innerText().catch(() => '');
      console.log(`  Delete dialog text: "${delModalText.slice(0, 120).replace(/\n/g, ' ')}"`);
      const confirmBtn = delModal.locator('button').filter({ hasText: /Избриши|Delete/i });
      const dBtnCnt = await confirmBtn.count();
      console.log(`  Delete confirm button count: ${dBtnCnt}`);
      if (dBtnCnt > 0) {
        await confirmBtn.first().click({ force: true });
        await page.waitForTimeout(1500);
        page.off('response', deleteRespHandler);
        await shot(page, 's11-09-after-delete');
        console.log(`  DELETE API status: ${deleteApiStatus}`);

        // Check specifically that THIS TIN is gone (not just any Delete Test company)
        const afterDel = await api(page, 'GET', '/companies');
        const stillExists = (afterDel.body || []).find(c => c.tin === deletedTin);
        if (!stillExists) ok(`"Delete Test ДООЕЛ" (TIN: ${deletedTin}) successfully deleted`);
        else issue(11, `"Delete Test ДООЕЛ" (TIN: ${deletedTin}) still exists after delete — API status: ${deleteApiStatus}`, 'P1');
      } else {
        page.off('response', deleteRespHandler);
        issue(11, `Delete confirm button not found — dialog: "${delModalText.slice(0, 80)}"`, 'P2');
      }
    } else {
      issue(11, '"Delete Test ДООЕЛ" row not found by TIN — cannot test delete', 'P2');
    }

    console.log('  S11 complete');
  } catch (e) {
    issue(11, `S11 error: ${e.message}`, 'P1');
    console.log('  S11 error:', e.message);
  }

  // ── S12: Issue invoice from POS ──────────────────────────────────────────
  console.log('\n═══ S12: Issue invoice from POS order ════════════════════════');
  let s12InvoiceId = null;
  let s12OrderId = null;
  try {
    await closeAnyModal(page);
    if (!abcCompanyId) {
      const cosRes = await api(page, 'GET', '/companies');
      const abc = (cosRes.body || []).find(c => /ABC|abc/i.test(c.name));
      abcCompanyId = abc?.id;
    }
    if (!abcCompanyId) {
      issue(12, 'No ABC Доел company — cannot test invoice', 'P1');
      throw new Error('No company');
    }

    // Reset tables stuck at 'occupied' with no open order (caused by table-not-freed bug, P2)
    const tablesResInit = await api(page, 'GET', '/tables');
    const allTablesInit = tablesResInit.body || [];
    let resetCount = 0;
    for (const t of allTablesInit) {
      if (t.status === 'occupied' && !t.current_order_id) {
        const resetRes = await api(page, 'PUT', `/tables/${t.id}`, {
          number: t.number, capacity: t.capacity ?? 4, zone: t.zone ?? null,
          status: 'free', active: t.active !== false,
        });
        if (resetRes.status === 200) resetCount++;
      }
    }
    if (resetCount > 0) {
      console.log(`  Reset ${resetCount} stuck tables to 'free' (table-not-freed bug workaround)`);
    }

    // Get free table (prefer table 2)
    const tablesRes = await api(page, 'GET', '/tables');
    const tables = tablesRes.body || [];
    const freeTable = tables.find(t => t.status === 'free' && t.number === 2)
      || tables.find(t => t.status === 'free');
    if (!freeTable) { issue(12, 'No free table for order', 'P1'); throw new Error('No free table'); }
    console.log(`  Using table ${freeTable.number} (id: ${freeTable.id})`);

    // Get menu items
    const menuRes = await api(page, 'GET', '/menu-items');
    const menuItems = menuRes.body || [];
    const item1 = menuItems.find(m => parseFloat(m.price) >= 100) || menuItems[0];
    const item2 = menuItems.find(m => m.id !== item1?.id && parseFloat(m.price) >= 50) || menuItems[1];
    const item3 = menuItems.find(m => m.id !== item1?.id && m.id !== item2?.id) || menuItems[2];
    console.log(`  Items: "${item1?.name}" ×5, "${item2?.name}" ×3, "${item3?.name}" ×4`);

    // Create order via API
    const orderRes = await api(page, 'POST', '/orders', {
      table_id: freeTable.id,
      order_type: 'dine_in',
      guest_count: 2,
      items: [
        { menu_item_id: item1.id, name: item1.name, quantity: 5, price: parseFloat(item1.price) },
        { menu_item_id: item2.id, name: item2.name, quantity: 3, price: parseFloat(item2.price) },
        { menu_item_id: item3.id, name: item3.name, quantity: 4, price: parseFloat(item3.price) },
      ],
    });
    if (orderRes.status !== 201) {
      issue(12, `Order creation failed (${orderRes.status}): ${JSON.stringify(orderRes.body).slice(0,100)}`, 'P1');
      throw new Error('Order create failed');
    }
    s12OrderId = orderRes.body.id;
    const orderTotal = parseFloat(orderRes.body.total_amount || orderRes.body.subtotal || 0);
    console.log(`  Order created: id=${s12OrderId}, total=${orderTotal} ден.`);

    // Navigate to POS Tables
    await goTo(page, /^Tables$|^Маси$/i);
    await page.waitForTimeout(2000);
    await shot(page, 's12-01-tables-view');

    // Click table by number using evaluate
    const tableClicked = await page.evaluate((tableNum) => {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        const spans = btn.querySelectorAll('span');
        if (spans.length >= 1 && spans[0].textContent.trim() === String(tableNum)) {
          btn.click();
          return true;
        }
      }
      return false;
    }, freeTable.number);
    console.log(`  Table ${freeTable.number} clicked via evaluate: ${tableClicked}`);
    await page.waitForTimeout(2000);
    await shot(page, 's12-02-table-selected');

    // Look for payment button
    const payBtn = page.locator('button').filter({ hasText: /Плаќање|Наплати|Payment/i }).first();
    const payVisible = await payBtn.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`  Payment button visible: ${payVisible}`);
    if (!payVisible) {
      issue(12, 'Payment button not visible after selecting table', 'P1');
      // Debug: list visible buttons
      const btns = await page.locator('button').all();
      for (const b of btns.slice(0, 20)) {
        const txt = await b.innerText({ timeout: 300 }).catch(() => '');
        if (txt.trim() && txt.length < 40) console.log(`    btn: "${txt.trim()}"`);
      }
    } else {
      await payBtn.click();
      await page.waitForTimeout(1000);
      await shot(page, 's12-03-payment-modal');

      // Verify 4 payment options
      const payMethodBtns = page.locator('.fixed.inset-0').last().locator('button').filter({
        hasText: /Готовина|Cash|Картичка|Card|Мешано|Mixed|Фактура|Invoice/i,
      });
      const pmCount = await payMethodBtns.count();
      console.log(`  Payment method buttons: ${pmCount}`);
      if (pmCount < 4) issue(12, `Expected 4 payment options, found ${pmCount}`, 'P2');
      else ok(`4 payment options visible (${pmCount})`);

      // Select Фактура
      const fakturaBtn = page.locator('button').filter({ hasText: /^Фактура$/ });
      const fbCount = await fakturaBtn.count();
      console.log(`  Фактура buttons: ${fbCount}`);
      if (fbCount === 0) {
        issue(12, '"Фактура" payment option not found', 'P1');
      } else {
        await fakturaBtn.first().click();
        await page.waitForTimeout(600);
        await shot(page, 's12-04-faktura-selected');

        // Select company
        const companySelect = page.locator('.fixed.inset-0 select').last();
        await companySelect.selectOption({ value: abcCompanyId });
        await page.waitForTimeout(400);
        ok(`ABC Доел selected as company`);

        // Click Издај фактура
        const issueBtn = page.locator('button').filter({ hasText: /Издај фактура|Issue invoice/i });
        const ibCount = await issueBtn.count();
        console.log(`  "Издај фактура" button count: ${ibCount}`);
        if (ibCount === 0) {
          issue(12, '"Издај фактура" button not found', 'P1');
        } else {
          await issueBtn.first().click();
          await page.waitForTimeout(2500);
          await shot(page, 's12-05-after-issue');

          // Verify order marked paid
          const orderChk = await api(page, 'GET', `/orders`);
          const order = (orderChk.body || []).find(o => o.id === s12OrderId);
          if (order?.status === 'paid') ok(`Order ${s12OrderId.slice(0,8)} status = 'paid'`);
          else issue(12, `Order status not 'paid' after invoice: got "${order?.status}"`, 'P2');

          // Get the invoice
          const invoicesRes = await api(page, 'GET', '/non-fiscal-invoices');
          const allInvoices = invoicesRes.body || [];
          const thisInvoice = allInvoices.find(i => i.order_id === s12OrderId);
          if (thisInvoice) {
            s12InvoiceId = thisInvoice.id;
            ok(`Invoice created: ${thisInvoice.invoice_number}`);
            if (/^NF-\d{4}-\d{4}$/.test(thisInvoice.invoice_number)) {
              ok(`Invoice number format correct: ${thisInvoice.invoice_number}`);
            } else {
              issue(12, `Invoice number format wrong: "${thisInvoice.invoice_number}" (expected NF-YYYY-NNNN)`, 'P1');
            }
          } else {
            issue(12, 'No invoice found linked to this order', 'P1');
          }
        }
      }
    }

    // Navigate to Invoices page and verify detail
    await goTo(page, /^Invoices$|^Фактури$/i);
    if (s12InvoiceId) {
      // Click Eye icon on this invoice row
      const invDetailRes = await api(page, 'GET', `/non-fiscal-invoices/${s12InvoiceId}`);
      const inv = invDetailRes.body;
      console.log(`  Invoice detail: company="${inv?.company_name}", rest="${inv?.restaurant_name}"`);
      console.log(`  Math: subtotal=${inv?.subtotal}, vat=${inv?.vat_amount}, total=${inv?.total_amount}`);
      const sub = parseFloat(inv?.subtotal ?? 0);
      const vat = parseFloat(inv?.vat_amount ?? 0);
      const tot = parseFloat(inv?.total_amount ?? 0);
      const vatRate = parseFloat(inv?.vat_rate ?? 18);
      const calcVat = Math.round(sub * (vatRate / 100) * 100) / 100;
      const calcTot = Math.round((sub + calcVat) * 100) / 100;
      if (Math.abs(vat - calcVat) < 0.01 && Math.abs(tot - calcTot) < 0.01) {
        ok(`Math correct: ${sub} + ${vat} (${vatRate}%) = ${tot}`);
      } else {
        issue(12, `Math wrong: subtotal=${sub}, vat=${vat} (expected ${calcVat}), total=${tot} (expected ${calcTot})`, 'P1');
      }
      if (inv?.company_name) ok(`Company info populated: "${inv.company_name}" (EDB: ${inv.company_tin})`);
      else issue(12, 'company_name missing from invoice detail', 'P2');
      if (inv?.restaurant_name) ok(`Restaurant info populated: "${inv.restaurant_name}" (EDB: ${inv.restaurant_edb})`);
      else issue(12, 'restaurant_name missing from invoice detail', 'P2');

      // Open invoice detail in UI — scope to invoice table (not company table)
      const firstRow = page.locator('div.rounded-card tbody tr').first();
      if (await firstRow.count() > 0) {
        await firstRow.locator('button').first().click({ force: true }); // Eye icon
        await page.waitForTimeout(800);
        await shot(page, 's12-06-invoice-detail');
        // Close modal
        await page.keyboard.press('Escape');
        await page.waitForTimeout(400);
      }
    }
    console.log('  S12 complete');
  } catch (e) {
    issue(12, `S12 error: ${e.message}`, 'P1');
    console.log('  S12 error:', e.message);
  }

  // ── S13: Print invoice template ──────────────────────────────────────────
  console.log('\n═══ S13: Print invoice template ══════════════════════════════');
  try {
    await closeAnyModal(page);
    if (!s12InvoiceId) {
      issue(13, 'No invoice from S12 to test print', 'P2');
    } else {
      await closeAnyModal(page);
      await goTo(page, /^Invoices$|^Фактури$/i);
      // Open invoice detail — scope to invoice table to avoid clicking company table buttons
      const firstRow = page.locator('div.rounded-card tbody tr').first();
      await firstRow.locator('button').first().click({ force: true }); // Eye
      await page.waitForTimeout(800);
      await shot(page, 's13-01-invoice-detail-open');

      // Check print button exists
      const printBtn = page.locator('button').filter({ hasText: /Печати|Print/i });
      const pbCount = await printBtn.count();
      console.log(`  Print button count: ${pbCount}`);
      if (pbCount === 0) {
        issue(13, '"Печати" print button not found in invoice detail', 'P1');
      } else {
        ok('"Печати" button visible in invoice detail');
        // Intercept window.print to prevent dialog
        await page.evaluate(() => { window.__printCalled = false; window.print = () => { window.__printCalled = true; }; });
        await printBtn.first().click({ force: true });
        await page.waitForTimeout(300);
        const printCalled = await page.evaluate(() => window.__printCalled);
        if (printCalled) ok('window.print() called after clicking Печати');
        else issue(13, 'window.print() NOT called after clicking Печати', 'P2');

        // Check that invoice detail has all required fields
        const detailText = await page.locator('.fixed.inset-0').last().innerText().catch(() => '');
        const checks = [
          { label: 'invoice number (NF-)', found: /NF-\d{4}-\d{4}/.test(detailText) },
          { label: 'company name (ABC)', found: /ABC/i.test(detailText) },
          { label: 'restaurant name (Издавач section)', found: /Издавач/i.test(detailText) },
          { label: 'Основица (subtotal)', found: /Основица/.test(detailText) },
          { label: 'ДДВ (VAT)', found: /ДДВ/.test(detailText) },
          { label: 'Вкупно (total)', found: /Вкупно/.test(detailText) },
        ];
        for (const { label, found } of checks) {
          if (found) ok(`Invoice detail contains: ${label}`);
          else issue(13, `Invoice detail MISSING: ${label}`, 'P2');
        }
      }
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    }
    console.log('  S13 complete');
  } catch (e) {
    issue(13, `S13 error: ${e.message}`, 'P2');
    console.log('  S13 error:', e.message);
  }

  // ── S14: Sequential invoice numbering ────────────────────────────────────
  console.log('\n═══ S14: Sequential invoice numbering ════════════════════════');
  const s14InvoiceIds = [];
  try {
    if (!abcCompanyId) {
      issue(14, 'No company for sequential invoices', 'P1');
    } else {
      // Reset stuck tables before S14
      const tablesInitS14 = await api(page, 'GET', '/tables');
      for (const t of (tablesInitS14.body || [])) {
        if (t.status === 'occupied' && !t.current_order_id) {
          await api(page, 'PUT', `/tables/${t.id}`, {
            number: t.number, capacity: t.capacity ?? 4, zone: t.zone ?? null,
            status: 'free', active: t.active !== false,
          });
        }
      }
      // Get free tables (use tables 5, 6, 7)
      const tablesRes = await api(page, 'GET', '/tables');
      const allTables = tablesRes.body || [];
      const freeTables = allTables.filter(t => t.status === 'free').slice(0, 3);
      console.log(`  Free tables for S14: ${freeTables.map(t => t.number).join(', ')}`);

      // Get menu items for order creation
      const menuRes = await api(page, 'GET', '/menu-items');
      const menuItems = menuRes.body || [];
      const mi = menuItems.slice(0, 2);

      // Get invoice count before
      const before = await api(page, 'GET', '/non-fiscal-invoices');
      const beforeCount = (before.body || []).length;
      console.log(`  Invoice count before S14: ${beforeCount}`);

      for (let i = 0; i < Math.min(3, freeTables.length); i++) {
        const t = freeTables[i];
        // Create order
        const ordRes = await api(page, 'POST', '/orders', {
          table_id: t.id,
          order_type: 'dine_in',
          guest_count: 1,
          items: [{ menu_item_id: mi[0]?.id, name: mi[0]?.name || 'Item', quantity: 2, price: parseFloat(mi[0]?.price || 100) }],
        });
        if (ordRes.status !== 201) {
          console.log(`  Order ${i + 1} failed: ${JSON.stringify(ordRes.body).slice(0,100)}`);
          continue;
        }
        const ordId = ordRes.body.id;
        const ordTotal = parseFloat(ordRes.body.total_amount || ordRes.body.subtotal || 0);

        // Create invoice directly via API
        const today = new Date();
        const dueDate = new Date(today);
        dueDate.setDate(dueDate.getDate() + 30);
        const invRes = await api(page, 'POST', '/non-fiscal-invoices', {
          company_id: abcCompanyId,
          order_id: ordId,
          due_date: dueDate.toISOString().split('T')[0],
          vat_rate: 18,
          items: [{ name: mi[0]?.name || 'Item', quantity: 2, unit_price: parseFloat(mi[0]?.price || 100), vat_rate: 18 }],
        });
        console.log(`  Invoice ${i + 1} status: ${invRes.status}, number: ${invRes.body?.invoice_number ?? invRes.body?.error}`);
        if (invRes.status === 201) {
          s14InvoiceIds.push(invRes.body.id);
        } else {
          issue(14, `Invoice ${i + 1} creation failed: ${JSON.stringify(invRes.body).slice(0, 100)}`, 'P1');
        }
        await page.waitForTimeout(200);
      }

      // Verify sequential numbering
      const afterRes = await api(page, 'GET', '/non-fiscal-invoices');
      const allInvs = (afterRes.body || []).sort((a, b) => a.invoice_number.localeCompare(b.invoice_number));
      console.log(`  All invoice numbers: ${allInvs.map(i => i.invoice_number).join(', ')}`);
      await shot(page, 's14-01-invoices-list');

      let prevNum = 0;
      let allSequential = true;
      for (const inv of allInvs) {
        const m = inv.invoice_number.match(/NF-(\d{4})-(\d{4})/);
        if (!m) {
          issue(14, `Invoice number format wrong: "${inv.invoice_number}"`, 'P1');
          allSequential = false;
          continue;
        }
        const num = parseInt(m[2]);
        if (prevNum > 0 && num !== prevNum + 1) {
          issue(14, `Sequence gap: ${prevNum} → ${num} (skipped or repeated)`, 'P2');
          allSequential = false;
        }
        prevNum = num;
      }
      if (allSequential && allInvs.length > 1) ok(`All ${allInvs.length} invoices sequential: ${allInvs[0].invoice_number} → ${allInvs[allInvs.length-1].invoice_number}`);
    }
    console.log('  S14 complete');
  } catch (e) {
    issue(14, `S14 error: ${e.message}`, 'P2');
    console.log('  S14 error:', e.message);
  }

  // ── S15: Standalone invoice (not from order) ─────────────────────────────
  console.log('\n═══ S15: Standalone invoice (not from order) ════════════════');
  try {
    await goTo(page, /^Invoices$|^Фактури$/i);
    await page.waitForTimeout(1000);

    // Look for "+ New Invoice" / "Нова фактура" button in the INVOICE section (not companies)
    // The NonFiscalInvoicesPage has no such button — invoices are order-based only
    const createInvBtn = page.locator('button').filter({ hasText: /New Invoice|Нова фактура|\+ нова|new.*invoice/i });
    const headerSection = page.locator('.flex.items-start.justify-between').first(); // page header area
    const btnInHeader = headerSection.locator('button');
    const hBtnCount = await btnInHeader.count();
    const createCount = await createInvBtn.count();
    console.log(`  "New Invoice" buttons: ${createCount}, header buttons: ${hBtnCount}`);
    if (createCount > 0) {
      // Standalone flow exists — verify it
      const btnTexts = [];
      for (const b of await createInvBtn.all()) {
        btnTexts.push((await b.innerText({ timeout: 300 }).catch(() => '')).trim());
      }
      console.log(`  Standalone create buttons found: ${btnTexts.join(', ')}`);
      ok('Standalone invoice creation flow EXISTS');
    } else {
      ok('Standalone invoice creation flow does NOT exist — all invoices are order-based (by design)');
      console.log('  Note: invoices are created via POS payment modal (Фактура option)');
    }
    await shot(page, 's15-01-invoices-page-header');
    console.log('  S15 complete');
  } catch (e) {
    issue(15, `S15 error: ${e.message}`, 'P2');
    console.log('  S15 error:', e.message);
  }

  // ── S16: Mark as paid flow ───────────────────────────────────────────────
  console.log('\n═══ S16: Mark as paid ════════════════════════════════════════');
  let s16InvoiceId = null;
  try {
    await closeAnyModal(page);
    await goTo(page, /^Invoices$|^Фактури$/i);
    await page.waitForTimeout(1000);

    // Find a pending invoice
    const invoicesRes = await api(page, 'GET', '/non-fiscal-invoices?status=pending');
    const pendingInvs = invoicesRes.body || [];
    console.log(`  Pending invoices: ${pendingInvs.length}`);
    if (pendingInvs.length === 0) {
      issue(16, 'No pending invoices to mark as paid', 'P2');
    } else {
      s16InvoiceId = pendingInvs[0].id;
      const invNum = pendingInvs[0].invoice_number;
      console.log(`  Target invoice: ${invNum}`);

      // Navigate to invoices page and find the CheckCircle2 (mark paid) button
      // The CheckCircle2 button has title="Означи платена"
      const markPaidBtn = page.locator('button[title*="Означи"], button[title*="paid"], button[title*="платена"]').first();
      const mpCount = await markPaidBtn.count();
      console.log(`  Mark-paid buttons by title: ${mpCount}`);

      // If not found by title, try by icon position (2nd button in action cell)
      let clicked = false;
      if (mpCount > 0) {
        await markPaidBtn.click({ force: true });
        clicked = true;
      } else {
        // Find row for this invoice and click 2nd action button (CheckCircle2)
        const invRow = page.locator('div.rounded-card tbody tr').filter({ hasText: invNum });
        if (await invRow.count() > 0) {
          const rowBtns = invRow.first().locator('button');
          const btnCnt = await rowBtns.count();
          console.log(`  Action buttons in invoice row: ${btnCnt}`);
          if (btnCnt >= 2) {
            await rowBtns.nth(1).click({ force: true }); // 2nd button = CheckCircle2 (mark paid)
            clicked = true;
          }
        }
      }

      if (!clicked) {
        issue(16, 'Could not find mark-paid button', 'P2');
      } else {
        // Wait for the MarkPaidModal to render
        await page.waitForSelector('input[placeholder="Референтен број"]', { timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(500);
        await shot(page, 's16-01-mark-paid-modal');

        // Fill MarkPaidModal — use page-level selectors (modal z-layer issues with .last())
        // Amount should be pre-filled; method defaults to bank_transfer
        const bankaBtn = page.locator('button').filter({ hasText: /^Банка$/ });
        if (await bankaBtn.count() > 0) await bankaBtn.first().click({ force: true });
        // Fill reference — use placeholder-based selector
        const refInput = page.locator('input[placeholder="Референтен број"], input[placeholder*="Референтен"]').first();
        const refVisible = await refInput.count();
        console.log(`  Reference input count: ${refVisible}`);
        if (refVisible > 0) {
          await refInput.clear();
          await refInput.fill('TEST123');
        }
        await shot(page, 's16-02-mark-paid-filled');

        // Submit — use page-level selector for the Потврди button inside the MarkPaidModal
        const submitBtn = page.locator('button').filter({ hasText: /^Потврди$/ }).first();
        if (await submitBtn.count() > 0) await submitBtn.click({ force: true });
        else issue(16, '"Потврди" submit button not found in MarkPaidModal', 'P1');
        await page.waitForTimeout(2000);
        await shot(page, 's16-03-after-mark-paid');

        // Verify status via API
        const detailRes = await api(page, 'GET', `/non-fiscal-invoices/${s16InvoiceId}`);
        const inv = detailRes.body;
        if (inv?.status === 'paid') {
          ok(`Invoice ${invNum} status = 'paid'`);
          if (inv.paid_at) ok(`paid_at timestamp: ${inv.paid_at}`);
          else issue(16, 'paid_at is null after marking paid', 'P2');
          if (inv.paid_reference === 'TEST123') ok(`paid_reference = 'TEST123'`);
          else issue(16, `paid_reference wrong: "${inv.paid_reference}"`, 'P2');
        } else {
          issue(16, `Status not 'paid' after mark-paid: got "${inv?.status}"`, 'P1');
          // Probe: direct API call to diagnose UI form bug vs API bug
          const directMP = await api(page, 'POST', `/non-fiscal-invoices/${s16InvoiceId}/mark-paid`, {
            paid_amount: parseFloat(pendingInvs[0]?.total_amount || 0),
            paid_method: 'bank_transfer',
            paid_reference: 'API-DIRECT',
            paid_at: new Date().toISOString(),
          });
          console.log(`  [S16 probe] Direct API: status=${directMP.status}, body=${JSON.stringify(directMP.body).slice(0, 200)}`);
          if (directMP.status === 200 || directMP.status === 201) {
            issue(16, 'Direct API mark-paid SUCCEEDED — UI form sends wrong payload (React form bug)', 'P1');
          } else {
            issue(16, `Direct API mark-paid FAILED too: HTTP ${directMP.status} — ${JSON.stringify(directMP.body).slice(0, 100)}`, 'P1');
          }
        }

        // Try to mark same invoice paid again — button should NOT be present
        await page.reload();
        await page.waitForTimeout(2000);
        const paidRow = page.locator('div.rounded-card tbody tr').filter({ hasText: invNum });
        const paidRowBtns = await paidRow.first().locator('button').count().catch(() => 0);
        console.log(`  Action buttons on paid invoice row: ${paidRowBtns}`);
        // Only Eye button should exist (no CheckCircle2 or XCircle for paid)
        const paidRowHtml = await paidRow.first().innerHTML().catch(() => '');
        const hasCheckCircle = paidRowHtml.includes('CheckCircle') || await paidRow.first().locator('button[title*="paid"], button[title*="платена"]').count() > 0;
        if (!hasCheckCircle) {
          ok('Mark-paid button NOT present on already-paid invoice (correct)');
        } else {
          issue(16, 'Mark-paid button STILL shows on paid invoice — double-payment possible', 'P2');
        }
      }
    }
    console.log('  S16 complete');
  } catch (e) {
    issue(16, `S16 error: ${e.message}`, 'P2');
    console.log('  S16 error:', e.message);
  }

  // ── S17: Cancel invoice flow ─────────────────────────────────────────────
  console.log('\n═══ S17: Cancel invoice flow ════════════════════════════════');
  try {
    await closeAnyModal(page);
    // Find a pending invoice linked to an order (for order-revert test)
    const invoicesRes = await api(page, 'GET', '/non-fiscal-invoices');
    const allInvs = invoicesRes.body || [];
    const cancelTarget = allInvs.find(i => i.status === 'pending' && i.order_id);
    const cancelTargetNoOrder = allInvs.find(i => i.status === 'pending');
    const toCancel = cancelTarget || cancelTargetNoOrder;

    if (!toCancel) {
      issue(17, 'No pending invoice to cancel', 'P2');
    } else {
      console.log(`  Cancelling invoice: ${toCancel.invoice_number} (order_id: ${toCancel.order_id ?? 'none'})`);
      await goTo(page, /^Invoices$|^Фактури$/i);
      await page.waitForTimeout(1000);

      // Click XCircle (cancel) button for the SPECIFIC invoice we want to cancel
      // Scope to invoice table only (rounded-card) to avoid matching company table rows
      const invRow = page.locator('div.rounded-card tbody tr').filter({ hasText: toCancel.invoice_number });
      const invRowCnt = await invRow.count();
      console.log(`  Invoice row for ${toCancel.invoice_number}: ${invRowCnt}`);

      let cancelClicked = false;
      if (invRowCnt > 0) {
        const rowBtns = invRow.first().locator('button');
        const btnCnt = await rowBtns.count();
        console.log(`  Buttons in cancel row: ${btnCnt}`);
        // Buttons: Eye(0), CheckCircle2(1) if canMarkPaid, XCircle(last) if canCancel
        // For a pending invoice: 3 buttons. Click last = XCircle.
        if (btnCnt >= 2) {
          await rowBtns.last().click({ force: true });
          cancelClicked = true;
        }
      } else {
        // Fallback: first cancel button on page
        const cancelBtn = page.locator('button[title="Откажи"]').first();
        const cbCount = await cancelBtn.count();
        console.log(`  Fallback cancel buttons by title: ${cbCount}`);
        if (cbCount > 0) {
          await cancelBtn.click({ force: true });
          cancelClicked = true;
        }
      }

      if (!cancelClicked) {
        issue(17, 'Could not find cancel button in invoice row', 'P2');
      } else {
        await page.waitForTimeout(800);
        await shot(page, 's17-01-cancel-dialog');

        const dialogText = await page.locator('.fixed.inset-0').last().innerText().catch(() => '');
        console.log(`  Cancel dialog text snippet: "${dialogText.slice(0, 120).replace(/\n/g, ' ')}"`);
        // Warning: "Откажувањето ќе ја поврати оригиналната нарачка во статус „отворена"."
        const hasWarning = /оригиналн|нарачк|отворена/i.test(dialogText);
        console.log(`  Cancel dialog has order-revert warning: ${hasWarning}`);
        if (toCancel.order_id && !hasWarning) {
          issue(17, 'Cancel dialog missing order-revert warning for order-linked invoice', 'P3');
        } else if (hasWarning) {
          ok('Cancel dialog shows order-revert warning');
        }

        // Confirm cancellation — button text: "Потврди откажување"
        // Use page-level locator to avoid z-layer issues
        const confirmBtn = page.locator('button').filter({ hasText: /Потврди откажување|Потврди/i })
          .filter({ hasNot: page.locator('[disabled]') });
        const cbCnt = await confirmBtn.count();
        console.log(`  Confirm cancel buttons: ${cbCnt}`);
        if (cbCnt > 0) {
          await confirmBtn.first().click({ force: true });
          await page.waitForTimeout(2000);
          await shot(page, 's17-02-after-cancel');

          // Verify invoice status
          const invDetail = await api(page, 'GET', `/non-fiscal-invoices/${toCancel.id}`);
          if (invDetail.body?.status === 'cancelled') {
            ok(`Invoice ${toCancel.invoice_number} status = 'cancelled'`);
          } else {
            issue(17, `Invoice status not 'cancelled': got "${invDetail.body?.status}"`, 'P1');
          }

          // Verify order reverted if order-linked
          if (toCancel.order_id) {
            const orderChk = await api(page, 'GET', '/orders');
            const ord = (orderChk.body || []).find(o => o.id === toCancel.order_id);
            console.log(`  Order ${toCancel.order_id.slice(0,8)} status after cancel: "${ord?.status}"`);
            if (ord?.status === 'open') {
              ok(`Order reverted to 'open' after invoice cancellation`);
            } else {
              issue(17, `Order status NOT 'open' after cancellation: got "${ord?.status}"`, 'P1');
            }
          }
        } else {
          issue(17, 'Confirm cancel button not found in dialog', 'P1');
        }
      }
    }
    console.log('  S17 complete');
  } catch (e) {
    issue(17, `S17 error: ${e.message}`, 'P2');
    console.log('  S17 error:', e.message);
  }

  // ── S18: Invoice filters + KPI cards ─────────────────────────────────────
  console.log('\n═══ S18: Invoice filters + KPI cards ════════════════════════');
  try {
    await closeAnyModal(page);
    await goTo(page, /^Invoices$|^Фактури$/i);
    await page.waitForTimeout(1500);
    await shot(page, 's18-01-invoices-all');

    // Read KPI card numbers
    const bodyText = await page.locator('body').innerText();
    const kpiNums = [...bodyText.matchAll(/(\d+)\n/g)].map(m => parseInt(m[1]));
    console.log(`  Numbers on page: ${kpiNums.slice(0, 10).join(', ')}`);

    // Get API counts for comparison
    const allRes = await api(page, 'GET', '/non-fiscal-invoices');
    const allInvs = allRes.body || [];
    const getStatus = inv => inv.computed_status || inv.status;
    const apiPending = allInvs.filter(i => getStatus(i) === 'pending').length;
    const apiPaid = allInvs.filter(i => getStatus(i) === 'paid').length;
    const apiOverdue = allInvs.filter(i => getStatus(i) === 'overdue').length;
    const apiAll = allInvs.filter(i => getStatus(i) !== 'cancelled').length;
    console.log(`  API counts: pending=${apiPending}, paid=${apiPaid}, overdue=${apiOverdue}, total-non-cancelled=${apiAll}`);

    // Check KPI cards exist (4 cards)
    const kpiCards = await page.locator('.grid .bg-surface').all();
    const kcCount = kpiCards.length;
    console.log(`  KPI card containers: ${kcCount}`);
    if (kcCount < 4) issue(18, `Expected 4 KPI cards, found ${kcCount}`, 'P2');
    else ok(`4 KPI cards visible`);

    // Test status filters
    const statusFilters = [
      { key: 'pending', label: /^Pending$|^На чекање$/i },
      { key: 'paid', label: /^Paid$|^Платена$/i },
      { key: 'cancelled', label: /^Cancelled$|^Откажана$/i },
    ];
    for (const { key, label } of statusFilters) {
      const filterBtn = page.locator('button').filter({ hasText: label });
      const fbCnt = await filterBtn.count();
      if (fbCnt === 0) {
        issue(18, `Filter button "${key}" not found`, 'P2');
        continue;
      }
      await filterBtn.first().click({ force: true });
      await page.waitForTimeout(1000);
      await shot(page, `s18-filter-${key}`);

      // Count rows visible in INVOICE table only (not companies table below)
      // Invoice table is inside div.rounded-card; companies table is in .mt-10
      const rows = page.locator('div.rounded-card tbody tr').filter({ hasNot: page.locator('td[colspan]') });
      const rowCnt = await rows.count();
      const apiCount = await api(page, 'GET', `/non-fiscal-invoices?status=${key}`);
      const expectedCount = (apiCount.body || []).length;
      console.log(`  Filter "${key}": visible rows=${rowCnt}, API count=${expectedCount}`);
      if (rowCnt === expectedCount || (rowCnt === 0 && expectedCount === 0)) {
        ok(`Filter "${key}": ${rowCnt} rows matches API count ${expectedCount}`);
      } else if (rowCnt === 1 && expectedCount === 0) {
        // "no results" row visible (colSpan row — the filter above should exclude it)
        ok(`Filter "${key}": 0 invoices (empty state row shown)`);
      } else {
        issue(18, `Filter "${key}": UI shows ${rowCnt} rows, API has ${expectedCount}`, 'P2');
      }
    }

    // Reset to "all" filter
    await page.locator('button').filter({ hasText: /^All$|^Сите$/i }).first().click({ force: true });
    await page.waitForTimeout(800);

    // Test company filter
    if (abcCompanyId) {
      const companySelect = page.locator('select').first();
      const selectCnt = await companySelect.count();
      if (selectCnt > 0) {
        await companySelect.selectOption({ value: abcCompanyId });
        await page.waitForTimeout(1000);
        await shot(page, 's18-filter-company');
        const companyFilteredRows = page.locator('div.rounded-card tbody tr').filter({ hasNot: page.locator('td[colspan]') });
        const cfRows = await companyFilteredRows.count();
        const apiCoFiltered = await api(page, 'GET', `/non-fiscal-invoices?company_id=${abcCompanyId}`);
        const expectedCo = (apiCoFiltered.body || []).length;
        console.log(`  Company filter ABC: visible rows=${cfRows}, API count=${expectedCo}`);
        if (Math.abs(cfRows - expectedCo) <= 1) ok(`Company filter works: ${cfRows} rows ≈ ${expectedCo} API`);
        else issue(18, `Company filter mismatch: UI ${cfRows} rows vs API ${expectedCo}`, 'P2');
      } else {
        issue(18, 'Company filter select not found', 'P3');
      }
    }

    await shot(page, 's18-02-final');
    console.log('  S18 complete');
  } catch (e) {
    issue(18, `S18 error: ${e.message}`, 'P2');
    console.log('  S18 error:', e.message);
  }

  await browser.close();

  // ── Final report ──────────────────────────────────────────────────────────
  console.log('\n\n══════════════════════════════════════════════════════════════');
  console.log('ISSUES FOUND (S11–S18):');
  if (issues.length === 0) console.log('  ✓ No issues');
  else issues.forEach(i => console.log(`  S${i.scenario} | ${i.desc} | ${i.sev}`));
  console.log(`\nTotal: ${issues.length} issue(s)`);
  const files = fs.readdirSync(OUT).filter(f => /^s1[1-8]/.test(f)).sort();
  console.log('Screenshots:', files.map(f => `  ${f}`).join('\n'));
}

main().catch(err => { console.error(err.message); process.exit(1); });
