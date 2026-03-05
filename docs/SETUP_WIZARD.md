# BalanceX — Setup Wizard

## Overview

The setup wizard is a one-time onboarding flow that runs when the system is first installed and the database is empty. It creates the initial Owner account and configures opening balances for both the bank ledger and wallet before anyone can use the application.

Once completed, the setup page is permanently inaccessible.

---

## Guard Condition

```
/setup is accessible  ⟺  prisma.user.count() === 0
```

The presence of at least one user record means setup is complete. Since the wizard creates the owner account, bank settings, and wallet settings atomically in a single transaction, if the user exists then all settings exist too.

| State | `/setup` | `/login` | `/(dashboard)` |
|---|---|---|---|
| No users in DB | Accessible | Redirects to `/setup` | Redirects to `/setup` |
| Users exist | Redirects to `/` | Normal | Normal |

---

## Wizard Steps

### Step 1 — Owner Account

| Field | Type | Rules |
|---|---|---|
| Full Name | text | Required |
| Username | text | Required, 3–30 chars, alphanumeric + underscore only |
| Password | password | Min 8 chars, must contain uppercase, lowercase, number |
| Confirm Password | password | Must match password |

### Step 2 — Bank Opening Balance

| Field | Type | Rules |
|---|---|---|
| Opening Balance | number | Non-negative, defaults to 0 |
| As of Date | date | Defaults to today |

This sets the starting point for the bank ledger. All future bank transactions are calculated relative to this balance.

### Step 3 — Wallet Opening Balance

| Field | Type | Rules |
|---|---|---|
| Opening Balance | number | Non-negative, defaults to 0 |
| As of Date | date | Defaults to today |

This sets the starting point for the telco wallet. All future wallet top-ups and reload sales are calculated relative to this balance.

---

## Completion

When the user submits Step 3, a single `POST /api/setup` call:

1. Verifies no users exist (guard check on the server)
2. Creates the Owner `User` record (bcrypt-hashed password)
3. Creates `BankSettings` (opening balance + date)
4. Creates `WalletSettings` (opening balance + date)
5. Writes a `USER_CREATED` audit log entry
6. Returns success

The client then calls `signIn()` automatically to log the owner in and redirects to the dashboard.

---

## API

### `GET /api/setup`
Returns whether setup is required. Public (no auth needed).

**Response**
```json
{ "needsSetup": true }
```

### `POST /api/setup`
Completes the setup. Returns `403` if users already exist.

**Request body**
```json
{
  "owner": {
    "name": "string",
    "username": "string",
    "password": "string"
  },
  "bank": {
    "openingBalance": 0,
    "openingDate": "YYYY-MM-DD"
  },
  "wallet": {
    "openingBalance": 0,
    "openingDate": "YYYY-MM-DD"
  }
}
```

**Response**
```json
{ "success": true }
```

---

## Files

| File | Purpose |
|---|---|
| `src/app/setup/page.tsx` | Server component — checks guard, renders wizard |
| `src/app/setup/setup-wizard.tsx` | Client component — multi-step form UI |
| `src/app/api/setup/route.ts` | GET (check) + POST (complete) endpoints |
| `src/app/login/page.tsx` | Modified — redirects to `/setup` if no users |
| `src/app/(dashboard)/layout.tsx` | Modified — redirects to `/setup` if no users |

---

## Security Notes

- `POST /api/setup` checks `user.count() === 0` server-side before doing anything. A race condition between two simultaneous setup submissions is handled by the unique constraint on `username` — only one will succeed.
- The setup page itself performs the guard check server-side (not just client-side) so it cannot be bypassed by disabling JavaScript.
- Passwords are hashed with bcrypt (cost factor 10) before storage, identical to the normal user creation flow.
- A `USER_CREATED` audit log is written so the first owner account creation is recorded.
