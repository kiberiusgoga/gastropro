/*
 * ═══════════════════════════════════════════════════════════════════════════════
 *  REFRESH TOKEN STATE MACHINE
 *  src/services/refreshTokenService.ts
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  DB ROW SHAPE (refresh_tokens table)
 *  ─────────────────────────────────────────────────────────────────────────────
 *  id           UUID PK
 *  user_id      UUID FK → users.id
 *  token_hash   TEXT UNIQUE   SHA-256(plaintext_token); plaintext never stored
 *  created_at   TIMESTAMPTZ   set at INSERT
 *  expires_at   TIMESTAMPTZ   created_at + 7 days
 *  rotated_at   TIMESTAMPTZ   NULL while ACTIVE; set when rotation occurs
 *  replaced_by  UUID FK → refresh_tokens.id   NULL while ACTIVE
 *  revoked_at   TIMESTAMPTZ   NULL unless explicitly revoked
 *  ip_address   TEXT
 *  user_agent   TEXT
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 *  STATES  (derived at query time — no "state" column)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  Evaluation order (first match wins):
 *
 *  ┌─────────────────────┬──────────────────────────────────────────────────────┐
 *  │ State               │ DB condition                                         │
 *  ├─────────────────────┼──────────────────────────────────────────────────────┤
 *  │ REVOKED             │ revoked_at IS NOT NULL                               │
 *  │ EXPIRED             │ revoked_at IS NULL AND expires_at <= NOW()           │
 *  │ ACTIVE              │ revoked_at IS NULL AND expires_at > NOW()            │
 *  │                     │   AND rotated_at IS NULL                             │
 *  │ ROTATED_IN_GRACE    │ revoked_at IS NULL AND expires_at > NOW()           │
 *  │                     │   AND rotated_at IS NOT NULL                         │
 *  │                     │   AND NOW() - rotated_at <= 30 seconds              │
 *  │ ROTATED_EXPIRED     │ revoked_at IS NULL AND expires_at > NOW()           │
 *  │                     │   AND rotated_at IS NOT NULL                         │
 *  │                     │   AND NOW() - rotated_at > 30 seconds               │
 *  └─────────────────────┴──────────────────────────────────────────────────────┘
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 *  TRANSITION TABLE
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  ┌─────────────────────┬──────────────────┬──────────────────────────────────┐
 *  │ Current State       │ Trigger          │ Outcome                          │
 *  ├─────────────────────┼──────────────────┼──────────────────────────────────┤
 *  │ NOT_FOUND           │ refresh_request  │ 401 reason:'not_found'           │
 *  │ ACTIVE              │ refresh_request  │ → ROTATED_IN_GRACE; new ACTIVE   │
 *  │                     │                  │   return ok:true + new pair      │
 *  │ ACTIVE              │ time (expires_at)│ → EXPIRED  [derived, no write]   │
 *  │ ACTIVE              │ logout           │ → REVOKED  [revokeAllForUser]    │
 *  │ ROTATED_IN_GRACE    │ refresh_request  │ check successor state (1 hop):   │
 *  │                     │ (successor       │   ACTIVE   → rotate + ok:true    │
 *  │                     │  state-dependent)│   GRACE    → race_collision 401  │
 *  │                     │                  │   EXPIRED  → theft_detected 401  │
 *  │                     │                  │   REVOKED  → revoked 401         │
 *  │ ROTATED_IN_GRACE    │ time (+30s)      │ → ROTATED_EXPIRED [derived]      │
 *  │ ROTATED_IN_GRACE    │ logout           │ → REVOKED  [revokeAllForUser]    │
 *  │ ROTATED_EXPIRED     │ refresh_request  │ THEFT DETECTED → revoke chain    │
 *  │                     │                  │   return ok:false 'theft'        │
 *  │ ROTATED_EXPIRED     │ logout           │ → REVOKED  [revokeAllForUser]    │
 *  │ REVOKED             │ refresh_request  │ 401 reason:'revoked' [no theft]  │
 *  │ EXPIRED             │ refresh_request  │ 401 reason:'expired' [no write]  │
 *  └─────────────────────┴──────────────────┴──────────────────────────────────┘
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 *  DETAILED STATE TRANSITIONS
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  NOT_FOUND ──────────────────────────────────────────────────────────────────
 *    refresh_request:
 *      no DB write, no audit
 *      → return { ok: false, reason: 'not_found' }
 *
 *  ACTIVE ─────────────────────────────────────────────────────────────────────
 *    refresh_request:
 *      BEGIN TRANSACTION
 *        SELECT row WHERE token_hash=$1 FOR UPDATE     ← serialises concurrent
 *        (row still ACTIVE — rotated_at IS NULL)        requests on same token
 *        INSERT new_row { token_hash, expires_at=NOW()+7d,
 *                         rotated_at=NULL, replaced_by=NULL, revoked_at=NULL }
 *        UPDATE this_row SET rotated_at=NOW(), replaced_by=new_row.id
 *      COMMIT
 *      Audit: refresh_rotated { old_token_id, new_token_id }
 *      → return { ok: true, accessToken: fresh_jwt, refreshToken: new_plaintext }
 *      State after: this_row = ROTATED_IN_GRACE (for ≤30s), new_row = ACTIVE
 *
 *    logout:
 *      revokeAllForUser(user_id)
 *      Audit: logout { count }
 *      → State: REVOKED
 *
 *  ROTATED_IN_GRACE ───────────────────────────────────────────────────────────
 *    refresh_request:
 *      [Handles: parallel tab, network retry, dropped response]
 *      BEGIN TRANSACTION
 *        SELECT A FOR UPDATE
 *        (A is ROTATED_IN_GRACE — rotated_at IS NOT NULL, within 30s)
 *
 *        Chain-walk (depth limit = 1 hop):
 *          B = SELECT * WHERE id = A.replaced_by FOR UPDATE
 *
 *          Determine B's state:
 *
 *          B is ACTIVE:
 *            ── Normal successor path ──────────────────────────────────────
 *            INSERT C { token_hash, expires_at=NOW()+7d, rotated_at=NULL }
 *            UPDATE B SET rotated_at=NOW(), replaced_by=C.id
 *            COMMIT
 *            Audit: refresh_rotated { old_token_id: B.id, new_token_id: C.id }
 *            → return { ok: true, accessToken: fresh_jwt, refreshToken: C_plaintext }
 *            State after: A = ROTATED_IN_GRACE, B = ROTATED_IN_GRACE, C = ACTIVE
 *
 *          B is ROTATED_IN_GRACE:
 *            ── Depth > 1: grace successor also in grace ──────────────────
 *            [B was rotated before we acquired the lock — concurrent clients
 *             raced and both landed in the grace branch for the same original
 *             token. We have no plaintext for B or its successor to return.]
 *            ROLLBACK
 *            console.warn('refresh chain depth exceeded 1; possible client bug or race')
 *            Audit: refresh_chain_depth_exceeded { token_id: A.id }
 *            → return { ok: false, reason: 'race_collision' }
 *            [Client must re-login; this scenario is rare in correctly behaved clients]
 *
 *          B is ROTATED_EXPIRED:
 *            ── Successor aged out — anomalous state ─────────────────────
 *            [B was rotated and its grace window expired before we arrived.
 *             This means B was used and further rotated while A was still in
 *             grace — indicates a client presenting very old grace tokens.]
 *            ROLLBACK; revokeAllForUser(user_id)
 *            Audit: suspected_token_theft { token_id: A.id }
 *            → return { ok: false, reason: 'theft_detected' }
 *
 *          B is REVOKED:
 *            ROLLBACK
 *            → return { ok: false, reason: 'revoked' }
 *
 *          B is EXPIRED:
 *            ROLLBACK
 *            → return { ok: false, reason: 'expired' }
 *
 *    logout:
 *      revokeAllForUser(user_id) — revokes A, B, C and all others
 *      → State: REVOKED
 *
 *  ROTATED_EXPIRED ────────────────────────────────────────────────────────────
 *    refresh_request:
 *      [Rotated token used >30s after rotation = outside grace window = theft]
 *      revokeAllForUser(user_id)
 *      Audit: suspected_token_theft { token_id, ip, user_agent }
 *      → return { ok: false, reason: 'theft_detected' }
 *
 *    logout:
 *      revokeAllForUser(user_id)
 *
 *  REVOKED ────────────────────────────────────────────────────────────────────
 *    refresh_request:
 *      [Token was revoked by logout or previous theft detection — expected]
 *      No additional theft detection (chain already handled)
 *      → return { ok: false, reason: 'revoked' }
 *
 *  EXPIRED ────────────────────────────────────────────────────────────────────
 *    refresh_request:
 *      No DB write, no audit
 *      → return { ok: false, reason: 'expired' }
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 *  SCENARIO WALKTHROUGHS
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  SCENARIO 1 — Parallel tabs (same ACTIVE token within ~100ms)
 *  ─────────────────────────────────────────────────────────────────────────────
 *
 *    t=0ms   Tab A: present A (ACTIVE)
 *            BEGIN TXN; SELECT A FOR UPDATE  ← acquires row lock
 *    t=1ms   Tab A: INSERT B; UPDATE A(rotated_at=t1, replaced_by=B); COMMIT
 *            return B to Tab A  ✓
 *
 *    t=100ms Tab B: present A
 *            BEGIN TXN; SELECT A FOR UPDATE  ← lock already released
 *            A is ROTATED_IN_GRACE (rotated 100ms ago, < 30s)
 *            SELECT B FOR UPDATE
 *            B is ACTIVE → rotate: INSERT C; UPDATE B(rotated_at=NOW(), replaced_by=C)
 *            COMMIT; return C to Tab B  ✓
 *
 *    Result: Tab A holds B (ROTATED_IN_GRACE), Tab B holds C (ACTIVE).
 *    Both sessions remain valid. No false theft detection.
 *
 *  SCENARIO 1b — Deep parallel collision (race_collision edge case)
 *  ─────────────────────────────────────────────────────────────────────────────
 *
 *    [Very rare: Tab A and Tab B BOTH land in the grace branch simultaneously
 *     for token A, and Tab B's successor lookup finds B already rotated by Tab A]
 *
 *    t=0ms   Tab A: present A (ACTIVE) → acquires FOR UPDATE on A
 *    t=0ms   Tab A: INSERT B; UPDATE A(rotated_at, replaced_by=B); COMMIT
 *    t=0ms   Tab A: begin reading B's state
 *    t=0ms   Tab C: present A simultaneously → acquires FOR UPDATE on A
 *            A is ROTATED_IN_GRACE; SELECT B FOR UPDATE
 *            B is ACTIVE → Tab C rotates B→D; COMMIT; return D to Tab C  ✓
 *    t=0ms   Tab A: acquires FOR UPDATE on B (after Tab C releases it)
 *            B is now ROTATED_IN_GRACE (Tab C rotated it)
 *            → race_collision detected (successor B is ROTATED_IN_GRACE, depth > 1)
 *            → return { ok: false, reason: 'race_collision' }
 *
 *    Tab A must re-login. Tab C holds D (ACTIVE).
 *    This scenario is rare in practice and the user impact is a single re-login.
 *
 *  SCENARIO 2 — Network retry (response lost before client received it)
 *  ─────────────────────────────────────────────────────────────────────────────
 *
 *    t=0s    Client presents A (ACTIVE)
 *            Server rotates A→B, begins sending B
 *    t=0.5s  Network timeout — client never receives response; client still has A
 *    t=0.5s  Client retries with A
 *            A is ROTATED_IN_GRACE (0.5s < 30s)
 *            Server finds B via replaced_by; rotates B→C; returns C  ✓
 *
 *    B exists in DB (ROTATED_IN_GRACE pointing to C) but client never held B,
 *    so B can never be presented. After 30s B becomes ROTATED_EXPIRED but
 *    harmlessly — only the server created it; the hash was never delivered.
 *
 *  SCENARIO 3 — Theft detection (stolen ACTIVE token reused after grace)
 *  ─────────────────────────────────────────────────────────────────────────────
 *
 *    t=0s    Attacker intercepts token A while it is ACTIVE
 *    t=1s    Legit user presents A → rotates A→B (A: ROTATED_IN_GRACE)
 *    t=15s   Legit user presents B → rotates B→C (B: ROTATED_IN_GRACE)
 *    t=45s   Legit user presents C → rotates C→D (C: ROTATED_IN_GRACE)
 *            A is now ROTATED_EXPIRED (44s since rotated_at=t1s, > 30s)
 *    t=50s   Attacker presents A:
 *              A state = ROTATED_EXPIRED (rotated_at=t1s; 49s > 30s)
 *              → THEFT DETECTED
 *              → revokeAllForUser(user_id): B, C, D (and any others) → REVOKED
 *              → Audit: suspected_token_theft { token_id: A.id }
 *              → return { ok: false, reason: 'theft_detected' }
 *    t=50s   Legit user presents D → D is REVOKED → 401 reason:'revoked'
 *            Legit user must re-login. ✓
 *
 *    The 30-second grace window prevents false-positive theft detection for
 *    normal parallel-tab and network-retry patterns while ensuring stolen tokens
 *    used outside that window trigger chain revocation.
 *
 *  SCENARIO 4 — Logout
 *  ─────────────────────────────────────────────────────────────────────────────
 *
 *    User has tokens: A (ACTIVE), B (ACTIVE from another device),
 *                     C (ROTATED_IN_GRACE from Tab X)
 *    POST /auth/logout:
 *      revokeAllForUser(user_id):
 *        UPDATE refresh_tokens SET revoked_at=NOW()
 *        WHERE user_id=$1 AND revoked_at IS NULL
 *      A, B, C → REVOKED (in one query, no token enumeration to caller)
 *      Audit: logout { count: 3 }
 *      → return 200 { message: 'Logged out' }
 *
 *    All subsequent refresh attempts with A, B, or C → 401 reason:'revoked'  ✓
 *    Note: logout revocation is immediate, no grace window.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 *  INVARIANTS THE IMPLEMENTATION MUST MAINTAIN
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  I1. An ACTIVE token always has:
 *        rotated_at IS NULL AND replaced_by IS NULL AND revoked_at IS NULL
 *        AND expires_at > created_at
 *
 *  I2. ROTATED_IN_GRACE and ROTATED_EXPIRED tokens always have:
 *        replaced_by IS NOT NULL AND rotated_at IS NOT NULL
 *      (replaced_by points to the direct successor, forming a forward-only chain)
 *
 *  I3. replaced_by is acyclic — a token can only point forward to a newer token.
 *      Cycles are impossible because a token must exist (and be ACTIVE) before
 *      it can be referenced as a successor.
 *
 *  I4. The DB never stores plaintext tokens — only SHA-256(plaintext).
 *      Plaintext exists only in memory during the issueTokenPair/rotateToken
 *      call and is returned to the caller once. It is never logged.
 *
 *  I5. revokeAllForUser is idempotent:
 *        UPDATE ... WHERE revoked_at IS NULL
 *      Running it twice leaves DB in the same state.
 *
 *  I6. The FOR UPDATE lock on the rotated token row ensures at most one
 *      concurrent rotation completes for any given token. A second concurrent
 *      request acquires the lock only after the first transaction commits,
 *      at which point rotated_at IS NOT NULL and it falls into the grace branch.
 *
 *  I7. A token's user_id never changes after INSERT. Theft detection uses
 *      user_id for bulk revocation — a cross-user chain is architecturally
 *      impossible because issueTokenPair always writes user_id from the
 *      authenticated session.
 *
 *  I8. expires_at is always set at INSERT and never updated. A ROTATED_IN_GRACE
 *      or ROTATED_EXPIRED token may technically still be within its 7-day window,
 *      but rotation state takes logical precedence over expiry for routing.
 *
 *  I9. When walking from a ROTATED_IN_GRACE token to its ACTIVE successor, the
 *      chain depth MUST NOT exceed 1 hop in normal operation.
 *      Depth > 1 (i.e., the immediate successor is itself ROTATED_IN_GRACE) means
 *      either a concurrent rotation race or a misbehaving client presenting the
 *      same grace token repeatedly in very quick succession. In either case:
 *        - Do NOT rotate further (no plaintext exists for intermediate tokens)
 *        - Return { ok: false, reason: 'race_collision' }
 *        - Log a console.warn and emit a 'refresh_chain_depth_exceeded' audit event
 *        - Client must re-login from scratch
 *      The depth check is a safety valve, not a normal code path. Correctly
 *      behaved clients will never trigger it.
 *
 *  I10. LOCK ORDERING DISCIPLINE
 *       All code that holds multiple FOR UPDATE locks on refresh_tokens rows
 *       in a single transaction MUST acquire them in this canonical order:
 *         1. The token presented by the client (oldest in the chain)
 *         2. Then its successor via replaced_by (forward only, never backward)
 *       Acquiring locks in reverse (successor → presented token) risks deadlock
 *       when two concurrent transactions each hold one lock and wait for the other.
 *       Lock order is always: presented_token → replaced_by, never the reverse.
 *
 *       NEVER hold a FOR UPDATE lock across HTTP request boundaries. All lock
 *       acquisition, mutation, and COMMIT/ROLLBACK must occur within a single
 *       request handler. Locks are released when the transaction ends.
 *
 *       For revokeAllForUser (logout, theft detection), use a single bulk UPDATE
 *       without explicit FOR UPDATE — Postgres handles implicit row locks correctly
 *       for set-based operations. There is no read phase requiring consistency,
 *       so FOR UPDATE would add lock overhead with no safety benefit.
 */

// ─────────────────────────────────────────────────────────────────────────────
//  IMPLEMENTATION
// ─────────────────────────────────────────────────────────────────────────────

import { createHash, randomBytes } from 'crypto';
import pool from '../db';
import { generateAccessToken } from '../auth';
import { logAuthEvent } from './authAudit';

const GRACE_SECONDS = 30;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export type RotateReason =
  | 'expired'
  | 'revoked'
  | 'not_found'
  | 'theft_detected'
  | 'race_collision';

export type RotateResult =
  | { ok: true; accessToken: string; refreshToken: string }
  | { ok: false; reason: RotateReason };

interface TokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  rotated_at: Date | null;
  replaced_by: string | null;
  revoked_at: Date | null;
}

export interface UserJwtData {
  email: string;
  role: string;
  restaurantId: string;
  mustChangePassword?: boolean;
}

type TokenState = 'ACTIVE' | 'ROTATED_IN_GRACE' | 'ROTATED_EXPIRED' | 'REVOKED' | 'EXPIRED';

function getState(row: TokenRow): TokenState {
  if (row.revoked_at !== null) return 'REVOKED';
  if (new Date(row.expires_at).getTime() <= Date.now()) return 'EXPIRED';
  if (row.rotated_at === null) return 'ACTIVE';
  const elapsed = (Date.now() - new Date(row.rotated_at).getTime()) / 1000;
  return elapsed <= GRACE_SECONDS ? 'ROTATED_IN_GRACE' : 'ROTATED_EXPIRED';
}

function hashToken(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex');
}

function makePlaintext(): string {
  return randomBytes(32).toString('hex'); // 256-bit random; never stored
}

// Inserts a new refresh_tokens row inside an open transaction.
// Returns the new row's id and the plaintext (only moment it exists).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function insertTokenRow(
  client: { query: (...args: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> },
  userId: string,
  ipAddress: string | undefined,
  userAgent: string | undefined,
): Promise<{ id: string; plaintext: string }> {
  const plaintext = makePlaintext();
  const r = await client.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, ip_address, user_agent)
     VALUES ($1, $2, NOW() + INTERVAL '7 days', $3, $4)
     RETURNING id`,
    [userId, hashToken(plaintext), ipAddress ?? null, userAgent?.slice(0, 500) ?? null],
  );
  return { id: (r.rows[0] as { id: string }).id, plaintext };
}

// Builds an access JWT by querying users inside an open transaction.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildJwt(
  client: { query: (...args: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> },
  userId: string,
): Promise<string> {
  const r = await client.query(
    'SELECT id, email, role, restaurant_id, must_change_password FROM users WHERE id = $1',
    [userId],
  );
  const u = r.rows[0] as {
    id: string; email: string; role: string;
    restaurant_id: string; must_change_password: boolean;
  };
  return generateAccessToken({
    id: u.id,
    email: u.email,
    role: u.role,
    restaurantId: u.restaurant_id,
    mustChangePassword: u.must_change_password ?? false,
  });
}

/**
 * Issues a fresh token pair at login/setup time.
 * userForJwt is supplied by the caller (already in memory from the login query)
 * to avoid a redundant round-trip to the users table.
 * Only the SHA-256 hash of the refresh token is written to the DB (I4).
 */
export async function issueTokenPair(
  userId: string,
  ipAddress: string | undefined,
  userAgent: string | undefined,
  userForJwt: UserJwtData,
): Promise<TokenPair> {
  const plaintext = makePlaintext();
  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, ip_address, user_agent)
     VALUES ($1, $2, NOW() + INTERVAL '7 days', $3, $4)`,
    [userId, hashToken(plaintext), ipAddress ?? null, userAgent?.slice(0, 500) ?? null],
  );
  const accessToken = generateAccessToken({
    id: userId,
    email: userForJwt.email,
    role: userForJwt.role,
    restaurantId: userForJwt.restaurantId,
    mustChangePassword: userForJwt.mustChangePassword ?? false,
  });
  return { accessToken, refreshToken: plaintext };
}

/**
 * Core rotation logic. Implements the state machine in the header comment exactly.
 * All reads/writes are inside a single DB transaction with SELECT ... FOR UPDATE
 * acquired in canonical order per I10 (presented token → successor, never reverse).
 * logAuthEvent and revokeAllForUser calls happen after COMMIT/ROLLBACK.
 */
export async function rotateToken(
  plaintextToken: string,
  ipAddress: string | undefined,
  userAgent: string | undefined,
): Promise<RotateResult> {
  const tokenHash = hashToken(plaintextToken);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = await (pool as any).connect();

  try {
    await client.query('BEGIN');

    // ── Lock the presented token (I10: first lock, oldest in chain) ──────────
    const { rows } = await client.query(
      'SELECT * FROM refresh_tokens WHERE token_hash = $1 FOR UPDATE',
      [tokenHash],
    );

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return { ok: false, reason: 'not_found' };
    }

    const row = rows[0] as TokenRow;
    const state = getState(row);

    // ── Terminal states — no writes, no side-effects ──────────────────────────
    if (state === 'REVOKED') {
      await client.query('ROLLBACK');
      return { ok: false, reason: 'revoked' };
    }

    if (state === 'EXPIRED') {
      await client.query('ROLLBACK');
      return { ok: false, reason: 'expired' };
    }

    // ── ROTATED_EXPIRED — outside grace window → theft detection ─────────────
    if (state === 'ROTATED_EXPIRED') {
      await client.query('ROLLBACK');
      await revokeAllForUser(row.user_id); // must complete before responding
      logAuthEvent({                        // fire-and-forget — must never throw
        user_id: row.user_id,
        action: 'suspected_token_theft',
        ip_address: ipAddress,
        user_agent: userAgent,
        metadata: { token_id: row.id },
      });
      return { ok: false, reason: 'theft_detected' };
    }

    // ── ACTIVE — successful rotation ─────────────────────────────────────────
    if (state === 'ACTIVE') {
      const { id: newId, plaintext } = await insertTokenRow(client, row.user_id, ipAddress, userAgent);
      await client.query(
        'UPDATE refresh_tokens SET rotated_at = NOW(), replaced_by = $1 WHERE id = $2',
        [newId, row.id],
      );
      const accessToken = await buildJwt(client, row.user_id);
      await client.query('COMMIT');

      logAuthEvent({
        user_id: row.user_id,
        action: 'refresh_rotated',
        ip_address: ipAddress,
        user_agent: userAgent,
        metadata: { old_token_id: row.id, new_token_id: newId },
      });

      return { ok: true, accessToken, refreshToken: plaintext };
    }

    // ── ROTATED_IN_GRACE — lock successor (I10: second lock, forward only) ───
    const { rows: succRows } = await client.query(
      'SELECT * FROM refresh_tokens WHERE id = $1 FOR UPDATE',
      [row.replaced_by],
    );

    if (succRows.length === 0) {
      await client.query('ROLLBACK');
      return { ok: false, reason: 'not_found' };
    }

    const succ = succRows[0] as TokenRow;
    const succState = getState(succ);

    if (succState === 'REVOKED') {
      await client.query('ROLLBACK');
      return { ok: false, reason: 'revoked' };
    }

    if (succState === 'EXPIRED') {
      await client.query('ROLLBACK');
      return { ok: false, reason: 'expired' };
    }

    if (succState === 'ROTATED_EXPIRED') {
      // Successor aged out while original was still in grace — anomalous
      await client.query('ROLLBACK');
      await revokeAllForUser(row.user_id);
      logAuthEvent({
        user_id: row.user_id,
        action: 'suspected_token_theft',
        ip_address: ipAddress,
        user_agent: userAgent,
        metadata: { token_id: row.id },
      });
      return { ok: false, reason: 'theft_detected' };
    }

    if (succState === 'ROTATED_IN_GRACE') {
      // Depth > 1 — I9 safety valve; no plaintext available for deeper successor
      await client.query('ROLLBACK');
      console.warn(`[refreshToken] chain depth > 1 for token ${row.id}; possible race or client bug`);
      logAuthEvent({
        user_id: row.user_id,
        action: 'refresh_chain_depth_exceeded',
        ip_address: ipAddress,
        user_agent: userAgent,
        metadata: { token_id: row.id },
      });
      return { ok: false, reason: 'race_collision' };
    }

    // succState === 'ACTIVE' — rotate the successor (already locked, I10 satisfied)
    const { id: newId, plaintext } = await insertTokenRow(client, row.user_id, ipAddress, userAgent);
    await client.query(
      'UPDATE refresh_tokens SET rotated_at = NOW(), replaced_by = $1 WHERE id = $2',
      [newId, succ.id],
    );
    const accessToken = await buildJwt(client, row.user_id);
    await client.query('COMMIT');

    logAuthEvent({
      user_id: row.user_id,
      action: 'refresh_rotated',
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata: { old_token_id: succ.id, new_token_id: newId },
    });

    return { ok: true, accessToken, refreshToken: plaintext };

  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* ignore secondary rollback error */ }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Revokes all non-revoked tokens for a user in one bulk UPDATE (no FOR UPDATE —
 * set-based operation per I10). Used by logout and theft detection.
 * Returns the count of rows revoked.
 */
export async function revokeAllForUser(userId: string): Promise<number> {
  const result = await pool.query(
    `UPDATE refresh_tokens SET revoked_at = NOW()
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId],
  );
  return (result as { rowCount: number | null }).rowCount ?? 0;
}

/** Single-token revocation. Used for admin/cleanup operations. */
export async function revokeToken(tokenId: string): Promise<void> {
  const result = await pool.query(
    'UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1 AND revoked_at IS NULL RETURNING user_id',
    [tokenId],
  );
  if ((result as { rowCount: number | null }).rowCount) {
    logAuthEvent({
      user_id: (result as { rows: { user_id: string }[] }).rows[0].user_id,
      action: 'refresh_revoked',
      metadata: { token_id: tokenId },
    });
  }
}
