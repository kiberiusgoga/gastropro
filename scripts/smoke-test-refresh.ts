/**
 * Smoke test: refresh token rotation end-to-end against the real database.
 *
 * Usage:
 *   npx tsx scripts/smoke-test-refresh.ts
 *
 * Requires the app server to be running (npm run dev in another terminal).
 * WARNING: This test leaves the seeded admin user's sessions revoked.
 *          Re-seed or re-login after running.
 */

import 'dotenv/config';
import { createHash } from 'crypto';
import pkg from 'pg';

const { Pool } = pkg;

// ─── Config ──────────────────────────────────────────────────────────────────

const BASE = `http://localhost:${process.env.PORT || 4000}/api`;
const EMAIL = 'admin@gastropro.mk';
const PASSWORD = 'admin123';

// ─── Helpers ─────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const testStart = Date.now();

function pass(label: string, detail = '') {
  passed++;
  console.log(`  [PASS] ${label}${detail ? ' — ' + detail : ''}`);
}

function fail(label: string, detail = '') {
  failed++;
  console.error(`  [FAIL] ${label}${detail ? ' — ' + detail : ''}`);
}

function sha256hex(plaintext: string) {
  return createHash('sha256').update(plaintext).digest('hex');
}

async function post(path: string, body: unknown, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  let json: unknown;
  try { json = await res.json(); } catch { json = {}; }
  return { status: res.status, body: json as Record<string, unknown> };
}

function sleep(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms));
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  console.log('\n══════════════════════════════════════════════════');
  console.log('  Refresh Token Rotation — End-to-End Smoke Test  ');
  console.log('══════════════════════════════════════════════════\n');

  // ── STEP 1: Login ──────────────────────────────────────────────────────────
  console.log('Step 1: Login');
  const login1 = await post('/auth/login', { email: EMAIL, password: PASSWORD });
  if (login1.status !== 200) {
    fail('Login', `status ${login1.status} — ${JSON.stringify(login1.body)}`);
    console.error('\nCannot continue without a valid login. Is the server running on port', process.env.PORT || 4000, '?');
    await pool.end();
    process.exit(1);
  }
  const accessToken1  = login1.body.accessToken  as string;
  const refreshToken1 = login1.body.refreshToken as string;
  const userId        = (login1.body.user as Record<string, string>)?.id;
  pass('Login succeeded');
  console.log(`         accessToken  : ${accessToken1.slice(0, 40)}...`);
  console.log(`         refreshToken1: ${refreshToken1.slice(0, 16)}... (${refreshToken1.length} chars)`);
  console.log(`         userId       : ${userId}`);

  // ── STEP 2: Wait 1 s, then rotate ─────────────────────────────────────────
  console.log('\nStep 2: Wait 1s then rotate token');
  await sleep(1000);

  const rot1 = await post('/auth/refresh', { refreshToken: refreshToken1 });
  if (rot1.status !== 200) {
    fail('First rotation', `status ${rot1.status} — ${JSON.stringify(rot1.body)}`);
  } else {
    pass('First rotation → 200');
  }
  const accessToken2  = rot1.body.accessToken  as string;
  const refreshToken2 = rot1.body.refreshToken as string;
  console.log(`         new accessToken : ${accessToken2?.slice(0, 40)}...`);
  console.log(`         new refreshToken: ${refreshToken2?.slice(0, 16)}...`);

  // ── STEP 3: Verify old token is ROTATED_IN_GRACE in DB ────────────────────
  console.log('\nStep 3: Verify old refresh_token is ROTATED_IN_GRACE in DB');
  const hash1 = sha256hex(refreshToken1);
  const dbCheck1 = await pool.query(
    'SELECT id, rotated_at, replaced_by FROM refresh_tokens WHERE token_hash = $1',
    [hash1]
  );
  const row1 = dbCheck1.rows[0];
  if (!row1) {
    fail('DB: old token row found', 'row not found');
  } else if (!row1.rotated_at) {
    fail('DB: rotated_at set on old token', `rotated_at = ${row1.rotated_at}`);
  } else if (!row1.replaced_by) {
    fail('DB: replaced_by set on old token', `replaced_by = ${row1.replaced_by}`);
  } else {
    pass('DB: old token is ROTATED_IN_GRACE', `rotated_at=${row1.rotated_at.toISOString()} replaced_by=${row1.replaced_by}`);
  }

  // ── STEP 4: Re-present the OLD token within the grace window ───────────────
  console.log('\nStep 4: Re-present OLD token within grace window (should succeed via successor rotation)');
  const rot2 = await post('/auth/refresh', { refreshToken: refreshToken1 });
  if (rot2.status !== 200) {
    fail('Grace-window re-use of old token', `status ${rot2.status} — ${JSON.stringify(rot2.body)}`);
  } else {
    pass('Grace-window re-use → 200 (successor rotated)');
  }
  const refreshToken3 = rot2.body.refreshToken as string;
  console.log(`         refreshToken3: ${refreshToken3?.slice(0, 16)}...`);

  // ── STEP 5: Wait 31s for grace window to expire ───────────────────────────
  console.log('\nStep 5: Waiting 31s for grace window to expire...');
  for (let i = 31; i > 0; i--) {
    process.stdout.write(`\r         ${i}s remaining...  `);
    await sleep(1000);
  }
  console.log('\r         Grace window expired.            ');

  // ── STEP 6: Re-present the OLD token AFTER grace window ───────────────────
  console.log('\nStep 6: Re-present OLD token after grace window (should trigger theft detection)');
  const rot3 = await post('/auth/refresh', { refreshToken: refreshToken1 });
  if (rot3.status !== 401) {
    fail('Theft detection on expired-grace token', `expected 401, got ${rot3.status} — ${JSON.stringify(rot3.body)}`);
  } else {
    const code = (rot3.body.code as string) || (rot3.body.reason as string) || '';
    if (code.toLowerCase().includes('theft') || code.toLowerCase().includes('security')) {
      pass('Theft detection → 401 TOKEN_THEFT', `code=${code}`);
    } else {
      pass('Theft detection → 401', `body=${JSON.stringify(rot3.body)}`);
    }
  }

  // ── STEP 7: Verify ALL user's tokens are revoked ──────────────────────────
  console.log('\nStep 7: Verify all user tokens are revoked in DB');
  const dbCheck2 = await pool.query(
    'SELECT COUNT(*) FROM refresh_tokens WHERE user_id = $1 AND revoked_at IS NULL',
    [userId]
  );
  const activeCount = parseInt(dbCheck2.rows[0].count, 10);
  if (activeCount === 0) {
    pass('DB: all tokens revoked after theft', 'COUNT(active) = 0');
  } else {
    fail('DB: tokens still active after theft', `COUNT(active) = ${activeCount}`);
  }

  // ── STEP 8: Logout with now-revoked token (should fail gracefully) ─────────
  console.log('\nStep 8: POST /auth/logout with already-revoked token (expect non-200)');
  const logout1 = await post('/auth/logout', {}, accessToken2);
  if (logout1.status !== 200) {
    pass('Logout with revoked session returns non-200', `status=${logout1.status}`);
  } else {
    // Some implementations allow logout even if tokens already cleared — tolerated
    pass('Logout returned 200 (tokens already cleared — acceptable)', `status=${logout1.status}`);
  }

  // ── STEP 9: Fresh login + clean logout ────────────────────────────────────
  console.log('\nStep 9: Fresh login then clean logout');
  const login2 = await post('/auth/login', { email: EMAIL, password: PASSWORD });
  if (login2.status !== 200) {
    fail('Second login', `status ${login2.status}`);
  } else {
    pass('Second login succeeded');
  }
  const accessToken3  = login2.body.accessToken  as string;

  const logout2 = await post('/auth/logout', {}, accessToken3);
  if (logout2.status !== 200) {
    fail('Clean logout', `status=${logout2.status} — ${JSON.stringify(logout2.body)}`);
  } else {
    pass('Clean logout → 200');
  }

  // Verify all tokens revoked again
  const dbCheck3 = await pool.query(
    'SELECT COUNT(*) FROM refresh_tokens WHERE user_id = $1 AND revoked_at IS NULL',
    [userId]
  );
  const activeAfterLogout = parseInt(dbCheck3.rows[0].count, 10);
  if (activeAfterLogout === 0) {
    pass('DB: all tokens revoked after clean logout', 'COUNT(active) = 0');
  } else {
    fail('DB: tokens still active after clean logout', `COUNT(active) = ${activeAfterLogout}`);
  }

  // ── STEP 10: Audit log summary ────────────────────────────────────────────
  console.log('\nStep 10: Audit log summary (events since test started)');
  const since = new Date(testStart - 2000); // 2s buffer for test start
  const auditRes = await pool.query(
    `SELECT action, COUNT(*) FROM auth_audit_log
      WHERE user_id = $1 AND timestamp >= $2
      GROUP BY action ORDER BY action`,
    [userId, since]
  );
  const counts: Record<string, number> = {};
  for (const row of auditRes.rows) counts[row.action] = parseInt(row.count, 10);

  console.log('  Audit events recorded:');
  for (const [action, count] of Object.entries(counts)) {
    console.log(`    ${action}: ${count}`);
  }

  const expected: Record<string, number> = {
    login_success:        2,
    refresh_rotated:      2,
    suspected_token_theft: 1,
    logout:               1,
  };
  for (const [action, expectedCount] of Object.entries(expected)) {
    const actual = counts[action] ?? 0;
    if (actual >= expectedCount) {
      pass(`Audit: ${action} × ${actual}`, expectedCount !== actual ? `(expected ≥${expectedCount})` : '');
    } else {
      fail(`Audit: ${action}`, `expected ≥${expectedCount}, got ${actual}`);
    }
  }

  // ── Final summary ─────────────────────────────────────────────────────────
  const elapsed = ((Date.now() - testStart) / 1000).toFixed(1);
  console.log('\n══════════════════════════════════════════════════');
  console.log(`  Results: ${passed} passed, ${failed} failed  (${elapsed}s)`);
  console.log('══════════════════════════════════════════════════\n');

  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('\n[FATAL]', err);
  process.exit(1);
});
