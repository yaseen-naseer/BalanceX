# Application Remediation Plan

## Execution Progress

> Last updated: 2026-04-09

### Phase 1 — Critical (COMPLETED)
- [x] Verified `.env` never committed to git — false positive
- [x] Verified `.gitignore` covers `.env*` files
- [x] Verified `.env.example` has only placeholders
- [x] Scanned full git history — no credentials found
- [x] Rotated local NEXTAUTH_SECRET
- [ ] Rotate production NEXTAUTH_SECRET (manual — SSH required)
- [ ] Rotate production database password (optional — never exposed)

### Phase 2 — High (COMPLETED)
- [x] Issue #2: Added CSRF Origin header validation in `src/proxy.ts`
- [x] Issue #3: Prioritized `cf-connecting-ip` over `x-forwarded-for` in rate limiter
- [x] Issue #4: Reduced auth rate limit from 5 to 3 attempts/minute
- [x] Issue #5: Added `requirePermission(DAILY_ENTRY_VIEW)` to GET endpoints:
  - [x] `GET /api/daily-entries`
  - [x] `GET /api/daily-entries/[date]`
  - [x] `GET /api/daily-entries/[date]/poll`
  - [x] `GET /api/sale-line-items`
  - [x] `GET /api/audit-logs` — already restricted to OWNER (verified)
- [x] Issue #6: Wrapped all `sync-transfer-bank.ts` functions in `withTransaction`
  - [x] `createTransferBankDeposit`
  - [x] `deleteTransferBankDeposit`
  - [x] `updateTransferBankDeposit`
  - [x] Extracted shared `recalculateBalances` helper
- [x] Build verified passing

### Phase 3 — Medium (COMPLETED)
- [x] Issue #7: Added cuid validation in sync-transfer-bank before string matching queries
- [x] Issue #8: Removed WALLET_VIEW from SALES role; wallet nav restricted to OWNER/ACCOUNTANT
- [x] Issue #9: Added monthParamSchema validation to bank and wallet GET endpoints
- [x] Issue #10: Reduced JWT verification window from 300s to 60s

### Phase 4 — Improvements (COMPLETED)
- [x] Added HSTS header (`Strict-Transport-Security: max-age=31536000; includeSubDomains`)
- [x] Stronger password requirements — special character required in setup wizard and user creation
- [x] Critical audit logging — password changes, role changes, user deactivation fail if audit write fails
- [ ] Redis rate limiting — deferred (not needed for single PM2 instance)
- [ ] FK columns for bank transaction links — deferred (future architecture improvement)

---

## 1. Executive Summary

BalanceX is a production financial management system handling daily sales, bank ledger, wallet top-ups, and credit operations. The security audit identified **1 critical**, **5 high**, **5 medium**, and **3 low** severity findings.

**Key Priorities:**

1. **Critical (Immediate):** Database credentials and session secret exposed in git history. Must rotate before any other work.
2. **High (This Week):** Fix authorization gaps on GET endpoints, wrap balance recalculation in atomic transactions, harden rate limiting.
3. **Medium (Next Sprint):** Tighten permission scoping, improve input validation, reduce session verification window.

**Estimated Effort:**

| Phase | Effort | Timeline | Status |
|-------|--------|----------|--------|
| Phase 1 — Critical | 2-4 hours | Today | **COMPLETED** 2026-04-09 |
| Phase 2 — High | 2-3 days | This week | **COMPLETED** 2026-04-09 |
| Phase 3 — Medium | 2-3 days | Next sprint | **COMPLETED** 2026-04-09 |
| Phase 4 — Improvements | Ongoing | As capacity allows | **COMPLETED** 2026-04-09 |

---

## 2. Remediation Strategy

### Grouping Logic

Issues are grouped by **blast radius and exploitability**:

- **Phase 1** contains the only finding that is actively exploitable right now (exposed credentials). Everything else is blocked until secrets are rotated.
- **Phase 2** addresses authorization and data integrity gaps that could be exploited by an authenticated malicious user or concurrent requests.
- **Phase 3** covers defense-in-depth improvements that reduce attack surface but require a lower-risk attacker profile to exploit.
- **Phase 4** is optional hardening that improves robustness for scale and compliance.

### Dependencies

- Phase 1 **must** complete before Phase 2 deploys (new secret invalidates all sessions).
- Phase 2 items are independent of each other and can be parallelized.
- Phase 3 item #10 (session verification window) depends on Phase 2 item #5 (permission checks) being in place first.

---

## 3. Phase-by-Phase Fix Plan

### Phase 1 — Critical Security Fixes (Immediate) — COMPLETED 2026-04-09

#### Issue #1: Exposed Credentials in Git History — FALSE POSITIVE

**Original Risk:** Anyone with read access to the GitHub repository could extract database password and session secret.

**Actual Finding:** `.env` was **never committed** to git. The `.gitignore` file contains `.env*` which has been in place since project creation. Full git history scan confirmed zero credential leaks. The audit incorrectly flagged this because it read the local `.env` file contents during analysis.

**Actions Taken:**
- Verified `.env` never in git history (`git log --all -- .env` returned empty)
- Verified `.gitignore` covers all `.env*` files
- Verified `.env.example` contains only placeholders
- Scanned full git diff history for `NEXTAUTH_SECRET` and `DATABASE_URL` — only placeholder references found
- Rotated local NEXTAUTH_SECRET as a precaution (secret was visible in conversation context)

**Remaining:** Production NEXTAUTH_SECRET rotation recommended (manual SSH task).

**Root Cause:** False positive — `.env` was never committed to git. The audit incorrectly flagged local file contents. `.gitignore` has covered `.env*` since project creation.

**Fix Strategy (precautionary):**

1. **Rotate local NEXTAUTH_SECRET** — as a precaution since it was visible in conversation context.
2. **Rotate production credentials** — recommended best practice (manual SSH task).

**Step-by-step:**

**Step 1: Rotate on production server**

```bash
ssh balancex@your-server
cd ~/BalanceX

# Generate new NEXTAUTH_SECRET
openssl rand -hex 32
# Output: <new-secret>

# Change database password in PostgreSQL
sudo -u postgres psql -c "ALTER USER balancex_user WITH PASSWORD 'new-strong-password-here';"

# Update .env on server
nano .env
# Set new DATABASE_URL with new password (URL-encode special chars)
# Set new NEXTAUTH_SECRET

# Restart
pm2 restart balancex
```

**Step 2: Rotate on local development**

```bash
# Update local PostgreSQL password
psql -U postgres -c "ALTER USER postgres WITH PASSWORD 'new-local-password';"

# Update local .env
# DATABASE_URL with new password
# NEXTAUTH_SECRET with new value (can differ from production)
```

**Step 3: Clean git history**

```bash
# Install BFG Repo-Cleaner (faster than filter-branch)
# https://rtyley.github.io/bfg-repo-cleaner/

# Clone a bare copy
git clone --mirror https://github.com/yaseen-naseer/BalanceX.git balancex-mirror.git
cd balancex-mirror.git

# Remove .env from all history
bfg --delete-files .env

# Clean up
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push
git push --force
```

**Step 4: Verify `.env` is in `.gitignore`**

```bash
grep "^\.env$" .gitignore
# Should output: .env
```

**Files Affected:** `.env`, `.gitignore`, git history

**Validation:**
- `git log --all --full-history -- .env` returns empty after cleanup
- Application starts successfully with new credentials
- Old credentials no longer work: `psql -U balancex_user -W` with old password fails
- All users are logged out (expected — new NEXTAUTH_SECRET invalidates all JWTs)

---

### Phase 2 — High Priority Fixes — COMPLETED 2026-04-09

#### Issue #2: Missing CSRF Protection — FIXED

**Risk:** An attacker could craft a malicious page that submits forms to BalanceX while the user is logged in, performing actions like creating transactions or changing settings without the user's knowledge.

**Root Cause:** NextAuth.js provides `sameSite: lax` on session cookies, which blocks cross-origin POST requests from third-party sites. However, GET-based state changes and same-site attacks are not covered.

**Fix Strategy:** The current `sameSite: lax` configuration provides adequate protection for this application's threat model (internal financial tool behind Cloudflare Tunnel, not publicly accessible). Document this as an accepted risk with the following mitigations already in place:

- All state-changing operations use POST/PUT/PATCH/DELETE (not GET)
- Session cookies have `httpOnly: true` and `sameSite: lax`
- Application is behind Cloudflare Tunnel (not exposed to public internet)
- Content-Security-Policy restricts script sources

**If stricter protection is needed later:**

```typescript
// src/proxy.ts — add Origin header validation
const origin = request.headers.get("origin")
const allowedOrigins = [process.env.NEXTAUTH_URL]
if (request.method !== "GET" && origin && !allowedOrigins.includes(origin)) {
  return new NextResponse("Forbidden", { status: 403 })
}
```

**Files Affected:** `src/proxy.ts`

**Validation:** Test that cross-origin POST requests are rejected while same-origin requests work.

---

#### Issue #3: IP Address Spoofing in Rate Limiter — FIXED

**Risk:** Attackers can bypass rate limiting by spoofing the `x-forwarded-for` header, enabling brute-force attacks on the login endpoint.

**Root Cause:** The IP extraction function trusts `x-forwarded-for` unconditionally. In the current deployment (Cloudflare Tunnel), Cloudflare sets `cf-connecting-ip` which is more reliable.

**Fix Strategy:** Use Cloudflare's `cf-connecting-ip` header in production, fall back to `x-forwarded-for` only in development.

**Code Change:**

```typescript
// src/proxy.ts — update getClientIp function
function getClientIp(request: NextRequest): string {
  // Cloudflare Tunnel sets this — cannot be spoofed by the client
  const cfIp = request.headers.get("cf-connecting-ip")
  if (cfIp) return cfIp

  // Development fallback
  const forwardedFor = request.headers.get("x-forwarded-for")
  if (forwardedFor) return forwardedFor.split(",")[0].trim()

  return "unknown"
}
```

**Files Affected:** `src/proxy.ts`, `src/lib/rate-limit.ts`

**Validation:**
- Deploy and check PM2 logs for correct IP addresses in rate limit entries
- Attempt to send requests with spoofed `x-forwarded-for` — should use `cf-connecting-ip` instead

---

#### Issue #4: Weak Rate Limiting Configuration — FIXED

**Risk:** In-memory rate limiting resets on PM2 restart. Auth endpoint allows 5 attempts/minute which may be too generous for a financial app.

**Root Cause:** Rate limiter uses a JavaScript `Map` that lives in process memory. PM2 restart or crash clears all rate limit state.

**Fix Strategy (Short-term):** Reduce auth limit to 3/minute. Acceptable for single-instance PM2 deployment.

**Fix Strategy (Long-term):** Migrate to Redis-backed rate limiting when scaling to multiple instances.

**Code Change:**

```typescript
// src/proxy.ts — tighten auth rate limit
const authLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 3,  // was 5
})
```

**Files Affected:** `src/proxy.ts`

**Validation:** Attempt 4 rapid login requests — 4th should be rejected with 429.

---

#### Issue #5: Missing Permission Checks on GET Endpoints — FIXED

**Risk:** A SALES user could access the full daily entries list, wallet data, or other OWNER/ACCOUNTANT-restricted information by calling GET endpoints directly.

**Root Cause:** Several GET endpoints use `getAuthenticatedUser()` (checks auth only) instead of `requirePermission()` (checks auth + role).

**Fix Strategy:** Audit every GET endpoint and add appropriate permission checks. For endpoints that serve different data by role, add role-based filtering.

**Code Changes:**

```typescript
// src/app/api/daily-entries/route.ts — add permission check
export async function GET(request: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.DAILY_ENTRY_VIEW)
  if (auth.error) return auth.error
  // ...
}
```

**Endpoints to audit and fix:**

| Endpoint | Current Auth | Required |
|----------|-------------|----------|
| `GET /api/daily-entries` | `getAuthenticatedUser` | `requirePermission(DAILY_ENTRY_VIEW)` |
| `GET /api/daily-entries/[date]` | `getAuthenticatedUser` | `requirePermission(DAILY_ENTRY_VIEW)` |
| `GET /api/daily-entries/[date]/poll` | `getAuthenticatedUser` | `requirePermission(DAILY_ENTRY_VIEW)` |
| `GET /api/sale-line-items` | `getAuthenticatedUser` | `requirePermission(DAILY_ENTRY_VIEW)` |
| `GET /api/audit-logs` | `getAuthenticatedUser` | `requireRole(OWNER)` |
| `GET /api/system-date` | `getAuthenticatedUser` | OK (non-sensitive) |

**Files Affected:** `src/app/api/daily-entries/route.ts`, `src/app/api/daily-entries/[date]/route.ts`, `src/app/api/daily-entries/[date]/poll/route.ts`, `src/app/api/sale-line-items/route.ts`, `src/app/api/audit-logs/route.ts`

**Validation:**
- Log in as SALES user
- Attempt to access each endpoint via browser DevTools or curl
- Verify appropriate 403 responses where restricted

---

#### Issue #6: Race Condition in sync-transfer-bank.ts — FIXED

**Risk:** If two transfer sales are added/deleted simultaneously, the balance recalculation in `deleteTransferBankDeposit` and `updateTransferBankDeposit` can produce incorrect running balances because the operations are not atomic.

**Root Cause:** `deleteTransferBankDeposit` and `updateTransferBankDeposit` perform multiple sequential database operations (find, delete/update, then loop-update all balances) without wrapping them in a transaction.

**Fix Strategy:** Wrap each function in `withTransaction()` using the existing atomic utility.

**Code Change:**

```typescript
// src/lib/utils/sync-transfer-bank.ts

import { withTransaction } from "./atomic"

export async function deleteTransferBankDeposit(lineItemId: string): Promise<void> {
  await withTransaction(async (tx) => {
    const bankTx = await tx.bankTransaction.findFirst({
      where: {
        reference: TRANSFER_SALE_REFERENCE,
        notes: { contains: `item: ${lineItemId}` },
      },
    })

    if (!bankTx) return

    await tx.bankTransaction.delete({ where: { id: bankTx.id } })

    // Recalculate all balances atomically
    const settings = await tx.bankSettings.findFirst({
      orderBy: { openingDate: "desc" },
    })
    const allTransactions = await tx.bankTransaction.findMany({
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    })
    let runningBalance = settings ? Number(settings.openingBalance) : 0
    for (const t of allTransactions) {
      runningBalance += t.type === "DEPOSIT" ? Number(t.amount) : -Number(t.amount)
      if (Number(t.balanceAfter) !== runningBalance) {
        await tx.bankTransaction.update({
          where: { id: t.id },
          data: { balanceAfter: runningBalance },
        })
      }
    }
  })
}

// Apply same pattern to updateTransferBankDeposit and createTransferBankDeposit
```

**Files Affected:** `src/lib/utils/sync-transfer-bank.ts`

**Validation:**
- Add two transfer sales rapidly in succession
- Delete both rapidly
- Verify bank balance is correct after both operations

---

### Phase 3 — Medium Priority Fixes — COMPLETED 2026-04-09

#### Issue #7: String Interpolation in Notes for Bank Transaction Matching — FIXED

**Risk:** If a `lineItemId` contained special characters (unlikely with cuid but possible), the `notes: { contains: ... }` query could match unintended records.

**Root Cause:** Bank transaction lookup relies on string matching within the `notes` field rather than a proper foreign key relationship.

**Fix Strategy (Short-term):** Validate that lineItemId is a valid cuid before using it in the query. This is sufficient because Prisma generates cuids that contain only alphanumeric characters.

**Fix Strategy (Long-term):** Add a `saleLineItemId` nullable foreign key column to `BankTransaction` for direct lookup instead of string matching.

**Code Change (Short-term):**

```typescript
// src/lib/utils/sync-transfer-bank.ts
import { z } from "zod"

const cuidSchema = z.string().cuid()

export async function deleteTransferBankDeposit(lineItemId: string): Promise<void> {
  // Validate lineItemId format before using in string match
  const parsed = cuidSchema.safeParse(lineItemId)
  if (!parsed.success) return

  // ... existing logic
}
```

**Files Affected:** `src/lib/utils/sync-transfer-bank.ts`

**Validation:** Attempt to pass a crafted lineItemId containing SQL/Prisma operators — should be rejected.

---

#### Issue #8: SALES Users Can View Full Wallet Data — FIXED

**Risk:** SALES users can see wallet opening balance, all top-up history, and financial management data that should be restricted to OWNER/ACCOUNTANT.

**Root Cause:** The `WALLET_VIEW` permission is granted to all roles in `src/lib/permissions.ts`.

**Fix Strategy:** Create a separate `WALLET_VIEW_BALANCE` permission for SALES (current balance only) and restrict `WALLET_VIEW` to OWNER/ACCOUNTANT.

**Code Change:**

```typescript
// src/lib/permissions.ts
export const PERMISSIONS = {
  // ... existing
  WALLET_VIEW: "WALLET_VIEW",           // Full wallet data (OWNER, ACCOUNTANT)
  WALLET_VIEW_BALANCE: "WALLET_BALANCE", // Current balance only (all roles)
}

// Update role-permission mapping
SALES: [
  // Remove WALLET_VIEW, add WALLET_VIEW_BALANCE
  PERMISSIONS.WALLET_VIEW_BALANCE,
  // ...
]
```

```typescript
// src/app/api/wallet/route.ts — filter response for SALES
if (auth.user!.role === "SALES") {
  return NextResponse.json({
    success: true,
    data: {
      currentBalance,
      // Omit: openingBalance, topups, settings, todayActivity details
    },
  })
}
```

**Files Affected:** `src/lib/permissions.ts`, `src/app/api/wallet/route.ts`

**Validation:** Log in as SALES user, navigate to wallet page — should see balance only, not top-up history or opening balance.

---

#### Issue #9: Inadequate URL Date Parameter Validation — FIXED

**Risk:** Malformed date parameters could cause unexpected behavior or errors in bank and wallet queries.

**Root Cause:** Month parameter is split and parsed without format validation or bounds checking.

**Fix Strategy:** Add a reusable date parameter validator.

**Code Change:**

```typescript
// src/lib/validations/schemas.ts — add month validator
export const monthParamSchema = z.string().regex(
  /^\d{4}-(0[1-9]|1[0-2])$/,
  "Invalid month format. Expected YYYY-MM"
)

// src/app/api/bank/route.ts
if (month) {
  const validated = monthParamSchema.safeParse(month)
  if (!validated.success) {
    return NextResponse.json(
      { success: false, error: "Invalid month format" },
      { status: 400 }
    )
  }
  const [year, monthNum] = month.split("-").map(Number)
  // ... existing logic
}
```

**Files Affected:** `src/lib/validations/schemas.ts`, `src/app/api/bank/route.ts`, `src/app/api/wallet/route.ts`

**Validation:** Send request with `?month=invalid` — should return 400. Send `?month=2026-13` — should return 400.

---

#### Issue #10: 5-Minute Session Verification Window — FIXED

**Risk:** A deactivated user retains access for up to 5 minutes after their account is disabled.

**Root Cause:** JWT callback only checks user existence every 300 seconds to avoid hitting the database on every request.

**Fix Strategy:** Reduce to 60 seconds. The database query is lightweight (indexed primary key lookup) and the application has low concurrent users.

**Code Change:**

```typescript
// src/lib/auth.ts — reduce verification interval
const now = Math.floor(Date.now() / 1000)
const lastVerified = (token.lastVerified as number) || 0
if (now - lastVerified > 60) {  // was 300
  // ... existing verification logic
}
```

**Files Affected:** `src/lib/auth.ts`

**Validation:**
- Create test user, log in
- Deactivate user from settings
- Verify access is revoked within ~1 minute (not 5)

---

## 4. Refactoring & Improvements (Phase 4) — COMPLETED 2026-04-09

### Redis-Backed Rate Limiting

Replace in-memory rate limiter with `@upstash/ratelimit` or `ioredis` for persistence across restarts and multi-instance deployments. Only needed if scaling beyond single PM2 instance.

### Structured Foreign Keys for Bank Transaction Links

Replace string-matching in `sync-transfer-bank.ts` notes field with proper nullable foreign keys (`saleLineItemId`, `walletTopupId`) on the `BankTransaction` model. This eliminates the string interpolation concern entirely and improves query performance.

### Password Complexity Scoring

Integrate `zxcvbn` library for password strength estimation instead of regex-based rules. Catches dictionary words, common patterns, and keyboard walks that regex misses.

### HSTS Header

Add `Strict-Transport-Security` header in `next.config.ts` for HTTPS enforcement:

```typescript
{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }
```

### Audit Log Failure Handling

For sensitive operations (password changes, role changes, user deactivation), make the operation fail if the audit log write fails. For non-critical operations, keep the current fire-and-forget pattern.

---

## 5. Security Hardening Checklist

### Phase 1 — Critical
- [x] Rotated NEXTAUTH_SECRET on local development
- [x] Verified `.env` is in `.gitignore`
- [x] Verified `.env` never committed to git history
- [ ] Rotate production NEXTAUTH_SECRET (manual — SSH required)
- [ ] Rotate production database password (optional — never exposed)

### Phase 2 — High (COMPLETED)
- [x] Added CSRF origin validation in `src/proxy.ts`
- [x] Updated IP extraction to prioritize `cf-connecting-ip`
- [x] Reduced auth rate limit to 3/minute
- [x] Added `requirePermission(DAILY_ENTRY_VIEW)` to GET `/api/daily-entries`
- [x] Added `requirePermission(DAILY_ENTRY_VIEW)` to GET `/api/daily-entries/[date]`
- [x] Added `requirePermission(DAILY_ENTRY_VIEW)` to GET `/api/daily-entries/[date]/poll`
- [x] Added `requirePermission(DAILY_ENTRY_VIEW)` to GET `/api/sale-line-items`
- [x] Verified GET `/api/audit-logs` already restricted to OWNER
- [x] Wrapped `deleteTransferBankDeposit` in `withTransaction`
- [x] Wrapped `updateTransferBankDeposit` in `withTransaction`
- [x] Wrapped `createTransferBankDeposit` in `withTransaction`

### Phase 3 — Medium (COMPLETED)
- [x] Added cuid validation before string matching in sync-transfer-bank
- [x] Removed WALLET_VIEW from SALES role
- [x] Restricted wallet nav to OWNER/ACCOUNTANT
- [x] Added month parameter validation to bank API
- [x] Added month parameter validation to wallet API
- [x] Reduced JWT verification window to 60 seconds

### Phase 4 — Improvements (COMPLETED)
- [x] Added HSTS header (`Strict-Transport-Security: max-age=31536000; includeSubDomains`)
- [x] Stronger password requirements — special character required in setup wizard and user creation
- [x] Critical audit logging — password changes, role changes, user deactivation fail if audit write fails
- [ ] Redis rate limiting — deferred (not needed for single PM2 instance)
- [ ] FK columns for bank transaction links — deferred (future architecture improvement)

---

## 6. Testing Strategy

### Unit Tests

| Test | Target | What to Verify |
|------|--------|---------------|
| Rate limiter | `src/lib/rate-limit.ts` | Requests blocked after limit; counter resets after window |
| Permission checks | `src/lib/permissions.ts` | Each role has correct permissions; no escalation possible |
| Variance rounding | `src/hooks/use-daily-entry-calculations.ts` | Floating-point values round to 2 decimal places |
| Decimal validation | `src/lib/validations/schemas.ts` | Accepts 8919.13, rejects 8919.123 |
| Month param validation | `src/lib/validations/schemas.ts` | Accepts 2026-04, rejects 2026-13, rejects "invalid" |

### Integration Tests

| Test | Target | What to Verify |
|------|--------|---------------|
| Auth flow | Login → Session → Logout | JWT created, validated, destroyed correctly |
| RBAC enforcement | All API routes | SALES cannot access OWNER endpoints; 403 returned |
| Bank transaction atomicity | POST + DELETE concurrent | Running balance correct after concurrent operations |
| Transfer sale → bank deposit | Add/edit/delete line item | Bank deposit created/updated/deleted correctly |
| Split payment | Add top-up with 3 splits | 3 records created; bank withdrawals only for non-cash |

### Security Tests

| Test | What to Verify |
|------|---------------|
| Brute force login | Account locks after 5 attempts; rate limiter blocks after 3/min |
| Session hijacking | Old NEXTAUTH_SECRET tokens rejected after rotation |
| IDOR (Insecure Direct Object Reference) | User A cannot access User B's data by guessing IDs |
| Path traversal | Screenshot upload rejects `../` in filenames |
| XSS | User input in notes, references, names is escaped in UI |

### Edge Cases

- Submit daily entry with variance of exactly 0.000000001 (should round to 0, show "Balanced")
- Add transfer sale while another user deletes the same entry
- Split payment where one split fails mid-way (verify partial state is handled)
- Deactivate user while they have unsaved changes (idle timeout should auto-save then redirect)

---

## 7. Deployment Plan

### Order of Deployment

1. **Phase 1 (credentials):** Deploy on production server directly via SSH. No code deployment needed — only `.env` changes and PM2 restart.
2. **Phase 2 (code fixes):** Single deployment after all Phase 2 changes are committed and tested locally.
3. **Phase 3 (code fixes):** Separate deployment after Phase 2 is verified in production.

### Deployment Steps (Phase 2+)

```bash
# On production server
cd ~/BalanceX
git pull origin main
npm install
npx prisma generate
npx prisma db push    # Only if schema changes
npm run build
pm2 restart balancex
```

### Downtime Risks

| Phase | Downtime | Reason |
|-------|----------|--------|
| Phase 1 | ~30 seconds | PM2 restart after secret rotation; all users logged out |
| Phase 2 | ~60 seconds | Standard build + restart |
| Phase 3 | ~60 seconds | Standard build + restart |

### Rollback Strategy

```bash
# If deployment fails, revert to previous commit
git log --oneline -5   # Find the previous good commit
git reset --hard <commit-hash>
npm run build
pm2 restart balancex
```

For Phase 1 (credential rotation), rollback means restoring the old `.env` values — but this should only be done if the new credentials are broken, not as a security rollback.

---

## 8. Future Recommendations

### Architecture

- **Database connection pooling:** Use PgBouncer or Prisma Accelerate for connection management as transaction volume grows.
- **Read replicas:** If reporting queries become slow, separate read traffic from write traffic.
- **Background jobs:** Move audit logging, bank balance recalculation, and email notifications to a job queue (Bull/BullMQ) to avoid blocking API responses.

### Scaling

- **Multi-instance PM2:** When scaling to multiple PM2 instances, migrate rate limiting to Redis and add session store (currently JWT so no shared state needed).
- **CDN for static assets:** Cloudflare already provides this via the tunnel; ensure cache headers are set.
- **Database indexes:** Monitor slow queries with `prisma.$queryRaw` logging and add indexes as needed.

### Security

- **Dependency auditing:** Run `npm audit` weekly; integrate into CI/CD pipeline.
- **Penetration testing:** Schedule annual pentest once the application handles significant financial volume.
- **Backup encryption:** Ensure database backups are encrypted at rest.
- **Access logging:** Forward audit logs to external SIEM for tamper-proof retention.
- **Two-factor authentication:** Consider TOTP-based 2FA for OWNER accounts as the business grows.
