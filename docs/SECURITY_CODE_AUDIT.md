# BalanceX Security & Code Audit Report

**Date:** February 28, 2026  
**Project:** BalanceX - Retail Finance Manager  
**Audit Type:** Security & Code Quality

---

## Executive Summary

This report documents the findings from a comprehensive security and code quality audit of the BalanceX application. The audit identified **8 critical issues**, **9 high priority issues**, **5 medium priority issues**, and **3 low priority issues**.

---

## 🔴 Critical Issues

### 1. No Server-Side Input Validation

**Severity:** Critical  
**Location:** All API routes

**Description:**  
The DTOs are defined as TypeScript interfaces with no runtime validation. Zod schemas exist in `src/lib/validations/` but are NOT used in API routes, meaning invalid or malicious data can pass through unchecked.

**Current Code:**
```typescript
// src/app/api/daily-entries/route.ts:77
const body: CreateDailyEntryDto = await request.json()
```

**Recommended Fix:**  
Implement Zod validation on all API routes:
```typescript
import { createDailyEntrySchema } from "@/lib/validations/daily-entry"
const body = createDailyEntrySchema.parse(await request.json())
```

---

### 2. File Upload - Filename Not Sanitized

**Severity:** Critical  
**Location:** `src/app/api/screenshots/route.ts:86-89`

**Description:**  
The file extension is extracted directly from the uploaded filename without sanitization:

```typescript
const ext = file.name.split(".").pop()
const filename = `${date}-${Date.now()}.${ext}`
```

**Risk:** If file type validation is bypassed, malicious files could be uploaded.

**Recommended Fix:**  
Whitelist allowed extensions explicitly:
```typescript
const allowedExtensions = ['jpg', 'jpeg', 'png']
const ext = file.name.split('.').pop()?.toLowerCase()
if (!ext || !allowedExtensions.includes(ext)) {
  return NextResponse.json({ error: "Invalid file type" }, { status: 400 })
}
```

---

### 3. Missing Rate Limiting

**Severity:** Critical  
**Location:** All API routes, especially `src/app/api/auth/[...nextauth]/route.ts`

**Description:**  
No rate limiting is implemented on:
- Login attempts (brute force vulnerability)
- API endpoints (DoS vulnerability)

**Recommended Fix:**  
Implement rate limiting using a library like `rate-limiter-flexible`:

```typescript
// Example for Next.js API routes
import { rateLimit } from "@/lib/rate-limit"

export async function POST(request: NextRequest) {
  const { success } = await rateLimit.limit(request.ip || 'unknown')
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }
  // ... handler logic
}
```

---

### 4. No Server-Side Date Validation

**Severity:** Critical  
**Location:** Multiple API routes

**Description:**  
Date parameters are parsed directly without validation:

```typescript
// src/app/api/daily-entries/route.ts:24
where.date = { equals: new Date(date) }
```

**Risk:** Invalid date strings can cause server errors or unexpected query results.

**Recommended Fix:**  
Create and use a date validation helper:
```typescript
function parseDate(dateStr: string): Date | null {
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return null
  return date
}
```

---

### 5. Missing Account Lockout

**Severity:** Critical  
**Location:** `src/lib/auth.ts`

**Description:**  
No failed login attempt tracking or account lockout exists, making the application vulnerable to brute force attacks:

```typescript
// src/lib/auth.ts:58
const isPasswordValid = await compare(credentials.password, user.passwordHash)
if (!isPasswordValid) return null
```

**Recommended Fix:**  
Implement failed attempt tracking:
```typescript
const MAX_ATTEMPTS = 5
const LOCKOUT_DURATION = 15 * 60 * 1000 // 15 minutes

// Track failed attempts in Redis or database
// Lock account after MAX_ATTEMPTS for LOCKOUT_DURATION
```

---

### 6. Inconsistent Authorization Checks

**Severity:** Critical  
**Location:** `src/app/api/credit-sales/route.ts`

**Description:**  
The credit-sales endpoint uses `getAuthenticatedUser()` which only checks authentication, not authorization/permissions:

```typescript
// src/app/api/credit-sales/route.ts:7
const auth = await getAuthenticatedUser()
```

Other endpoints properly use `requirePermission()` which enforces role-based access control.

**Recommended Fix:**  
Add permission checks to all sensitive endpoints:
```typescript
const auth = await requirePermission(PERMISSIONS.CREDIT_SALE_CREATE)
if (auth.error) return auth.error
```

---

### 7. Missing Password Strength Requirements

**Severity:** Critical  
**Location:** `src/app/api/users/route.ts:83`

**Description:**  
No validation of password strength when creating users:

```typescript
const passwordHash = await bcrypt.hash(password, 10)
```

**Recommended Fix:**  
Add password policy validation:
```typescript
const MIN_PASSWORD_LENGTH = 8

if (password.length < MIN_PASSWORD_LENGTH) {
  return NextResponse.json(
    { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
    { status: 400 }
  )
}
```

---

### 8. Bank Transaction Deletion - No Balance Recalculation

**Severity:** Critical  
**Location:** `src/app/api/bank/route.ts:258-260`

**Description:**  
Deleting a bank transaction doesn't recalculate the `balanceAfter` values for subsequent transactions:

```typescript
await prisma.bankTransaction.delete({ where: { id } })
```

**Risk:** All subsequent transactions will have incorrect balanceAfter values.

**Recommended Fix:**  
Recalculate balances after deletion:
```typescript
// Get all transactions after the deleted one
const subsequentTransactions = await prisma.bankTransaction.findMany({
  where: { date: { gt: deletedTransaction.date } },
  orderBy: { date: 'asc' }
})

// Recalculate and update each
let runningBalance = deletedTransaction.balanceBefore
for (const tx of subsequentTransactions) {
  runningBalance += tx.type === 'DEPOSIT' ? tx.amount : -tx.amount
  await prisma.bankTransaction.update({
    where: { id: tx.id },
    data: { balanceAfter: runningBalance }
  })
}
```

---

## 🟠 High Priority Issues

### 9. N+1 Query Problem - Credit Customers

**Location:** `src/app/api/credit-customers/route.ts:46-70`

**Description:**  
The endpoint fetches transactions separately for each customer, causing N+1 queries:

```typescript
const customersWithBalance = await Promise.all(
  customers.map(async (customer) => {
    const transactions = await prisma.creditTransaction.findMany({...})
    // ... calculates balance
  })
)
```

With 100 customers, this results in 101 database queries.

**Recommended Fix:**  
Use Prisma aggregation or batch query:
```typescript
const customers = await prisma.creditCustomer.findMany({
  include: {
    creditTransactions: {
      select: { amount: true, type: true }
    }
  }
})
```

---

### 10. Wallet Deletion - No Bank Reversal

**Location:** `src/app/api/wallet/route.ts:382-384`

**Description:**  
Deleting a wallet top-up that was funded from BANK doesn't reverse the automatic bank withdrawal.

**Recommended Fix:**  
Check source and reverse bank transaction:
```typescript
const topup = await prisma.walletTopup.findUnique({ where: { id } })
if (topup?.source === 'BANK') {
  // Find and delete the associated bank withdrawal
  await prisma.bankTransaction.deleteMany({
    where: { notes: `Auto-created from wallet top-up`, createdAt: topup.createdAt }
  })
}
await prisma.walletTopup.delete({ where: { id } })
```

---

### 11. Credit Sale Deletion - Orphaned Transactions

**Location:** `src/app/api/credit-sales/route.ts:268-269`

**Description:**  
Deleting a credit sale doesn't remove the corresponding credit transaction, leaving orphaned transactions that cause balance discrepancies.

**Recommended Fix:**  
Delete both records atomically:
```typescript
await prisma.$transaction([
  prisma.creditTransaction.deleteMany({
    where: { reference: creditSale.id, type: 'CREDIT_SALE' }
  }),
  prisma.creditSale.delete({ where: { id } })
])
```

---

### 12. Missing Security Headers

**Location:** No `next.config.ts` security headers

**Description:**  
No security headers are configured:
- Content-Security-Policy
- X-Frame-Options
- X-Content-Type-Options

**Recommended Fix:**  
Add headers to `next.config.ts`:
```typescript
async headers() {
  return [
    {
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-XSS-Protection', value: '1; mode=block' },
      ],
    },
  ]
}
```

---

### 13. Missing CSRF Protection

**Location:** All API routes

**Description:**  
No CSRF tokens are implemented for state-changing operations.

**Recommended Fix:**  
Next.js has built-in CSRF protection for mutations when using proper session handling. Ensure all mutations use POST/PUT/DELETE methods, not GET.

---

### 14. Decimal Precision Loss

**Location:** Multiple locations converting Prisma Decimal to Number

**Description:**  
Converting `Decimal` to JavaScript `Number` can cause precision issues with large financial amounts.

**Recommended Fix:**  
Keep values as Decimal when possible, or use a library like `decimal.js` for calculations.

---

### 15. No Audit Trail for Credit Limit Overrides

**Location:** `src/app/api/credit-sales/route.ts`

**Description:**  
While the code adds a note when an Owner overrides a credit limit, there's no separate audit log table tracking these sensitive actions.

**Recommended Fix:**  
Create an audit log:
```typescript
await prisma.auditLog.create({
  data: {
    action: 'CREDIT_LIMIT_OVERRIDE',
    userId: auth.user!.id,
    details: { customerId, amount, reason },
    timestamp: new Date()
  }
})
```

---

### 16. Sensitive Data in Logs

**Location:** Multiple locations

**Description:**  
Error logging may expose sensitive data like user credentials or financial amounts.

**Recommended Fix:**  
Sanitize logs:
```typescript
console.error("Error:", {
  message: error.message,
  code: error.code
  // Don't log: user passwords, amounts, PII
})
```

---

### 17. No Request Body Size Limits

**Location:** Form submissions

**Description:**  
No explicit limits on request body size, potential DoS via large payloads.

**Recommended Fix:**  
Add size limits to form parsing:
```typescript
// In Next.js API routes
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
}
```

---

## 🟡 Medium Priority Issues

### 18. Inconsistent Error Response Format

**Description:**  
Some endpoints return `{ error: string }`, others return `{ success: false, error: string }`.

**Recommended Fix:**  
Standardize all responses:
```typescript
function errorResponse(message: string, status = 500) {
  return NextResponse.json({ success: false, error: message }, { status })
}
```

---

### 19. No Input Sanitization for Search Fields

**Location:** `src/app/api/credit-customers/route.ts:33-38`

**Description:**  
Search parameters aren't sanitized, though Prisma's parameterized queries prevent SQL injection.

**Recommended Fix:**  
Trim and limit search input length:
```typescript
const search = searchParams.get("search")?.slice(0, 100).trim()
```

---

### 20. Hardcoded Variance Thresholds

**Location:** `src/lib/validations/daily-entry.ts:118, 144`

**Description:**  
Variance thresholds (500 MVR) are hardcoded in validation logic.

**Recommended Fix:**  
Move to configuration or database settings table.

---

### 21. No Pagination on Credit Customer List

**Location:** `src/app/api/credit-customers/route.ts:40-43`

**Description:**  
All customers are fetched at once without pagination.

**Recommended Fix:**  
Add pagination parameters:
```typescript
const limit = parseInt(searchParams.get("limit") || "50")
const offset = parseInt(searchParams.get("offset") || "0")

const customers = await prisma.creditCustomer.findMany({
  // ... where
  take: limit,
  skip: offset
})
```

---

### 22. Unused Code - Old Middleware System

**Location:** `src/lib/api/middleware.ts`

**Description:**  
A custom middleware system exists but isn't being used by API routes (they use `requirePermission` directly).

---

## 🟢 Low Priority Issues

### 23. Missing TypeScript Strict Mode

**Description:**  
Check `tsconfig.json` for strict mode settings.

---

### 24. Duplicate Code - Balance Calculation

**Description:**  
Balance calculation logic is duplicated across multiple files.

**Recommended Fix:**  
Extract to shared utility functions.

---

### 25. No Environment Validation

**Description:**  
Application doesn't validate required environment variables on startup.

**Recommended Fix:**  
Add startup validation:
```typescript
const required = ['DATABASE_URL', 'NEXTAUTH_SECRET']
const missing = required.filter(key => !process.env[key])
if (missing.length) {
  throw new Error(`Missing env vars: ${missing.join(', ')}`)
}
```

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 8 |
| High | 9 |
| Medium | 5 |
| Low | 3 |

### Top 5 Recommendations

1. **Add Zod validation** to all API routes (Critical #1)
2. **Implement rate limiting** on auth and API routes (Critical #3)
3. **Add account lockout** after failed login attempts (Critical #5)
4. **Fix bank transaction deletion** to recalculate balances (Critical #8)
5. **Fix N+1 queries** in credit customers endpoint (High #9)

---

## Audit Performed

- Authentication & Authorization review
- API route security analysis
- Input validation assessment
- Database query optimization review
- File upload security check
- Error handling review
- Configuration security review
