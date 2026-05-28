/**
 * Debug scenarios 1–5
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

async function shot(page, name) {
  const p = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  return p;
}

// ── helpers ──────────────────────────────────────────────────────────────────
async function login(page, errors) {
  if (errors) {
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', err => errors.push(err.message));
  }
  await page.goto(BASE + '/');
  await page.waitForSelector('input[type="password"]', { timeout: 15000 });
  await page.locator('input[type="email"], input[type="text"]').first().fill('admin@gastropro.mk');
  await page.locator('input[type="password"]').first().fill('admin123');
  await page.locator('button[type="submit"]').first().click();
  await page.waitForSelector('nav button', { timeout: 15000 });
  await page.waitForTimeout(1500);
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
    return { status: r.status, body: await r.json().catch(() => null) };
  }, [`${BASE}/api${urlPath}`, method, body, tok]);
}

/** Click the save button inside a modal overlay (uses force to bypass backdrop z-order) */
async function clickModalSave(page, timeout = 10000) {
  // First try: button[type="submit"] inside the z-50 overlay
  const inModal = page.locator('.fixed.inset-0 button[type="submit"]');
  const cnt = await inModal.count();
  if (cnt > 0) {
    await inModal.first().click({ force: true, timeout });
    return true;
  }
  // Fallback: any Зачувај/Save/Создај button with force
  const anyBtn = page.locator('button').filter({ hasText: /Зачувај|Создај|Save|Create/i });
  const anyCnt = await anyBtn.count();
  if (anyCnt > 0) {
    await anyBtn.last().click({ force: true, timeout });
    return true;
  }
  return false;
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  // ══════════════════════════════════════════════════════════════════════════
  // S1 — LOGIN FLOW
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n═══ S1: Login flow ═══════════════════════════════════════════');
  {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1400, height: 900 });
    const consoleErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', err => consoleErrors.push(err.message));

    await page.goto(BASE + '/');
    await page.waitForTimeout(2000);
    await shot(page, 's1-01-login-page');
    const loginForm = await page.locator('input[type="password"]').count();
    if (!loginForm) issue(1, 'Login form not found on app load', 'P1');

    await page.locator('input[type="email"], input[type="text"]').first().fill('admin@gastropro.mk');
    await page.locator('input[type="password"]').first().fill('admin123');
    await page.locator('button[type="submit"]').first().click();
    await page.waitForSelector('nav button', { timeout: 15000 });
    await page.waitForTimeout(2000);
    await shot(page, 's1-02-post-login-dashboard');

    const navText = await page.locator('nav').innerText();
    console.log('  Nav text (first 300):', navText.replace(/\n/g, ' | ').slice(0, 300));
    const expectedEntries = ['Orders', 'Kitchen', 'Menu', 'Inventory', 'Stock', 'Staff', 'CRM', 'Invoices', 'Settings'];
    for (const entry of expectedEntries) {
      if (!navText.includes(entry)) issue(1, `Sidebar missing entry: ${entry}`, 'P2');
    }

    await page.waitForTimeout(1000);
    const preReloadErrors = [...consoleErrors];
    if (preReloadErrors.length > 0) {
      console.log('  Pre-reload console errors:', preReloadErrors.slice(0, 3));
      issue(1, `Console errors on login: ${preReloadErrors[0].slice(0, 120)}`, 'P2');
    } else {
      console.log('  ✓ No pre-reload console errors');
    }

    const networkErrors = [];
    page.on('response', r => { if (r.status() >= 400 && r.url().includes('/api/')) networkErrors.push(`${r.status()} ${r.url()}`); });
    await page.reload();
    await page.waitForTimeout(3000);
    if (networkErrors.length > 0) {
      issue(1, `Network errors on dashboard: ${networkErrors[0]}`, 'P2');
    } else {
      console.log('  ✓ No API network errors on dashboard');
    }

    await shot(page, 's1-03-dashboard-final');
    console.log('  S1 complete');
    await page.close();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // S2 — SETTINGS: Restaurant info
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n═══ S2: Settings — Restaurant info ═══════════════════════════');
  {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1400, height: 900 });
    const consoleErrors = [];
    await login(page, consoleErrors);

    await page.getByRole('button', { name: /Подесувања|Settings/i }).first().click();
    await page.waitForTimeout(2000);
    await shot(page, 's2-01-settings-top');

    // Scroll to top of settings (restaurant info should be first section)
    await page.evaluate(() => {
      const main = document.querySelector('main') || document.querySelector('[class*="overflow-y"]');
      if (main) main.scrollTop = 0;
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(500);

    // Find ALL inputs by placeholder (works regardless of explicit type attribute)
    const allWithPlaceholder = await page.locator('input[placeholder]').all();
    console.log(`  Total inputs with placeholder: ${allWithPlaceholder.length}`);
    for (let i = 0; i < Math.min(allWithPlaceholder.length, 15); i++) {
      const ph = await allWithPlaceholder[i].getAttribute('placeholder').catch(() => '');
      const val = await allWithPlaceholder[i].inputValue().catch(() => '');
      const tp = await allWithPlaceholder[i].getAttribute('type').catch(() => '');
      console.log(`    input[${i}] type="${tp}" placeholder="${ph}" value="${val.slice(0,40)}"`);
    }

    await shot(page, 's2-02-settings-inputs-visible');

    // Fill using exact placeholders from SettingsPage.tsx
    const fillMap = [
      { sel: 'input[placeholder="GastroPro Restaurant"]', val: 'GastroPro Demo' },
      { sel: 'input[placeholder="Ул. Партизанска бб, Скопје"]', val: 'Бул. Партизански Одреди 3, Скопје' },
      { sel: 'input[placeholder="+389 2 123 456"]', val: '+389 2 123 456' },
      { sel: 'input[placeholder="MK4030000000000"]', val: 'MK4030000000000' },
      { sel: 'input[placeholder="4030000000000"]', val: '4030000000000' },
      { sel: 'input[placeholder="300-0000000000-00"]', val: '300-0000000000-00' },
      { sel: 'input[placeholder="Скопје"]', val: 'Скопје' },
      { sel: 'input[placeholder="1000"]', val: '1000' },
    ];

    let filledCount = 0;
    for (const { sel, val } of fillMap) {
      try {
        const el = page.locator(sel).first();
        if (await el.count() > 0) {
          await el.fill(val);
          filledCount++;
          console.log(`  ✓ Filled "${sel}" with "${val}"`);
        } else {
          console.log(`  ⚠ Not found: ${sel}`);
        }
      } catch (e) {
        console.log(`  ⚠ Error filling ${sel}: ${e.message?.slice(0,60)}`);
      }
    }
    console.log(`  Filled ${filledCount} / ${fillMap.length} fields`);

    await shot(page, 's2-03-settings-filled');

    // Click the restaurant info save button (first Зачувај button on the page)
    const saveBtn = page.locator('button').filter({ hasText: /Зачувај промени|Save changes/i }).first();
    const saveBtnCount = await saveBtn.count();
    console.log(`  "Зачувај промени" buttons: ${saveBtnCount}`);

    if (saveBtnCount > 0) {
      await saveBtn.click();
      await page.waitForTimeout(2000);
      await shot(page, 's2-04-settings-after-save');
      console.log('  Save button clicked');
    } else {
      // Fallback: first save-like button
      const anyBtn = page.locator('button').filter({ hasText: /Зачувај|Save/i }).first();
      if (await anyBtn.count() > 0) {
        await anyBtn.click();
        await page.waitForTimeout(2000);
        console.log('  Fallback save clicked');
      } else {
        issue(2, 'Save button not found in Settings', 'P1');
      }
    }

    // Reload and verify persistence
    await page.reload();
    await page.waitForTimeout(2500);
    await page.getByRole('button', { name: /Подесувања|Settings/i }).first().click();
    await page.waitForTimeout(2000);
    await shot(page, 's2-05-settings-after-reload');

    // Check persisted values using exact placeholders
    let persistedCount = 0;
    let missingFields = [];
    for (const { sel, val } of fillMap) {
      try {
        const el = page.locator(sel).first();
        if (await el.count() > 0) {
          const v = await el.inputValue();
          if (v.trim().length > 0) {
            persistedCount++;
          } else {
            missingFields.push(sel);
          }
        }
      } catch {}
    }
    console.log(`  Persisted: ${persistedCount} / ${filledCount} fields`);
    if (missingFields.length > 0) {
      console.log('  Missing after reload:', missingFields.slice(0,3).join(', '));
      issue(2, `${missingFields.length} field(s) lost after reload: ${missingFields[0]}`, 'P1');
    } else if (persistedCount === 0) {
      issue(2, 'All fields empty after reload — settings not persisting', 'P1');
    } else {
      console.log('  ✓ Settings fields persisted after reload');
    }

    if (consoleErrors.length > 0) issue(2, `Console errors: ${consoleErrors[0].slice(0,100)}`, 'P2');
    console.log('  S2 complete');
    await page.close();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // S3 — WAREHOUSES CRUD
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n═══ S3: Warehouses CRUD ══════════════════════════════════════');
  {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1400, height: 900 });
    const consoleErrors = [];
    await login(page, consoleErrors);

    await page.getByRole('button', { name: /Подесувања|Settings/i }).first().click();
    await page.waitForTimeout(2000);

    // Scroll to warehouses section
    const warehouseH = page.locator('h2, h3').filter({ hasText: /Магацин|Warehouse/i });
    const whCount = await warehouseH.count();
    console.log(`  Warehouse section headers: ${whCount}`);
    if (whCount > 0) {
      await warehouseH.first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(1500); // wait for WarehousesTab to load
    } else {
      issue(3, 'Warehouses section not found in Settings', 'P1');
    }
    await shot(page, 's3-01-warehouses-section');

    // Create new warehouse — button text depends on locale (EN=New Warehouse, MK=Нов магацин)
    const addWHBtn = page.locator('button').filter({ hasText: /Нов магацин|New.*Warehouse/i });
    const addWHCount = await addWHBtn.count();
    console.log(`  "+ Нов магацин" buttons: ${addWHCount}`);

    if (addWHCount > 0) {
      await addWHBtn.first().click();
      await page.waitForTimeout(1000);
      await shot(page, 's3-02-create-modal');

      // Find the name input in the modal overlay
      const modalOverlay = page.locator('.fixed.inset-0');
      const overlayCount = await modalOverlay.count();
      console.log(`  Modal overlays visible: ${overlayCount}`);

      // Fill the name input inside the modal
      const modalInput = modalOverlay.locator('input').first();
      const mInputCount = await modalInput.count();
      console.log(`  Inputs in modal: ${mInputCount}`);
      if (mInputCount > 0) {
        await modalInput.fill('Тераса', { force: true });
        console.log('  ✓ Filled modal input with "Тераса"');
      } else {
        // Fallback: last visible input on page
        const allInputs = await page.locator('input:visible').all();
        console.log(`  All visible inputs: ${allInputs.length}`);
        if (allInputs.length > 0) await allInputs[allInputs.length - 1].fill('Тераса');
      }
      await shot(page, 's3-03-create-filled');

      // Click save — use force to bypass backdrop z-order
      const saved = await clickModalSave(page);
      if (!saved) issue(3, 'No save button found in create modal', 'P1');
      await page.waitForTimeout(2000);
      await shot(page, 's3-04-after-create');

      // Verify "Тераса" appears
      const terasa = await page.locator('text=Тераса').count();
      console.log(`  "Тераса" occurrences on page: ${terasa}`);
      if (terasa === 0) {
        issue(3, '"Тераса" warehouse not visible after creation', 'P1');
      } else {
        console.log('  ✓ "Тераса" created and visible');
      }

      // Edit: find edit button by title attr (locale-independent)
      const editInRow = page.locator('button[title*="Edit"], button[title*="Уреди"], button[title*="Modifiko"]').first();
      const eirCount = await editInRow.count();
      console.log(`  Edit buttons (by title): ${eirCount}`);

      if (eirCount > 0) {
        await editInRow.click({ force: true });
        await page.waitForTimeout(800);
        await shot(page, 's3-05-edit-modal');

        // Fill rename in modal
        const editOverlay = page.locator('.fixed.inset-0');
        const editInput = editOverlay.locator('input').first();
        if (await editInput.count() > 0) {
          await editInput.fill('Летна тераса', { force: true });
        } else {
          const visInputs = await page.locator('input:visible').all();
          if (visInputs.length > 0) await visInputs[visInputs.length - 1].fill('Летна тераса');
        }

        await clickModalSave(page);
        await page.waitForTimeout(2000);
        await shot(page, 's3-06-after-edit');

        const letnaCount = await page.locator('text=Летна тераса').count();
        console.log(`  "Летна тераса" occurrences: ${letnaCount}`);
        if (letnaCount === 0) {
          issue(3, 'Warehouse not renamed to "Летна тераса" after edit', 'P1');
        } else {
          console.log('  ✓ Warehouse renamed to "Летна тераса"');
        }
      } else {
        issue(3, 'Edit button not found for "Тераса" row', 'P2');
      }
    } else {
      issue(3, '"+ Нов магацин" button not found', 'P1');
    }

    // Ignore 409 (duplicate warehouse from re-runs) — not an app bug
    const realErrors3 = consoleErrors.filter(e => !e.includes('409'));
    if (realErrors3.length > 0) issue(3, `Console errors: ${realErrors3[0].slice(0,100)}`, 'P2');
    console.log('  S3 complete');
    await page.close();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // S4 — TABLES: bulk assign to "Летна тераса"
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n═══ S4: Tables — bulk assign to warehouse ════════════════════');
  {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1400, height: 900 });
    const consoleErrors = [];
    await login(page, consoleErrors);

    await page.getByRole('button', { name: /Подесувања|Settings/i }).first().click();
    await page.waitForTimeout(2000);

    // Scroll to Tables section
    const tablesH = page.locator('h2, h3').filter({ hasText: /Маси|Tables|Table/i });
    const thCount = await tablesH.count();
    console.log(`  Tables section headers: ${thCount}`);
    if (thCount > 0) {
      await tablesH.first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
    } else {
      issue(4, 'Tables section not found in Settings', 'P1');
    }
    await shot(page, 's4-01-tables-section');

    // Find checkboxes and select first 2
    const checkboxes = page.locator('input[type="checkbox"]');
    const cbCount = await checkboxes.count();
    console.log(`  Table checkboxes found: ${cbCount}`);

    if (cbCount >= 2) {
      await checkboxes.nth(0).check();
      await checkboxes.nth(1).check();
      await page.waitForTimeout(500);
      await shot(page, 's4-02-two-checked');

      // Find warehouse assign dropdown/button
      const selectEl = page.locator('select');
      const selCount = await selectEl.count();
      console.log(`  Select elements: ${selCount}`);
      for (let i = 0; i < selCount; i++) {
        const opts = await selectEl.nth(i).locator('option').allInnerTexts();
        console.log(`    select[${i}] options: ${opts.join(', ').slice(0, 100)}`);
      }

      let assigned = false;
      let assignedWarehouse = '';
      // Find the warehouse select specifically — it should have warehouse-like options
      for (let i = 0; i < selCount; i++) {
        try {
          const opts = await selectEl.nth(i).locator('option').allInnerTexts();
          // Skip currency/timezone selects (they have "MKD", "EUR", "Europe/" etc.)
          const isCurrency = opts.some(o => /MKD|EUR|USD/i.test(o));
          const isTimezone = opts.some(o => /Europe\//i.test(o));
          if (isCurrency || isTimezone) continue;
          // This should be the warehouse select
          const target = opts.find(o => /Тераса|тераса|магацин/i.test(o))
                      || opts.find(o => o.trim().length > 0 && !/select|Select|—/i.test(o));
          if (target) {
            await selectEl.nth(i).selectOption({ label: target });
            assigned = true;
            assignedWarehouse = target;
            console.log(`  ✓ Selected warehouse "${target}" in select[${i}]`);
            break;
          }
        } catch {}
      }

      if (!assigned) {
        const assignBtn = page.locator('button').filter({ hasText: /Додели|Assign|Промени/i });
        const abCount = await assignBtn.count();
        console.log(`  Assign buttons: ${abCount}`);
        if (abCount > 0) {
          await assignBtn.first().click();
          await page.waitForTimeout(800);
          const letnaOpt = page.locator('li, option, button').filter({ hasText: /Летна|Летнa/i });
          if (await letnaOpt.count() > 0) {
            await letnaOpt.first().click();
            assigned = true;
          }
        }
      }

      if (!assigned) {
        issue(4, 'Could not find bulk warehouse assign control', 'P2');
      }

      await page.waitForTimeout(1500);
      await shot(page, 's4-03-after-assign');

      if (assigned && assignedWarehouse) {
        const assignedVisible = await page.locator(`text=${assignedWarehouse}`).count();
        console.log(`  "${assignedWarehouse}" visible after assign: ${assignedVisible} times`);
        if (assignedVisible < 2) {
          issue(4, `Tables do not show "${assignedWarehouse}" after bulk assignment`, 'P2');
        } else {
          console.log(`  ✓ Tables show new warehouse assignment "${assignedWarehouse}"`);
        }
      }
    } else {
      issue(4, `Not enough table checkboxes found (found ${cbCount})`, 'P2');
    }

    if (consoleErrors.length > 0) issue(4, `Console errors: ${consoleErrors[0].slice(0,100)}`, 'P2');
    console.log('  S4 complete');
    await page.close();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // S5 — STOCK DASHBOARD
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n═══ S5: Stock dashboard ══════════════════════════════════════');
  {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1400, height: 900 });
    const consoleErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', err => consoleErrors.push(err.message));
    await login(page, consoleErrors);

    // Navigate to Stock
    const stockBtn = page.locator('nav button').filter({ hasText: /^Stock$|^Залиха$|^Стоки$/i });
    const sbCount = await stockBtn.count();
    console.log(`  Stock nav buttons (exact): ${sbCount}`);
    if (sbCount > 0) {
      await stockBtn.first().click();
    } else {
      // fallback: contains
      await page.locator('nav button').filter({ hasText: /Stock/i }).first().click();
    }
    await page.waitForTimeout(2500);
    await shot(page, 's5-01-stock-dashboard');

    const allPageText = await page.locator('body').innerText();
    const nanCount = (allPageText.match(/\bNaN\b|\bundefined\b/g) || []).length;
    console.log(`  NaN/undefined occurrences: ${nanCount}`);
    if (nanCount > 0) {
      issue(5, `Page shows NaN/undefined ${nanCount} time(s) in Stock dashboard`, 'P1');
    } else {
      console.log('  ✓ No NaN/undefined in page text');
    }

    const tableEl = page.locator('table');
    const tableCount = await tableEl.count();
    console.log(`  Tables on Stock page: ${tableCount}`);
    if (tableCount === 0) {
      issue(5, 'No matrix table found on Stock dashboard', 'P2');
    } else {
      const rows = await tableEl.first().locator('tbody tr').count();
      const cols = await tableEl.first().locator('thead th').count();
      console.log(`  Matrix table: ${rows} rows × ${cols} columns`);
      if (rows === 0) issue(5, 'Stock matrix table has 0 data rows', 'P2');
      else console.log('  ✓ Matrix table has data');
    }

    await shot(page, 's5-02-stock-matrix');

    // "Highlight critical" is a label+checkbox, not a button
    const highlightLabel = page.locator('label').filter({ hasText: /Означи критични|Highlight Critical|Highlight/i });
    const hbCount = await highlightLabel.count();
    console.log(`  Highlight critical labels: ${hbCount}`);
    if (hbCount > 0) {
      await highlightLabel.first().click();
      await page.waitForTimeout(800);
      await shot(page, 's5-03-stock-highlighted');
      console.log('  ✓ Highlight critical toggled');

      const redCells = await page.evaluate(() =>
        [...document.querySelectorAll('td')].filter(el => {
          const cls = el.className || '';
          return cls.includes('rose') || cls.includes('amber') || cls.includes('red') || cls.includes('critical');
        }).length
      );
      console.log(`  Red/critical-colored elements: ${redCells}`);
      if (redCells === 0) {
        issue(5, 'No colored cells visible after toggling "Highlight critical"', 'P3');
      }
    } else {
      issue(5, '"Highlight critical" label/checkbox not found on Stock page', 'P2');
    }

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(400);
    await shot(page, 's5-04-stock-top');

    if (consoleErrors.length > 0) {
      console.log('  Console errors:', consoleErrors.slice(0, 3));
      issue(5, `Console errors on Stock: ${consoleErrors[0].slice(0,100)}`, 'P2');
    } else {
      console.log('  ✓ No console errors on Stock page');
    }

    console.log('  S5 complete');
    await page.close();
  }

  await browser.close();

  // ── Final report ───────────────────────────────────────────────────────────
  console.log('\n\n══════════════════════════════════════════════════════════════');
  console.log('ISSUES FOUND:');
  if (issues.length === 0) {
    console.log('  ✓ No issues detected in S1–S5');
  } else {
    for (const i of issues) {
      console.log(`  S${i.scenario} | ${i.desc} | ${i.sev}`);
    }
  }
  console.log(`\nTotal: ${issues.length} issue(s)`);
  console.log('\nScreenshots saved to:', OUT);
  const files = fs.readdirSync(OUT).sort();
  console.log(files.map(f => `  ${f}`).join('\n'));
}

main().catch(err => { console.error(err); process.exit(1); });
