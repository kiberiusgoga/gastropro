# Authentication Architecture

## Token lifecycle

| Token | TTL | Storage | Purpose |
|---|---|---|---|
| Access token (JWT) | 15 minutes | Memory (JS variable) | Authorize API calls |
| Refresh token | 7 days | `HttpOnly` cookie | Obtain a fresh access token |
| SSE ticket | 60 seconds, single-use | `sse_tickets` table | Authenticate an EventSource connection |
| Password reset token | 1 hour, single-use | `password_reset_tokens` table | Authorize a password change |

---

## Refresh token rotation

Every `POST /auth/refresh` issues a new access + refresh token pair and immediately marks the old refresh token as `ROTATED_IN_GRACE`. A 30-second grace window allows in-flight requests to reuse the old token once. On a second use outside the window the server treats it as a potential theft: all tokens for that user are revoked and the session is terminated.

**DB table:** `refresh_tokens`  
**Hash:** SHA-256 of the 32-byte random plaintext is stored; the plaintext is never persisted.

---

## SSE ticket pattern

Because `EventSource` cannot set request headers, the server cannot accept a `Bearer` token in the URL (it would appear in server logs). Instead:

1. The client calls `POST /auth/sse-ticket` with a valid access token → receives a 64-char hex plaintext ticket (TTL 60 s).
2. The client opens `GET /api/events?ticket=<plaintext>`.
3. The server hashes the plaintext, looks up the hash in `sse_tickets` with an atomic `UPDATE … SET used_at=NOW() … RETURNING` to prevent replay, then upgrades the connection to SSE.
4. Every 60 seconds the handler re-validates that `users.active = true`. If the account has been deactivated, the server emits `event: forced_logout` and closes the stream; the client calls `authService.logout()` and redirects to `/`.

---

## Password reset flow

```
1. User submits /forgot-password with their email
2. POST /auth/forgot-password (rate-limited, always returns 200)
   └─ Looks up user by email
   └─ If found: generate randomBytes(32).toString('hex') → plaintext token
               store SHA-256(token) in password_reset_tokens (expires 1 h)
               send email with link: FRONTEND_URL/reset-password?token=<plaintext>
   └─ If NOT found: 50 ms delay (timing equalization), no email sent
3. User clicks the link → /reset-password?token=<plaintext>
4. POST /auth/reset-password
   └─ Atomic UPDATE … SET used_at=NOW() WHERE token_hash=SHA-256(token)
             AND used_at IS NULL AND expires_at > NOW() RETURNING user_id
   └─ If no row returned → 400 INVALID_RESET_TOKEN
   └─ If row returned:
        bcrypt.hash(newPassword, 10) → UPDATE users SET password_hash
        UPDATE refresh_tokens SET revoked_at=NOW() WHERE user_id AND revoked_at IS NULL
        Audit log: password_reset_completed
```

**Anti-enumeration:** `POST /auth/forgot-password` always returns `{ message: "If an account with that email exists, a reset link has been sent." }` with HTTP 200, regardless of whether the email exists.

**Session revocation:** All active refresh tokens for the user are revoked on successful reset. The user must log in again on all devices.

**Token security:** The plaintext reset token is returned to the user via email only. Only SHA-256(token) is stored in the database. Audit log entries do not contain the plaintext or hash.

---

## Rate limiting

All limits are per-IP and are applied in `server.ts` before the router — there is no route-level rate limiting in `api.ts`.

| Endpoint | Middleware | Max | Window | skipSuccessfulRequests |
|---|---|---|---|---|
| `POST /auth/login` | `authLimiter` | 5 | 15 min | Yes — only 401/5xx count |
| `POST /auth/reset-password` | `authLimiter` | 5 | 15 min | Yes |
| `POST /auth/forgot-password` | `forgotPasswordLimiter` | 5 | 15 min | No — always 200 (anti-enum) |
| All `/api/*` | `globalLimiter` | 1000 | 15 min | No |

`skipSuccessfulRequests: true` on `authLimiter` means a user who eventually logs in successfully doesn't burn their quota. It is intentionally NOT used on `forgotPasswordLimiter` because that endpoint always returns 200 (anti-enumeration); skipping would make the limit useless.

---

## Audit log — completeness table

All events written to `auth_audit_log`. Metadata is sanitized via `FORBIDDEN_KEYS` in `authAudit.ts` — keys matching `password`, `token`, `hash`, `secret`, etc. are stripped before INSERT.

| Action | Logged? | Location | Notes |
|---|---|---|---|
| `login_success` | ✅ | `api.ts` POST /auth/login | |
| `login_failure` | ✅ | `api.ts` POST /auth/login | `success: false`; metadata includes submitted email |
| `logout` | ✅ | `api.ts` POST /auth/logout | metadata: `{ count }` revoked tokens |
| `password_changed` | ✅ | `api.ts` PUT /auth/change-password | |
| `password_reset_requested` | ✅ | `api.ts` POST /auth/forgot-password | logged for both found and not-found paths |
| `password_reset_completed` | ✅ | `api.ts` POST /auth/reset-password | metadata: `{ all_sessions_revoked: true }` |
| `role_changed` | ✅ | `api.ts` PUT /users/:id, PUT /employees/:id | metadata: `{ from, to, changed_by }` |
| `account_created` | ✅ | `api.ts` POST /users, POST /employees | |
| `account_deactivated` | ✅ | `api.ts` PUT /users/:id, PUT /employees/:id | metadata: `{ deactivated_by }` |
| `refresh_rotated` | ✅ | `refreshTokenService.ts` rotateToken | metadata: `{ old_token_id, new_token_id }` |
| `refresh_revoked` | ✅ | `refreshTokenService.ts` revokeToken | admin single-token revocation only |
| `suspected_token_theft` | ✅ | `refreshTokenService.ts` rotateToken | fired on ROTATED_EXPIRED token reuse |
| `refresh_chain_depth_exceeded` | ✅ | `refreshTokenService.ts` rotateToken | depth > 1 grace chain; rare |
| `sse_ticket_issued` | ✅ | `api.ts` POST /auth/sse-ticket | |
| `sse_connection_opened` | ✅ | `api.ts` GET /events | |
| `sse_forced_logout` | ✅ | `api.ts` GET /events validation interval | |

### Potential log leaks

One intentional dev-mode disclosure: `emailService.ts` prints the full email body to `console.warn` when `SMTP_HOST` is not configured. This body contains the password-reset URL including the plaintext token (`?token=<64-hex>`). This is by design for local development — the token is only visible in server logs, not persisted to the DB, and SMTP_HOST should always be set in production. Mitigation: set `SMTP_HOST` in production; the console fallback path is then unreachable.

No other leaks found: logger calls in `api.ts` log only non-sensitive fields (userId, email, role, IP). The `params` array in `db.ts` error logs contains raw SQL parameters but is only emitted on DB error (which should never reach production logs in normal operation). The `sanitizeMetadata` function in `authAudit.ts` strips all auth-sensitive keys before the DB INSERT.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `JWT_SECRET` | Yes (≥32 chars) | Signs access tokens |
| `JWT_REFRESH_SECRET` | Yes (≥32 chars) | Signs refresh tokens |
| `FRONTEND_URL` | Yes | Base URL for password reset links (e.g. `https://app.gastropro.mk`) |
| `SMTP_HOST` | No | SMTP server hostname; omit to log emails to console |
| `SMTP_PORT` | No | SMTP port (default 587) |
| `SMTP_USER` | No | SMTP username |
| `SMTP_PASS` | No | SMTP password |
| `SMTP_FROM` | No | From address (default `noreply@gastropro.mk`) |

---

## Audit log actions

All authentication events are written to `auth_audit_log`.

| Action | Trigger |
|---|---|
| `login_success` | Successful email/password login |
| `login_failed` | Wrong credentials |
| `logout` | `POST /auth/logout` |
| `refresh_rotated` | Successful token rotation |
| `suspected_token_theft` | Old refresh token reused outside grace window |
| `sse_ticket_issued` | `POST /auth/sse-ticket` |
| `sse_connection_opened` | SSE ticket validated, stream opened |
| `sse_forced_logout` | User deactivated mid-session |
| `password_reset_requested` | `POST /auth/forgot-password` (user found) |
| `password_reset_completed` | `POST /auth/reset-password` success |
