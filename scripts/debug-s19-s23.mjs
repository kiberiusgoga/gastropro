/**
 * Debug scenarios 19–23 — Z-report supplier consumption + email features
 * Single browser session; uses existing closed shift for Z-report.
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
      const inner = await btn.innerText({ timeout: 400 }).catch(() => 'ERR');
      if (inner.trim() === '') {
        await btn.click({ force: true, timeout: 2000 }).catch(() => {});
        clicked = true;
        break;
      }
    }
    if (!clicked) {
      const cancel = modal.locator('button').filter({ hasText: /Откажи|Затвори|Cancel|Close|✕/i });
      if (await cancel.count() > 0) {
        await cancel.first().click({ force: true, timeout: 2000 }).catch(() => {});
      }
    }
    await page.waitForTimeout(600);
    cnt = await page.locator('.fixed.inset-0').count();
  }
  if (await page.locator('.fixed.inset-0').count() > 0) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }
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
  console.log('  Logged in. Starting S19–S23.');

  // State shared between scenarios
  let closedShiftId = null;
  let firstSupplierId = null;
  let firstSupplierName = null;
  let emailCfgBackup = null;

  // ── S19: Supplier Consumption in Z-report ────────────────────────────────
  console.log('\n═══ S19: Supplier Consumption in Z-report ════════════════════');
  try {
    await closeAnyModal(page);

    // --- Check open shift / attempt close ---
    const shiftsRes = await api(page, 'GET', '/shifts?status=open&limit=1');
    const openShifts = (shiftsRes.body?.data || shiftsRes.body || []).filter(s => s.status === 'open');
    console.log(`  Open shifts: ${openShifts.length}`);

    if (openShifts.length > 0) {
      const openShiftId = openShifts[0].id;
      // Try to close via API — will 409 if open orders exist
      const closeAttempt = await api(page, 'POST', `/shifts/${openShiftId}/close`, { actual_cash: 0 });
      if (closeAttempt.status === 409 && closeAttempt.body?.code === 'SHIFT_HAS_OPEN_ORDERS') {
        console.log(`  Open shift has ${closeAttempt.body.open_order_count} open orders — cannot close (expected safety check)`);
        ok('Close-with-open-orders correctly blocked by API (HTTP 409)');
      } else if (closeAttempt.status === 200 || closeAttempt.status === 201) {
        closedShiftId = openShiftId;
        ok(`Open shift closed successfully — new Z-report generated`);
      } else {
        console.log(`  Unexpected close response: ${closeAttempt.status} ${JSON.stringify(closeAttempt.body).slice(0, 100)}`);
      }
    }

    // --- Fetch the most recent closed shift ---
    const closedRes = await api(page, 'GET', '/shifts?status=closed&limit=1');
    const closedShifts = (closedRes.body?.data || []);
    if (closedShifts.length === 0) {
      issue(19, 'No closed shifts found for Z-report testing', 'P1');
      throw new Error('No closed shift');
    }
    const targetShift = closedShifts[0];
    closedShiftId = targetShift.id;
    console.log(`  Using closed shift: ${closedShiftId.slice(-8)} (closed: ${targetShift.end_time?.slice(0, 10) ?? 'n/a'})`);

    // --- Navigate to Staff → ShiftHistory ---
    await goTo(page, /^Персонал$|^Staff$/i);
    await page.waitForTimeout(1500);
    await shot(page, 's19-01-staff-view');

    // --- Click the first row in ShiftHistory table ---
    const historyHeading = page.locator('h2').filter({ hasText: /Историја на смени|Shift history/i });
    const histHdgCnt = await historyHeading.count();
    console.log(`  "Историја на смени" heading: ${histHdgCnt}`);

    // Scroll to history section
    await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('h2')).find(h => /историја|history/i.test(h.textContent));
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await page.waitForTimeout(600);
    await shot(page, 's19-02-shift-history');

    // Click first closed shift row
    const firstShiftRow = page.locator('table tbody tr').first();
    const shiftRowCnt = await firstShiftRow.count();
    console.log(`  Shift history rows: ${shiftRowCnt}`);
    if (shiftRowCnt === 0) {
      issue(19, 'No rows in ShiftHistory table', 'P1');
      throw new Error('No shift rows');
    }
    await firstShiftRow.click({ force: true });
    await page.waitForTimeout(2000);
    await shot(page, 's19-03-zreport-view');

    // --- Verify Z-report loaded ---
    const zreportContent = await page.locator('body').innerText().catch(() => '');
    const hasShiftId = zreportContent.includes(closedShiftId.slice(-6).toUpperCase()) ||
      /Смена\s*#/i.test(zreportContent) || /Shift\s*#/i.test(zreportContent);
    if (hasShiftId) ok('Z-report loaded (shift ID visible)');
    else issue(19, 'Z-report view not loaded — shift ID not found in page', 'P2');

    // --- Scroll to Supplier Consumption section ---
    await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('h3')).find(h => /извештај за добавувачи|supplier.*report|consumption/i.test(h.textContent));
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
    });
    await page.waitForTimeout(800);
    await shot(page, 's19-04-supplier-section');

    // --- Verify section present ---
    const supSectionHeading = page.locator('h3').filter({ hasText: /Извештај за добавувачи|Supplier.*[Rr]eport|consumption/i });
    const supHdgCnt = await supSectionHeading.count();
    console.log(`  Supplier consumption heading count: ${supHdgCnt}`);
    if (supHdgCnt === 0) {
      issue(19, '"Извештај за добавувачи" section heading not found in Z-report', 'P1');
    } else {
      ok('"Извештај за добавувачи" section is visible');
    }

    // --- Verify supplier rows via API ---
    const consumptionRes = await api(page, 'GET', `/supplier-consumption?shiftId=${closedShiftId}`);
    const consumption = consumptionRes.body || [];
    console.log(`  API supplier rows: ${consumption.length}`);
    if (consumption.length === 0) {
      issue(19, 'No supplier consumption data from API for this shift', 'P2');
    } else {
      ok(`${consumption.length} supplier(s) in consumption API`);
      firstSupplierId = consumption[0].supplier_id;
      firstSupplierName = consumption[0].supplier_name;
      console.log(`  First supplier: "${firstSupplierName}" (${consumption[0].product_count} products, total: ${consumption[0].total_value})`);
    }

    // --- Verify supplier rows visible in UI table ---
    const supTableRows = page.locator('table').filter({ hasNot: page.locator('thead th:has-text("Келнер")') }).locator('tbody tr').filter({ hasNot: page.locator('td[colspan]') });
    const supRowCnt = await supTableRows.count();
    console.log(`  Supplier table rows in UI: ${supRowCnt}`);
    if (supRowCnt === 0) {
      issue(19, 'No supplier rows visible in supplier consumption table', 'P1');
    } else {
      ok(`${supRowCnt} supplier row(s) visible`);
    }

    // --- Expand first supplier row ---
    if (consumption.length > 0) {
      // Find the expand button (shows product_count + ChevronDown)
      const expandBtns = page.locator('button').filter({ hasText: /\d+\s*(производи|products|pcs|Produktoj)/i });
      const expandCnt = await expandBtns.count();
      console.log(`  Product-count expand buttons: ${expandCnt}`);
      if (expandCnt === 0) {
        issue(19, 'Expand button not found in supplier row — cannot test product breakdown', 'P2');
      } else {
        await expandBtns.first().click({ force: true });
        await page.waitForTimeout(600);
        await shot(page, 's19-05-supplier-expanded');

        // Verify product rows are now visible (nested table)
        const productRows = page.locator('table').locator('table tbody tr');
        const prodCnt = await productRows.count();
        console.log(`  Expanded product rows: ${prodCnt}`);
        if (prodCnt === 0) {
          issue(19, 'No product rows visible after expanding supplier', 'P2');
        } else {
          ok(`${prodCnt} product row(s) visible after expand`);

          // --- Verify math: sum of products = supplier total ---
          const firstSup = consumption[0];
          const productSum = firstSup.products.reduce((acc, p) => acc + p.total, 0);
          const supplierTotal = firstSup.total_value;
          if (Math.abs(productSum - supplierTotal) < 0.01) {
            ok(`Math correct: sum of products (${productSum}) = supplier total (${supplierTotal})`);
          } else {
            issue(19, `Math wrong: sum of products (${productSum}) ≠ supplier total (${supplierTotal})`, 'P1');
          }

          // Verify footer "Вкупно" total displayed
          const footerText = await page.locator('tfoot').first().innerText().catch(() => '');
          const hasFooterTotal = /Вкупно|Total/i.test(footerText);
          if (hasFooterTotal) ok('"Вкупно" footer total visible in expanded product table');
          else issue(19, '"Вкупно" footer total not found in expanded product table', 'P3');
        }
      }
    }

    console.log('  S19 complete');
  } catch (e) {
    issue(19, `S19 error: ${e.message}`, 'P1');
    console.log('  S19 error:', e.message);
  }

  // ── S20: Email preview generates correctly ────────────────────────────────
  console.log('\n═══ S20: Email preview generates correctly ═══════════════════');
  let originalSubject = null;
  let originalBody = null;
  try {
    await closeAnyModal(page);
    if (!firstSupplierId) {
      issue(20, 'No supplier ID from S19 — skipping email preview test', 'P2');
    } else {
      // --- Click "Compose emails" for first supplier ---
      const composeBtn = page.locator('button').filter({ hasText: /Состави емаили|Compose emails/i });
      const composeCnt = await composeBtn.count();
      console.log(`  "Compose emails" buttons: ${composeCnt}`);
      if (composeCnt === 0) {
        issue(20, '"Compose emails" button not found in supplier consumption section', 'P1');
      } else {
        await composeBtn.first().click({ force: true });
        await page.waitForTimeout(2000);
        await shot(page, 's20-01-email-preview-modal');

        // --- Verify modal opened ---
        const modal = page.locator('.fixed.inset-0').last();
        const modalCnt = await modal.count();
        if (modalCnt === 0) {
          issue(20, 'EmailPreviewModal did not open after clicking "Compose emails"', 'P1');
        } else {
          ok('EmailPreviewModal opened');

          // --- Verify subject pre-filled ---
          const subjectInput = modal.locator('input').first();
          const subjectVal = await subjectInput.inputValue().catch(() => '');
          console.log(`  Subject: "${subjectVal.slice(0, 80)}"`);
          if (subjectVal.trim()) {
            ok(`Subject pre-filled: "${subjectVal.slice(0, 60)}"`);
            originalSubject = subjectVal;
          } else {
            issue(20, 'Subject input is empty — not pre-filled', 'P2');
          }

          // --- Verify body has product table (real data) ---
          const bodyTextarea = modal.locator('textarea').first();
          const bodyVal = await bodyTextarea.inputValue().catch(() => '');
          console.log(`  Body length: ${bodyVal.length} chars`);
          console.log(`  Body snippet: "${bodyVal.slice(0, 100).replace(/\n/g, '↵')}"`);
          if (bodyVal.length > 50) {
            ok(`Body pre-filled (${bodyVal.length} chars)`);
            originalBody = bodyVal;
            // Check that body contains product name or supplier name
            const hasProductData = /[А-Яа-яa-zA-Z]{3,}/.test(bodyVal) &&
              (bodyVal.includes(firstSupplierName) || /ден|MKD|\d+\.\d{2}/.test(bodyVal));
            if (hasProductData) ok('Body contains real product/supplier data');
            else issue(20, 'Body appears to lack real product data (no prices or supplier name)', 'P3');
          } else {
            issue(20, `Body not pre-filled (only ${bodyVal.length} chars)`, 'P2');
          }

          // --- Verify recipient email ---
          const recipientText = await modal.innerText().catch(() => '');
          const hasRecipient = /Примач|Recipient|@/.test(recipientText);
          if (hasRecipient) ok('Recipient email section visible in modal');
          else issue(20, 'Recipient email not shown in EmailPreviewModal', 'P3');

          // --- Edit subject ---
          await subjectInput.fill((originalSubject || 'Test') + ' [EDITED]');
          await page.waitForTimeout(200);

          // --- Edit body ---
          await bodyTextarea.click({ force: true });
          await bodyTextarea.evaluate(el => el.setSelectionRange(el.value.length, el.value.length));
          await bodyTextarea.type('\n[EDITED LINE]');
          await page.waitForTimeout(200);

          await shot(page, 's20-02-email-edited');
          ok('Subject and body edited');

          // --- Close modal ---
          const closeBtn = modal.locator('button').filter({ hasText: /Откажи|Cancel/i });
          if (await closeBtn.count() > 0) {
            await closeBtn.first().click({ force: true });
          } else {
            await page.keyboard.press('Escape');
          }
          await page.waitForTimeout(800);
          ok('Modal closed');

          // --- Reopen same supplier's modal ---
          await composeBtn.first().click({ force: true });
          await page.waitForTimeout(2000);
          await shot(page, 's20-03-modal-reopened');

          const modal2 = page.locator('.fixed.inset-0').last();
          if (await modal2.count() > 0) {
            const subjectInput2 = modal2.locator('input').first();
            const subjectVal2 = await subjectInput2.inputValue().catch(() => '');
            console.log(`  Reopened subject: "${subjectVal2.slice(0, 80)}"`);

            if (subjectVal2 === originalSubject) {
              ok('Modal correctly RESET on reopen — edits NOT persisted (expected behavior)');
            } else if (subjectVal2.includes('[EDITED]')) {
              issue(20, 'Modal subject persisted "[EDITED]" after close+reopen — should reset each time', 'P2');
            } else {
              // Subject changed but not the edited one — could be a fresh fetch
              ok(`Modal subject reset on reopen (not persisted): "${subjectVal2.slice(0, 60)}"`);
            }

            // Close modal for next test
            const closeBtn2 = modal2.locator('button').filter({ hasText: /Откажи|Cancel/i });
            if (await closeBtn2.count() > 0) await closeBtn2.first().click({ force: true });
            else await page.keyboard.press('Escape');
            await page.waitForTimeout(600);
          } else {
            issue(20, 'Modal did not reopen for second test', 'P2');
          }
        }
      }
    }
    console.log('  S20 complete');
  } catch (e) {
    issue(20, `S20 error: ${e.message}`, 'P2');
    console.log('  S20 error:', e.message);
  }

  // ── S21: Email Send actually delivers ────────────────────────────────────
  console.log('\n═══ S21: Email Send ══════════════════════════════════════════');
  let sentLogId = null;
  try {
    await closeAnyModal(page);
    if (!firstSupplierId || !closedShiftId) {
      issue(21, 'No supplier/shift from S19 — skipping email send test', 'P2');
    } else {
      // Read current email settings
      const emailSettingsRes = await api(page, 'GET', '/email-settings');
      const emailSettings = emailSettingsRes.body;
      console.log(`  SMTP host: ${emailSettings?.smtpHost}`);
      console.log(`  SMTP user: ${emailSettings?.smtpUser}`);
      const smtpConfigured = !!emailSettings?.smtpHost;
      if (!smtpConfigured) {
        issue(21, 'SMTP not configured — emails will be logged as "manual"', 'P2');
      }

      // --- Open "Compose emails" modal and click "Send Now" ---
      const composeBtn = page.locator('button').filter({ hasText: /Состави емаили|Compose emails/i });
      if (await composeBtn.count() === 0) {
        issue(21, '"Compose emails" button not found — cannot test send', 'P1');
      } else {
        await composeBtn.first().click({ force: true });
        await page.waitForTimeout(2000);
        await shot(page, 's21-01-email-modal-before-send');

        const modal = page.locator('.fixed.inset-0').last();
        if (await modal.count() === 0) {
          issue(21, 'EmailPreviewModal did not open', 'P1');
        } else {
          // Intercept the send API response
          let sendApiStatus = null;
          let sendApiBody = null;
          const sendRespHandler = async resp => {
            if (resp.url().includes('/supplier-emails/send') && resp.request().method() === 'POST') {
              sendApiStatus = resp.status();
              try { sendApiBody = await resp.json(); } catch {}
            }
          };
          page.on('response', sendRespHandler);

          // Click "Send Now" button
          const sendBtn = modal.locator('button').filter({ hasText: /Прати сега|Send now/i });
          const sendCnt = await sendBtn.count();
          console.log(`  "Send now" button count: ${sendCnt}`);
          if (sendCnt === 0) {
            issue(21, '"Прати сега" / "Send now" button not found in EmailPreviewModal', 'P1');
          } else {
            await sendBtn.first().click({ force: true });
            await page.waitForTimeout(4000); // wait for send
            page.off('response', sendRespHandler);
            await shot(page, 's21-02-after-send');

            console.log(`  Send API status: ${sendApiStatus}`);
            console.log(`  Send API body: ${JSON.stringify(sendApiBody)}`);

            if (sendApiStatus === 200 && sendApiBody?.status === 'sent') {
              sentLogId = sendApiBody.logId;
              ok(`Email sent successfully (logId: ${sentLogId})`);
              ok(`Supplier: ${firstSupplierName}, SMTP: ${emailSettings.smtpHost}`);
            } else if (sendApiStatus === 200 && sendApiBody?.status === 'manual') {
              issue(21, 'Email logged as "manual" — SMTP not configured or no supplier email', 'P2');
            } else if (sendApiStatus === 200 && sendApiBody?.status === 'failed') {
              issue(21, `Email send FAILED: API returned status="failed" — check SMTP credentials (Ethereal account may be expired)`, 'P1');
            } else if (sendApiStatus === null) {
              issue(21, 'Send API response not captured — modal may not have submitted', 'P1');
            } else {
              issue(21, `Unexpected send API response: status=${sendApiStatus}, body=${JSON.stringify(sendApiBody).slice(0, 100)}`, 'P1');
            }

            // Note: Ethereal preview URL is NOT exposed by /supplier-emails/send
            // (only /email-settings/test returns previewUrl)
            // This is a minor finding for observability
            if (sendApiBody?.status === 'sent' && !sendApiBody?.previewUrl) {
              issue(21, 'Minor: supplier email send does not return Ethereal previewUrl — makes dev verification harder', 'P3');
            }
          }
        }
      }
    }
    console.log('  S21 complete');
  } catch (e) {
    issue(21, `S21 error: ${e.message}`, 'P2');
    console.log('  S21 error:', e.message);
  }

  // ── S22: Email log + resend ───────────────────────────────────────────────
  console.log('\n═══ S22: Email log + resend ══════════════════════════════════');
  try {
    await closeAnyModal(page);

    // Wait for modal to close (modal closes after send in S21)
    await page.waitForTimeout(500);

    // Scroll to email log section
    await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('h4')).find(h => /емаил|email.*лог|email.*log|историја/i.test(h.textContent));
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
    });
    await page.waitForTimeout(600);
    await shot(page, 's22-01-email-log-section');

    // --- Verify email log visible ---
    const emailLogSection = page.locator('h4').filter({ hasText: /Историја на е-пошта|Email.*log|Email.*history/i });
    const emailLogCnt = await emailLogSection.count();
    console.log(`  Email log heading: ${emailLogCnt}`);
    if (emailLogCnt === 0) {
      issue(22, '"Историја на е-пошта" email log section not found', 'P2');
    } else {
      ok('"Историја на е-пошта" email log section visible');
    }

    // --- Get email log via API ---
    const logRes = await api(page, 'GET', `/supplier-email-log?shiftId=${closedShiftId}`);
    const logEntries = logRes.body || [];
    const sentEntries = logEntries.filter(l => l.status === 'sent');
    const failedEntries = logEntries.filter(l => l.status === 'failed');
    console.log(`  Email log: ${logEntries.length} total, ${sentEntries.length} sent, ${failedEntries.length} failed`);

    if (sentEntries.length === 0) {
      issue(22, 'No "sent" entries in email log — expected at least one from S21', 'P2');
    } else {
      ok(`${sentEntries.length} "sent" entries in email log`);
      const lastSent = sentEntries[0];
      console.log(`  Latest sent: ${lastSent.supplier_name} at ${lastSent.created_at?.slice(0, 19)}`);
    }

    // --- Verify UI shows sent badge ---
    // Look for status badge text in log section
    const sentBadge = page.locator('span').filter({ hasText: /^sent$|^пратен$|^Пратен$/i });
    const sentBadgeCnt = await sentBadge.count();
    console.log(`  "Sent" badges visible in UI: ${sentBadgeCnt}`);
    if (sentBadgeCnt > 0) ok('"Sent" badge visible in email log UI');
    else issue(22, '"Sent" badge not found in email log UI', 'P2');

    // --- Test FAILED email: temporarily break SMTP password ---
    const emailSettingsRes = await api(page, 'GET', '/email-settings');
    emailCfgBackup = { ...emailSettingsRes.body };
    console.log(`  Backing up email settings (smtpPass: ${emailCfgBackup.smtpPass?.slice(0, 4)}...)`);

    // Find a supplier that hasn't been sent to yet, or pick a different one
    const consumptionRes = await api(page, 'GET', `/supplier-consumption?shiftId=${closedShiftId}`);
    const allSuppliers = consumptionRes.body || [];
    // Pick a supplier different from firstSupplierId for the fail test
    const failTestSupplier = allSuppliers.find(s => s.supplier_id !== firstSupplierId) || allSuppliers[0];
    console.log(`  Fail test supplier: "${failTestSupplier?.supplier_name}"`);

    // Break SMTP password
    const brokenSettings = { ...emailCfgBackup, smtpPass: 'WRONG_PASSWORD_TESTING' };
    const breakRes = await api(page, 'PUT', '/email-settings', brokenSettings);
    console.log(`  Broke SMTP password (PUT /email-settings): ${breakRes.status}`);
    await page.waitForTimeout(500);

    // Try to send email via API with broken password
    let failedLogId = null;
    if (failTestSupplier) {
      // Get fresh preview to get subject/body
      const previewRes = await api(page, 'POST', '/supplier-emails/preview', {
        shiftId: closedShiftId,
        supplierId: failTestSupplier.supplier_id,
      });
      const previewSubject = previewRes.body?.subject || 'Test subject';
      const previewBody = previewRes.body?.text || 'Test body';

      const failSendRes = await api(page, 'POST', '/supplier-emails/send', {
        shiftId: closedShiftId,
        supplierId: failTestSupplier.supplier_id,
        subject: previewSubject,
        body: previewBody,
      });
      console.log(`  Failed send response: status=${failSendRes.status}, emailStatus=${failSendRes.body?.status}`);
      if (failSendRes.body?.status === 'failed') {
        failedLogId = failSendRes.body.logId;
        ok(`Email correctly logged as "failed" when SMTP password is wrong`);
      } else if (failSendRes.body?.status === 'sent') {
        issue(22, 'Email "sent" even with wrong SMTP password — likely Ethereal is too permissive', 'P3');
      } else {
        issue(22, `Unexpected status on deliberate-fail send: ${failSendRes.body?.status}`, 'P2');
      }
    }

    // --- Restore correct SMTP settings ---
    const restoreRes = await api(page, 'PUT', '/email-settings', emailCfgBackup);
    console.log(`  Restored SMTP settings: ${restoreRes.status}`);
    emailCfgBackup = null; // mark as restored

    // Reload Z-report page to see fresh email log
    await page.reload();
    await page.waitForTimeout(2500);
    await page.waitForSelector('nav button', { timeout: 10000 }).catch(() => {});
    // Re-navigate to Staff → ShiftHistory → Z-report
    await goTo(page, /^Персонал$|^Staff$/i);
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('h2')).find(h => /историја|history/i.test(h.textContent));
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await page.waitForTimeout(600);
    const firstRow = page.locator('table tbody tr').first();
    if (await firstRow.count() > 0) {
      await firstRow.click({ force: true });
      await page.waitForTimeout(2000);
    }
    await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('h4')).find(h => /емаил|email/i.test(h.textContent));
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
    });
    await page.waitForTimeout(600);
    await shot(page, 's22-02-email-log-after-fail');

    // --- Check failed badge in UI ---
    const failedBadge = page.locator('span').filter({ hasText: /^failed$|^неуспешно$|^Неуспешно$/i });
    const failedBadgeCnt = await failedBadge.count();
    console.log(`  "Failed" badges visible in UI: ${failedBadgeCnt}`);
    if (failedBadgeCnt > 0) ok('"Failed" badge visible in email log for broken-SMTP send');
    else issue(22, '"Failed" badge not found in email log after deliberate SMTP failure', 'P2');

    // --- Click "Resend" button on failed entry ---
    const resendBtn = page.locator('button').filter({ hasText: /Повторно прати|Resend/i });
    const resendCnt = await resendBtn.count();
    console.log(`  "Resend" buttons: ${resendCnt}`);
    if (resendCnt === 0) {
      issue(22, '"Повторно прати" Resend button not found on failed log entry', 'P2');
    } else {
      await resendBtn.first().click({ force: true });
      await page.waitForTimeout(2000);
      await shot(page, 's22-03-resend-modal');

      // Verify EmailPreviewModal opens for resend
      const resendModal = page.locator('.fixed.inset-0').last();
      if (await resendModal.count() > 0) {
        ok('EmailPreviewModal opened for resend');

        // Intercept resend API call
        let resendApiStatus = null;
        let resendApiBody = null;
        const resendRespHandler = async resp => {
          if (resp.url().includes('/supplier-emails/send') && resp.request().method() === 'POST') {
            resendApiStatus = resp.status();
            try { resendApiBody = await resp.json(); } catch {}
          }
        };
        page.on('response', resendRespHandler);

        const sendBtn2 = resendModal.locator('button').filter({ hasText: /Прати сега|Send now/i });
        if (await sendBtn2.count() > 0) {
          await sendBtn2.first().click({ force: true });
          await page.waitForTimeout(4000);
          page.off('response', resendRespHandler);
          await shot(page, 's22-04-after-resend');

          console.log(`  Resend API status: ${resendApiStatus}, emailStatus: ${resendApiBody?.status}`);
          if (resendApiBody?.status === 'sent') {
            ok('Resend succeeded (status="sent")');
          } else if (resendApiBody?.status === 'failed') {
            issue(22, `Resend failed: ${JSON.stringify(resendApiBody).slice(0, 100)}`, 'P1');
          } else if (resendApiBody?.status === 'manual') {
            issue(22, 'Resend logged as "manual" — SMTP might not have restored correctly', 'P2');
          } else {
            issue(22, `Resend unexpected response: ${JSON.stringify(resendApiBody).slice(0, 100)}`, 'P1');
          }
        } else {
          issue(22, '"Send now" button not found in resend modal', 'P1');
        }
      } else {
        issue(22, 'EmailPreviewModal did not open for resend', 'P1');
      }
    }

    console.log('  S22 complete');
  } catch (e) {
    // Safety: always restore email settings if we broke them
    if (emailCfgBackup) {
      await api(page, 'PUT', '/email-settings', emailCfgBackup).catch(() => {});
      console.log('  [safety] Restored email settings after S22 error');
    }
    issue(22, `S22 error: ${e.message}`, 'P2');
    console.log('  S22 error:', e.message);
  }

  // ── S23: Email settings — test send ──────────────────────────────────────
  console.log('\n═══ S23: Email settings — test send ═════════════════════════');
  try {
    await closeAnyModal(page);
    await goTo(page, /^Settings$|^Подесувања$/i);
    await page.waitForTimeout(1500);

    // Scroll to Email settings section
    await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('h3, h2')).find(h => /е-пошта подесувања|email.*settings/i.test(h.textContent));
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
    });
    await page.waitForTimeout(600);
    await shot(page, 's23-01-email-settings');

    // --- Verify email settings section visible ---
    const emailSettingsHeading = page.locator('h3, h2').filter({ hasText: /Е-пошта подесувања|Email.*settings/i });
    const esHdgCnt = await emailSettingsHeading.count();
    console.log(`  Email settings heading: ${esHdgCnt}`);
    if (esHdgCnt === 0) {
      issue(23, '"Е-пошта подесувања" section not found in Settings', 'P1');
    } else {
      ok('"Е-пошта подесувања" email settings section visible');
    }

    // --- Verify SMTP fields are populated ---
    const smtpHostInput = page.locator('input[placeholder*="smtp.gmail.com"]');
    const smtpHostVal = await smtpHostInput.inputValue().catch(() => '');
    console.log(`  SMTP host value: "${smtpHostVal}"`);
    if (smtpHostVal) ok(`SMTP host configured: "${smtpHostVal}"`);
    else issue(23, 'SMTP host field is empty', 'P2');

    // --- Enter test email address ---
    const testEmailInput = page.locator('input[placeholder*="test@example.com"], input[type="email"][placeholder*="test"]');
    const testEmailCnt = await testEmailInput.count();
    console.log(`  Test email input: ${testEmailCnt}`);
    if (testEmailCnt === 0) {
      issue(23, 'Test email address input not found in Email settings', 'P1');
    } else {
      const testAddr = 'bhjplavmre6fq5ht@ethereal.email'; // same Ethereal account
      await testEmailInput.first().fill(testAddr);
      await page.waitForTimeout(200);
      ok(`Test email address filled: ${testAddr}`);

      // Intercept API response for test send
      let testSendStatus = null;
      let testSendBody = null;
      const testSendHandler = async resp => {
        if (resp.url().includes('/email-settings/test') && resp.request().method() === 'POST') {
          testSendStatus = resp.status();
          try { testSendBody = await resp.json(); } catch {}
        }
      };
      page.on('response', testSendHandler);

      // --- Click "Send test email" button ---
      const sendTestBtn = page.locator('button').filter({ hasText: /Прати тест емаил|Send test email/i });
      const stBtnCnt = await sendTestBtn.count();
      console.log(`  "Send test email" button: ${stBtnCnt}`);
      if (stBtnCnt === 0) {
        issue(23, '"Прати тест емаил" button not found', 'P1');
      } else {
        await sendTestBtn.first().click({ force: true });
        await page.waitForTimeout(5000);
        page.off('response', testSendHandler);
        await shot(page, 's23-02-after-test-send');

        console.log(`  Test send API: status=${testSendStatus}, body=${JSON.stringify(testSendBody).slice(0, 200)}`);

        if (testSendStatus === 200 && testSendBody?.ok === true) {
          ok(`Test email sent successfully`);
          if (testSendBody.previewUrl) {
            ok(`Ethereal preview URL: ${testSendBody.previewUrl}`);
          } else {
            issue(23, 'Test email sent (ok=true) but no previewUrl in response', 'P3');
          }
        } else if (testSendStatus === 502) {
          issue(23, `SMTP error on test send: ${testSendBody?.error?.slice(0, 100)}`, 'P1');
        } else if (testSendStatus === 400) {
          issue(23, `Test send failed (400): ${testSendBody?.error?.slice(0, 100)}`, 'P2');
        } else {
          issue(23, `Test send unexpected result: HTTP ${testSendStatus}, ${JSON.stringify(testSendBody).slice(0, 100)}`, 'P2');
        }

        // Check for toast notification
        const toast = page.locator('[data-sonner-toast], .sonner-toast, [role="status"]').filter({ hasText: /тест|пратен|sent|test/i });
        const toastCnt = await toast.count();
        console.log(`  Toast notifications: ${toastCnt}`);
        if (toastCnt > 0) ok('Toast notification visible after test send');
        else issue(23, 'No toast notification after test send (success or error)', 'P3');
      }
    }

    await shot(page, 's23-03-settings-final');
    console.log('  S23 complete');
  } catch (e) {
    issue(23, `S23 error: ${e.message}`, 'P2');
    console.log('  S23 error:', e.message);
  }

  // Safety cleanup: restore email settings if anything went wrong
  if (emailCfgBackup) {
    await api(page, 'PUT', '/email-settings', emailCfgBackup).catch(() => {});
    console.log('  [safety] Restored email settings at cleanup');
  }

  await browser.close();

  // ── Final report ──────────────────────────────────────────────────────────
  console.log('\n\n══════════════════════════════════════════════════════════════');
  console.log('ISSUES FOUND (S19–S23):');
  if (issues.length === 0) console.log('  ✓ No issues');
  else issues.forEach(i => console.log(`  S${i.scenario} | ${i.sev} | ${i.desc}`));
  console.log(`\nTotal: ${issues.length} issue(s)`);
  const files = fs.readdirSync(OUT).filter(f => /^s(19|2[0-3])/.test(f)).sort();
  console.log('Screenshots:', files.length ? files.map(f => `  ${f}`).join('\n') : '  none');
}

main().catch(err => { console.error(err.message); process.exit(1); });
