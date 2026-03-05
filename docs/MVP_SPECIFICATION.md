# BalanceX MVP Enhancement Specification
## Retail Finance Manager - Complete Design Document

**Version:** 1.2
**Date:** January 24, 2026
**Status:** Ready for Development

---

## Table of Contents

1. [MVP Scope (V1)](#1-mvp-scope-v1)
2. [User Roles](#2-user-roles)
3. [End-to-End Workflows](#3-end-to-end-workflows)
4. [Information Architecture](#4-information-architecture)
5. [Screen List (MVP)](#5-screen-list-mvp)
6. [Wireframes (ASCII)](#6-wireframes-ascii)
7. [Daily Sales Entry - Exact Structure](#7-daily-sales-entry--exact-structure)
8. [Data Definition Per Screen](#8-data-definition-per-screen)
9. [Telco File Import Rules](#9-telco-file-import-rules)
10. [Key Calculations](#10-key-calculations)
11. [Deliverables Checklist](#11-deliverables-checklist)
12. [Design Decisions](#12-design-decisions)

---

## 1) MVP Scope (V1)

### In Scope - Must Have

| Module | Features |
|--------|----------|
| **Authentication** | Login, logout, session management |
| **User Roles** | Owner, Sales Staff, Accountant with permissions |
| **Daily Entry** | Grid entry for all categories, credit section with customer linking |
| **Credit Customers** | Register, view ledger, record settlements |
| **Telco Screenshot** | Upload JPG/screenshot as reference, visual verification |
| **Day Detail** | View manual entry with telco screenshot side-by-side |
| **Bank Ledger** | Opening balance, deposits, withdrawals, running balance |
| **Reload Wallet** | Opening balance, top-ups, auto-deduct from reload sales, closing balance |
| **Dashboard** | Today's summary, quick stats, alerts |
| **Monthly Report** | Revenue by payment method, customer type, daily breakdown |
| **Settings** | User management (Owner only), data export/backup |

### Out of Scope - V2 or Later

| Feature | Reason |
|---------|--------|
| Multi-shop support | MVP is single shop |
| Cloud sync / remote access | Local hosting only |
| Mobile app | Web-first MVP |
| Inventory management | Focus on finance only |
| Automated report emails | Manual export sufficient |
| API integrations | Manual import sufficient |
| Audit log history | Basic tracking only |
| Password recovery | Owner can reset manually |
| Two-factor authentication | Overkill for local MVP |
| Customer portal | Internal use only |
| Receipt printing | Outside scope |
| Multi-currency | Single currency (MVR) |
| OCR for telco reports | Complex, future enhancement |

---

## 2) User Roles

### Role Definitions

| Role | Description | Typical User |
|------|-------------|--------------|
| **Owner** | Full access, manages users, views all data, can override credit limits | Shop owner |
| **Accountant** | Financial oversight, reports, bank/credit management | Senior staff, bookkeeper |
| **Sales** | Daily entry, basic views, no sensitive data | Counter staff |

### Permission Matrix

| Feature | Owner | Accountant | Sales |
|---------|-------|------------|-------|
| **Dashboard** | Full | Full | Limited (today only) |
| **Daily Entry - Create/Edit** | ✓ | ✓ | ✓ (own entries) |
| **Daily Entry - Submit** | ✓ | ✓ | ✓ |
| **Daily Entry - Edit Submitted** | ✓ | ✓ (last 7 days) | ✗ |
| **Daily Entry - Delete** | ✓ | ✗ | ✗ |
| **Telco Screenshot Upload** | ✓ | ✓ | ✗ |
| **Day Detail View** | ✓ | ✓ | ✓ (own entries) |
| **Credit Customers - View** | ✓ | ✓ | ✓ |
| **Credit Customers - Add/Edit** | ✓ | ✓ | ✗ |
| **Credit Customers - Record Settlement** | ✓ | ✓ | ✗ |
| **Credit Limit Override** | ✓ | ✗ | ✗ |
| **Bank Ledger - View** | ✓ | ✓ | ✗ |
| **Bank Ledger - Add/Edit** | ✓ | ✓ | ✗ |
| **Reload Wallet - View** | ✓ | ✓ | ✓ |
| **Reload Wallet - Add Top-up** | ✓ | ✓ | ✗ |
| **Monthly Report** | ✓ | ✓ | ✗ |
| **Settings - View** | ✓ | ✓ | ✓ (own profile) |
| **Settings - User Management** | ✓ | ✗ | ✗ |
| **Settings - Data Export** | ✓ | ✓ | ✗ |
| **Settings - Data Clear** | ✓ | ✗ | ✗ |

### Role-Based Navigation

| Sidebar Item | Owner | Accountant | Sales |
|--------------|-------|------------|-------|
| Dashboard | ✓ | ✓ | ✓ |
| Daily Entry | ✓ | ✓ | ✓ |
| Day Detail | ✓ | ✓ | ✓ (own entries) |
| Credit Customers | ✓ | ✓ | ✓ (view only) |
| Bank Ledger | ✓ | ✓ | Hidden |
| Reload Wallet | ✓ | ✓ | ✓ |
| Reports | ✓ | ✓ | Hidden |
| Settings | ✓ | ✓ | ✓ (limited) |

---

## 3) End-to-End Workflows

### 3.1 Daily Staff Workflow (Sales Role)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ MORNING                                                                 │
├─────────────────────────────────────────────────────────────────────────┤
│ 1. Login with credentials                                               │
│ 2. Navigate to Daily Entry                                              │
│ 3. System auto-loads today's date (or select date)                      │
│ 4. Enter Cash Drawer Opening Balance                                    │
│ 5. Wallet Opening auto-loads from previous day's actual closing         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ DURING DAY                                                              │
├─────────────────────────────────────────────────────────────────────────┤
│ 6. Enter sales as they occur (or batch at end of day):                  │
│    - Dhiraagu Bills (Cash, Transfer, Credit)                            │
│    - Retail Reload (Cash, Transfer)                                     │
│    - Wholesale Reload (Cash, Transfer)                                  │
│    - SIM sales (Cash, Transfer) + Quantity                              │
│    - USIM sales (Cash, Transfer) + Quantity                             │
│                                                                         │
│ 7. For Credit Sales:                                                    │
│    - Click [+ Add Credit Sale] in credit section                        │
│    - Select customer (or register new)                                  │
│    - Enter amount and optional reference                                │
│    - If exceeds credit limit: Owner authorization required              │
│    - Credit auto-populates in grid                                      │
│                                                                         │
│ 8. Save as Draft periodically (auto-save recommended)                   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ END OF DAY                                                              │
├─────────────────────────────────────────────────────────────────────────┤
│ 9. Count physical cash → Enter Actual Cash Closing                      │
│ 10. Check reload wallet balance → Enter Actual Wallet Closing           │
│ 11. Record any bank deposits made today                                 │
│ 12. Add notes if needed                                                 │
│ 13. Review all entries                                                  │
│ 14. Click [Submit Day]                                                  │
│                                                                         │
│ VALIDATION CHECKS:                                                      │
│ ├─ Credit balanced? (grid = credit section) → HARD BLOCK if not         │
│ ├─ Cash variance exists? → WARNING if any variance                      │
│ ├─ Cash variance > MVR 500? → HARD BLOCK                                │
│ ├─ Wallet variance exists? → WARNING if any variance                    │
│ └─ Wallet variance > MVR 500? → HARD BLOCK                              │
│                                                                         │
│ 15. Confirm submission                                                  │
│ 16. Logout                                                              │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Variance Rules Summary

| Condition | Action |
|-----------|--------|
| Credit unbalanced (grid ≠ credit section) | **HARD BLOCK** - Cannot submit |
| Cash variance > 0 and ≤ MVR 500 | **WARNING** - Can submit with confirmation |
| Cash variance > MVR 500 | **HARD BLOCK** - Must balance first |
| Wallet variance > 0 and ≤ MVR 500 | **WARNING** - Can submit with confirmation |
| Wallet variance > MVR 500 | **HARD BLOCK** - Must balance first |

#### Error Scenarios - Daily Entry

| Error | System Response |
|-------|-----------------|
| Credit not balanced | Hard block, show which amounts don't match |
| Cash variance > MVR 500 | Hard block, require balance adjustment |
| Wallet variance > MVR 500 | Hard block, require balance adjustment |
| Small variance (≤ MVR 500) | Warning dialog, require confirmation to proceed |
| Missing required fields | Highlight fields, prevent submit |
| Duplicate entry for date | Warn, allow edit or cancel |
| Session timeout | Auto-save draft, prompt re-login |
| Credit exceeds customer limit | Block unless Owner authorizes |

---

### 3.2 Telco Screenshot Upload Workflow (Owner/Accountant)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 1: DAILY ENTRY COMPLETE                                            │
├─────────────────────────────────────────────────────────────────────────┤
│ Sales staff enters daily data manually                                  │
│ Submits at end of day                                                   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 2: UPLOAD TELCO SCREENSHOT                                         │
├─────────────────────────────────────────────────────────────────────────┤
│ Owner/Accountant navigates to Day Detail for the date                   │
│ Clicks [Upload Screenshot]                                              │
│ Selects JPG/PNG image file                                              │
│ System stores image linked to date                                      │
│ Shows thumbnail preview                                                 │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 3: VISUAL VERIFICATION                                             │
├─────────────────────────────────────────────────────────────────────────┤
│ Owner/Accountant views manual entry alongside screenshot                │
│ Manually compares values by looking at both                             │
│ If all matches: Check "Verified against telco report"                   │
│ If mismatch found:                                                      │
│   - Edit manual entry to correct, OR                                    │
│   - Add verification note explaining difference                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Screenshot Upload Rules

| Rule | Details |
|------|---------|
| Supported formats | JPG, JPEG, PNG |
| Max file size | 10 MB |
| Storage | Linked to specific date |
| Replace | Can replace existing screenshot |
| Delete | Owner only can delete |

---

### 3.3 Owner Review Workflow

```
┌─────────────────────────────────────────────────────────────────────────┐
│ DAILY REVIEW                                                            │
├─────────────────────────────────────────────────────────────────────────┤
│ 1. Login as Owner                                                       │
│ 2. Dashboard shows:                                                     │
│    - Today's revenue summary                                            │
│    - Pending submissions alert                                          │
│    - Cash/wallet variance alerts                                        │
│    - Credit outstanding total                                           │
│    - Unverified days (screenshots not verified)                         │
│                                                                         │
│ 3. Click on day to view Day Detail:                                     │
│    - Manual entry summary                                               │
│    - Telco screenshot (if uploaded)                                     │
│    - Verification status                                                │
│    - Variance breakdown                                                 │
│    - Credit sales linked to customers                                   │
│                                                                         │
│ 4. If issues found:                                                     │
│    - Can edit submitted entry (Owner only for any date)                 │
│    - Can add notes                                                      │
│    - Can flag for follow-up                                             │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ MONTHLY REVIEW                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│ 5. Navigate to Reports → Monthly Summary                                │
│ 6. Select month/year                                                    │
│ 7. Review:                                                              │
│    - Total revenue by payment method                                    │
│    - Total revenue by customer type                                     │
│    - Daily breakdown table                                              │
│    - Average daily revenue                                              │
│    - Cash variance trend                                                │
│    - Outstanding credit aging                                           │
│                                                                         │
│ 8. Export report if needed                                              │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### 3.4 Credit Settlement Workflow (Accountant/Owner)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ RECORD SETTLEMENT                                                       │
├─────────────────────────────────────────────────────────────────────────┤
│ 1. Navigate to Credit Customers                                         │
│ 2. Search/select customer with outstanding balance                      │
│ 3. Click [Record Settlement]                                            │
│ 4. Enter:                                                               │
│    - Amount (cannot exceed outstanding)                                 │
│    - Payment method (Cash or Transfer)                                  │
│    - Reference (receipt number, etc.)                                   │
│    - Notes (optional)                                                   │
│ 5. Confirm settlement                                                   │
│ 6. System updates:                                                      │
│    - Customer outstanding balance                                       │
│    - Customer ledger history                                            │
│    - If Cash: Affects today's cash calculations                         │
│    - If Transfer: Records as bank transfer received                     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### 3.5 Credit Limit Override Workflow (Owner Only)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ CREDIT LIMIT EXCEEDED                                                   │
├─────────────────────────────────────────────────────────────────────────┤
│ 1. Sales staff attempts to add credit sale                              │
│ 2. System detects: New balance would exceed credit limit                │
│ 3. Dialog shows:                                                        │
│    - Customer: Ahmed Mohamed                                            │
│    - Credit Limit: MVR 5,000                                            │
│    - Current Outstanding: MVR 4,200                                     │
│    - This Sale: MVR 1,500                                               │
│    - New Balance: MVR 5,700 (exceeds by MVR 700)                        │
│                                                                         │
│ IF logged in as Owner:                                                  │
│    - [Cancel] [Override & Approve]                                      │
│                                                                         │
│ IF logged in as Sales/Accountant:                                       │
│    - "Credit limit exceeded. Owner authorization required."             │
│    - [Cancel] [Request Owner Approval]                                  │
│    - Owner must login to approve                                        │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4) Information Architecture

### Sidebar Navigation

```
┌─────────────────────────┐
│ BalanceX               │
│ ━━━━━━━━━━━━━━━━━━━━━━ │
│                         │
│ 📊 Dashboard            │
│                         │
│ DAILY OPERATIONS        │
│ ├─ 📝 Daily Entry       │
│ └─ 📋 Day Detail        │
│                         │
│ FINANCE                 │
│ ├─ 👥 Credit Customers  │
│ ├─ 🏦 Bank Ledger       │
│ └─ 📱 Reload Wallet     │
│                         │
│ REPORTS                 │
│ └─ 📈 Monthly Summary   │
│                         │
│ ━━━━━━━━━━━━━━━━━━━━━━ │
│ ⚙️ Settings             │
│                         │
│ ━━━━━━━━━━━━━━━━━━━━━━ │
│ 👤 Ahmed (Owner)        │
│    Logout               │
└─────────────────────────┘
```

### Section Purposes

| Section | Purpose |
|---------|---------|
| **Dashboard** | At-a-glance summary, alerts, quick actions |
| **Daily Entry** | Primary data entry for daily sales |
| **Day Detail** | View manual entry with telco screenshot, verification |
| **Credit Customers** | Manage credit accounts, view ledgers, record settlements |
| **Bank Ledger** | Track bank balance, deposits, withdrawals |
| **Reload Wallet** | Track reload wallet balance and top-ups |
| **Monthly Summary** | Aggregated reports by month |
| **Settings** | User management, app config, data management |

---

## 5) Screen List (MVP)

### Authentication (1 screen)
- Login

### Dashboard (1 screen)
- Dashboard (Home)

### Daily Operations (2 screens)
- Daily Entry (create/edit)
- Day Detail (view with screenshot)

### Finance (3 screens)
- Credit Customers (list + detail as dialog/drawer)
- Bank Ledger
- Reload Wallet

### Reports (1 screen)
- Monthly Summary

### Settings (1 screen + dialogs)
- Settings (with user management dialog for Owner)

### Dialogs/Modals (not standalone screens)
- Add Credit Sale Dialog
- Register Customer Dialog
- Record Settlement Dialog
- Add Bank Transaction Dialog
- Add Wallet Top-up Dialog
- User Management Dialog
- Confirm Submit Dialog
- Screenshot Viewer Dialog
- Credit Limit Override Dialog

**Total: 9 main screens + 9 dialogs**

---

## 6) Wireframes (ASCII)

### A) Login Screen

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│                                                                         │
│                                                                         │
│                         ┌───────────────────────┐                       │
│                         │                       │                       │
│                         │      BalanceX         │                       │
│                         │   Retail Finance      │                       │
│                         │                       │                       │
│                         └───────────────────────┘                       │
│                                                                         │
│                         ┌───────────────────────┐                       │
│                         │ Username              │                       │
│                         │ ┌───────────────────┐ │                       │
│                         │ │                   │ │                       │
│                         │ └───────────────────┘ │                       │
│                         │                       │                       │
│                         │ Password              │                       │
│                         │ ┌───────────────────┐ │                       │
│                         │ │ ●●●●●●●●          │ │                       │
│                         │ └───────────────────┘ │                       │
│                         │                       │                       │
│                         │ ┌───────────────────┐ │                       │
│                         │ │      Login        │ │                       │
│                         │ └───────────────────┘ │                       │
│                         │                       │                       │
│                         └───────────────────────┘                       │
│                                                                         │
│                          v1.0.0 - Single Shop                           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### B) Dashboard

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ☰ BalanceX                                        👤 Ahmed (Owner) ▼   │
├─────────┬───────────────────────────────────────────────────────────────┤
│         │                                                               │
│ 📊 Dash │  Dashboard                                     Jan 24, 2026   │
│         │  ─────────────────────────────────────────────────────────── │
│ DAILY   │                                                               │
│ 📝 Entry│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────┐ │
│ 📋 Detail│  │ TODAY'S     │ │ CASH IN     │ │ BANK        │ │ CREDIT  │ │
│         │  │ REVENUE     │ │ HAND        │ │ BALANCE     │ │ OUTSTAND│ │
│ FINANCE │  │             │ │             │ │             │ │         │ │
│ 👥 Credit│  │ MVR 12,450  │ │ MVR 3,200   │ │ MVR 45,000  │ │ MVR 8,50│ │
│ 🏦 Bank  │  │ ↑ 12% vs yd │ │ Var: +50    │ │ ↑ 2,000 dep │ │ 5 custom│ │
│ 📱 Wallet│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────┘ │
│         │                                                               │
│ REPORTS │  ┌─────────────────────────────┐ ┌───────────────────────────┐│
│ 📈 Month│  │ ⚠️ ALERTS                    │ │ QUICK ACTIONS             ││
│         │  │                             │ │                           ││
│─────────│  │ • Day not submitted (Jan 23)│ │ [+ New Daily Entry]       ││
│ ⚙️ Setti│  │ • Cash variance > MVR 50    │ │ [📷 Upload Screenshot]    ││
│         │  │ • 2 days not verified       │ │ [👥 Record Settlement]    ││
│─────────│  │ • 2 credit customers overdue│ │                           ││
│ 👤 Ahmed│  └─────────────────────────────┘ └───────────────────────────┘│
│  Logout │                                                               │
│         │  ┌───────────────────────────────────────────────────────────┐│
│         │  │ TODAY'S BREAKDOWN                                         ││
│         │  ├───────────────────────────────────────────────────────────┤│
│         │  │              │   Cash    │ Transfer │  Credit  │  TOTAL   ││
│         │  ├──────────────┼───────────┼──────────┼──────────┼──────────┤│
│         │  │ Consumer     │   4,200   │   1,800  │    800   │   6,800  ││
│         │  │ Corporate    │   3,500   │   1,650  │    500   │   5,650  ││
│         │  ├──────────────┼───────────┼──────────┼──────────┼──────────┤│
│         │  │ TOTAL        │   7,700   │   3,450  │  1,300   │  12,450  ││
│         │  └───────────────────────────────────────────────────────────┘│
│         │                                                               │
│         │  ┌───────────────────────────────────────────────────────────┐│
│         │  │ RECENT ACTIVITY                                           ││
│         │  ├───────────────────────────────────────────────────────────┤│
│         │  │ • Jan 24 - Daily entry submitted by Mariyam         2h ago││
│         │  │ • Jan 24 - Screenshot uploaded for Jan 23           3h ago││
│         │  │ • Jan 24 - Settlement MVR 500 from Ahmed Mohamed    3h ago││
│         │  │ • Jan 23 - Bank deposit MVR 2,000                   1d ago││
│         │  └───────────────────────────────────────────────────────────┘│
│         │                                                               │
└─────────┴───────────────────────────────────────────────────────────────┘
```

---

### C) Daily Sales Entry

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ☰ BalanceX                                        👤 Mariyam (Sales) ▼ │
├─────────┬───────────────────────────────────────────────────────────────┤
│         │                                                               │
│ 📊 Dash │  Daily Entry                              📅 Jan 24, 2026 ▼  │
│         │  ───────────────────────────────────────────────────────────  │
│ DAILY   │                                     Status: [Draft] [Submit]  │
│ 📝 Entry│                                                               │
│ 📋 Detail│ ┌───────────────────────────────────────────────────────────┐ │
│         │ │ 💰 CASH DRAWER                                            │ │
│ FINANCE │ ├───────────────────────────────────────────────────────────┤ │
│ 👥 Credit│ │ Opening Balance    [    2,500.00 ]                        │ │
│ 🏦 Bank  │ │ Expected Closing        5,200.00  (auto-calculated)       │ │
│ 📱 Wallet│ │ Actual Closing     [    5,250.00 ]                        │ │
│         │ │ Variance                  +50.00  ⚠️ (within tolerance)    │ │
│ REPORTS │ │ Bank Deposits Today [    2,000.00 ]                        │ │
│ 📈 Month│ └───────────────────────────────────────────────────────────┘ │
│         │                                                               │
│─────────│ ┌───────────────────────────────────────────────────────────┐ │
│ ⚙️ Setti│ │ DHIRAAGU BILLS                                            │ │
│         │ ├─────────────────┬──────────┬──────────┬──────────────────┤ │
│─────────│ │                 │   Cash   │ Transfer │ Credit (auto)    │ │
│ 👤 User │ ├─────────────────┼──────────┼──────────┼──────────────────┤ │
│  Logout │ │ Consumer        │ [ 1,200] │ [   500] │       800  🔒    │ │
│         │ │ Corporate       │ [ 3,400] │ [ 2,100] │     1,500  🔒    │ │
│         │ └─────────────────┴──────────┴──────────┴──────────────────┘ │
│         │                                                               │
│         │ ┌───────────────────────────────────────────────────────────┐ │
│         │ │ RETAIL RELOAD                                             │ │
│         │ ├─────────────────┬──────────┬──────────┐                   │ │
│         │ │                 │   Cash   │ Transfer │  (No Credit)      │ │
│         │ ├─────────────────┼──────────┼──────────┤                   │ │
│         │ │ Consumer        │ [   800] │ [   200] │                   │ │
│         │ │ Corporate       │ [ 2,000] │ [ 1,500] │                   │ │
│         │ └─────────────────┴──────────┴──────────┘                   │ │
│         │                                                               │
│         │ ┌───────────────────────────────────────────────────────────┐ │
│         │ │ WHOLESALE RELOAD                                          │ │
│         │ ├─────────────────┬──────────┬──────────┐                   │ │
│         │ │                 │   Cash   │ Transfer │  (No Credit)      │ │
│         │ ├─────────────────┼──────────┼──────────┤                   │ │
│         │ │ Consumer        │ [     0] │ [     0] │                   │ │
│         │ │ Corporate       │ [ 5,000] │ [ 3,000] │                   │ │
│         │ └─────────────────┴──────────┴──────────┘                   │ │
│         │                                                               │
│         │ ┌───────────────────────────────────────────────────────────┐ │
│         │ │ SIM                                          Qty: [  12 ] │ │
│         │ ├─────────────────┬──────────┬──────────┐                   │ │
│         │ │                 │   Cash   │ Transfer │  (No Credit)      │ │
│         │ ├─────────────────┼──────────┼──────────┤                   │ │
│         │ │ Consumer        │ [   600] │ [   300] │                   │ │
│         │ │ Corporate       │ [   400] │ [   200] │                   │ │
│         │ └─────────────────┴──────────┴──────────┘                   │ │
│         │                                                               │
│         │ ┌───────────────────────────────────────────────────────────┐ │
│         │ │ USIM                                         Qty: [   8 ] │ │
│         │ ├─────────────────┬──────────┬──────────┐                   │ │
│         │ │                 │   Cash   │ Transfer │  (No Credit)      │ │
│         │ ├─────────────────┼──────────┼──────────┤                   │ │
│         │ │ Consumer        │ [   400] │ [   200] │                   │ │
│         │ │ Corporate       │ [   300] │ [   100] │                   │ │
│         │ └─────────────────┴──────────┴──────────┘                   │ │
│         │                                                               │
│         │ (continued below - Credit Section, Wallet, Notes, Summary)    │
└─────────┴───────────────────────────────────────────────────────────────┘
```

### Daily Sales Entry (continued) - Credit Section & Wallet

```
┌─────────────────────────────────────────────────────────────────────────┐
│         │                                                               │
│         │ ┌───────────────────────────────────────────────────────────┐ │
│         │ │ 💳 CREDIT SALES - DHIRAAGU BILLS                          │ │
│         │ ├───────────────────────────────────────────────────────────┤ │
│         │ │ Customer         │ Type      │ Amount   │ Ref    │ Action │ │
│         │ ├──────────────────┼───────────┼──────────┼────────┼────────┤ │
│         │ │ Ahmed Mohamed    │ Consumer  │   500.00 │ INV-01 │  [🗑]  │ │
│         │ │ Fathimath Ali    │ Consumer  │   300.00 │        │  [🗑]  │ │
│         │ │ Island Tech Ltd  │ Corporate │ 1,500.00 │ PO-15  │  [🗑]  │ │
│         │ ├──────────────────┴───────────┴──────────┴────────┴────────┤ │
│         │ │ [+ Add Credit Sale]                                       │ │
│         │ ├───────────────────────────────────────────────────────────┤ │
│         │ │ Consumer Credit:      MVR    800.00                       │ │
│         │ │ Corporate Credit:     MVR  1,500.00                       │ │
│         │ │ ─────────────────────────────────────                     │ │
│         │ │ TOTAL CREDIT:         MVR  2,300.00  ✓ Balanced           │ │
│         │ └───────────────────────────────────────────────────────────┘ │
│         │                                                               │
│         │ ┌───────────────────────────────────────────────────────────┐ │
│         │ │ 📱 RELOAD WALLET                                          │ │
│         │ ├───────────────────────────────────────────────────────────┤ │
│         │ │ Opening Balance         15,000.00  (from yesterday)       │ │
│         │ │ + Top-ups Today    [     5,000.00 ]  [+ Add Top-up]       │ │
│         │ │ - Reload Sales Used     (8,500.00)  (auto from grid)      │ │
│         │ │ ─────────────────────────────────────                     │ │
│         │ │ Expected Closing        11,500.00                         │ │
│         │ │ Actual Closing     [    11,400.00 ]                       │ │
│         │ │ Variance                  -100.00  ⚠️ (within tolerance)  │ │
│         │ └───────────────────────────────────────────────────────────┘ │
│         │                                                               │
│         │ ┌───────────────────────────────────────────────────────────┐ │
│         │ │ 📝 NOTES                                                  │ │
│         │ ├───────────────────────────────────────────────────────────┤ │
│         │ │ ┌───────────────────────────────────────────────────────┐ │ │
│         │ │ │ Power outage at 3pm, system down for 30 mins.         │ │ │
│         │ │ │ Some transactions may have been missed.               │ │ │
│         │ │ └───────────────────────────────────────────────────────┘ │ │
│         │ └───────────────────────────────────────────────────────────┘ │
│         │                                                               │
│         │ ┌───────────────────────────────────────────────────────────┐ │
│         │ │ DAILY SUMMARY                                             │ │
│         │ ├───────────────────────────────────────────────────────────┤ │
│         │ │              │   Cash    │ Transfer │  Credit  │  TOTAL   │ │
│         │ ├──────────────┼───────────┼──────────┼──────────┼──────────┤ │
│         │ │ Consumer     │   3,000   │   1,200  │    800   │   5,000  │ │
│         │ │ Corporate    │  11,100   │   6,900  │  1,500   │  19,500  │ │
│         │ ├──────────────┼───────────┼──────────┼──────────┼──────────┤ │
│         │ │ TOTAL        │  14,100   │   8,100  │  2,300   │  24,500  │ │
│         │ └───────────────────────────────────────────────────────────┘ │
│         │                                                               │
│         │                        [ Save Draft ]  [ Submit Day ]         │
│         │                                                               │
└─────────┴───────────────────────────────────────────────────────────────┘
```

---

### Add Credit Sale Dialog

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Add Credit Sale                                                    [X]  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Customer *                                                             │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ 🔍 Search customers...                                      ▼   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Ahmed Mohamed              Consumer     Outstanding: MVR 1,200  │   │
│  │ Fathimath Ali              Consumer     Outstanding: MVR   500  │   │
│  │ Island Tech Ltd            Corporate    Outstanding: MVR 3,400  │   │
│  │   ⚠️ Near limit (MVR 5,000)                                     │   │
│  │ Maldives Corp              Corporate    Outstanding: MVR     0  │   │
│  ├─────────────────────────────────────────────────────────────────┤   │
│  │ [+ Register New Customer]                                       │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Amount (MVR) *                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ 500.00                                                          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Reference (optional)                                                   │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ INV-2024-001                                                    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ℹ️ This will be added to the customer's outstanding balance.          │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                         [ Cancel ]  [ Add Credit Sale ] │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### Credit Limit Exceeded Dialog

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ⚠️ Credit Limit Exceeded                                           [X]  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Customer: Island Tech Ltd (Corporate)                                  │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Credit Limit:           MVR  5,000.00                           │   │
│  │ Current Outstanding:    MVR  3,400.00                           │   │
│  │ This Sale:              MVR  2,000.00                           │   │
│  │ ───────────────────────────────────────                         │   │
│  │ New Balance:            MVR  5,400.00                           │   │
│  │ Exceeds Limit By:       MVR    400.00  ⚠️                       │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ ⛔ This credit sale cannot be processed without Owner approval. │   │
│  │                                                                 │   │
│  │ Options:                                                        │   │
│  │ • Reduce the sale amount to MVR 1,600 or less                   │   │
│  │ • Request Owner to login and approve                            │   │
│  │ • Cancel this credit sale                                       │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  (If logged in as Owner, show Override button instead)                  │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                          [ Cancel ]     │
│                                                                         │
│  ───── Owner Only ─────                                                 │
│  [ Override & Approve ]  (visible only when Owner is logged in)         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### D) Day Detail (with Screenshot)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ☰ BalanceX                                        👤 Ahmed (Owner) ▼   │
├─────────┬───────────────────────────────────────────────────────────────┤
│         │                                                               │
│ 📊 Dash │  Day Detail                                   📅 Jan 24, 2026│
│         │  ───────────────────────────────────────────────────────────  │
│ DAILY   │                                                               │
│ 📝 Entry│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐          │
│ 📋 Detail│  │ Manual Entry │ │ Telco Report │ │ Verification │          │
│         │  │ ✓ Submitted  │ │ ✓ Uploaded   │ │ ✓ Verified   │          │
│ FINANCE │  └──────────────┘ └──────────────┘ └──────────────┘          │
│ 👥 Credit│                                                              │
│ 🏦 Bank  │  [Edit Entry]  [Upload Screenshot]  [Mark Verified]          │
│ 📱 Wallet│                                                              │
│         │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ REPORTS │                                                               │
│ 📈 Month│  ┌────────────────────────────┐ ┌────────────────────────────┐│
│         │  │ MANUAL ENTRY SUMMARY       │ │ TELCO REPORT               ││
│─────────│  ├────────────────────────────┤ ├────────────────────────────┤│
│ ⚙️ Setti│  │                            │ │                            ││
│         │  │ Dhiraagu Bills:   8,000    │ │ ┌────────────────────────┐ ││
│─────────│  │ Retail Reload:    4,500    │ │ │                        │ ││
│ 👤 Ahmed│  │ Wholesale Reload: 8,000    │ │ │  [Screenshot Preview]  │ ││
│  Logout │  │ SIM:              1,500    │ │ │                        │ ││
│         │  │ USIM:             1,000    │ │ │  📷 Click to enlarge   │ ││
│         │  │ ────────────────────────   │ │ │                        │ ││
│         │  │ TOTAL:           23,000    │ │ └────────────────────────┘ ││
│         │  │                            │ │                            ││
│         │  │ Cash:            14,100    │ │ Uploaded: Jan 25, 2026     ││
│         │  │ Transfer:         8,100    │ │ By: Ahmed (Owner)          ││
│         │  │ Credit:           2,300    │ │                            ││
│         │  │                            │ │ [View Full Size]           ││
│         │  │                            │ │ [Replace Screenshot]       ││
│         │  └────────────────────────────┘ └────────────────────────────┘│
│         │                                                               │
│         │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│         │                                                               │
│         │  VERIFICATION STATUS                                          │
│         │  ┌───────────────────────────────────────────────────────────┐│
│         │  │                                                           ││
│         │  │  ☑ I have verified the manual entry matches the telco     ││
│         │  │    report screenshot                                      ││
│         │  │                                                           ││
│         │  │  Verified by: Ahmed (Owner) on Jan 25, 2026 at 9:15 AM    ││
│         │  │                                                           ││
│         │  │  Notes: ________________________________________________  ││
│         │  │         Small rounding difference in Retail Reload (MVR 2)││
│         │  │                                                           ││
│         │  └───────────────────────────────────────────────────────────┘│
│         │                                                               │
│         │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│         │                                                               │
│         │  CREDIT SALES (3 transactions)                                │
│         │  ┌───────────────────────────────────────────────────────────┐│
│         │  │ Ahmed Mohamed (Consumer)      MVR 500    INV-01           ││
│         │  │ Fathimath Ali (Consumer)      MVR 300                     ││
│         │  │ Island Tech Ltd (Corporate)   MVR 1,500  PO-15            ││
│         │  └───────────────────────────────────────────────────────────┘│
│         │                                                               │
│         │  RECONCILIATION                                               │
│         │  ┌───────────────────────────────────────────────────────────┐│
│         │  │ Cash Drawer:  Expected 5,200 | Actual 5,250 | Var +50 ⚠️ ││
│         │  │ Wallet:       Expected 11,500| Actual 11,400| Var -100 ⚠️││
│         │  │ Bank Deposit: MVR 2,000                                   ││
│         │  └───────────────────────────────────────────────────────────┘│
│         │                                                               │
│         │  NOTES                                                        │
│         │  ┌───────────────────────────────────────────────────────────┐│
│         │  │ Power outage at 3pm, system down for 30 mins.             ││
│         │  └───────────────────────────────────────────────────────────┘│
│         │                                                               │
│         │  Entry by: Mariyam (Sales) at 6:45 PM                         │
│         │                                                               │
└─────────┴───────────────────────────────────────────────────────────────┘
```

---

### Screenshot Viewer Dialog

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Telco Report - Jan 24, 2026                                        [X]  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                                                                 │   │
│  │                                                                 │   │
│  │                                                                 │   │
│  │                    [Full Screenshot Image]                      │   │
│  │                                                                 │   │
│  │                                                                 │   │
│  │                                                                 │   │
│  │                                                                 │   │
│  │                                                                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Zoom: [−] ████████░░ [+]     [Fit to Window]  [Actual Size]            │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                              [Download]  [Replace]  [ Close ]           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### E) Monthly Summary

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ☰ BalanceX                                        👤 Ahmed (Owner) ▼   │
├─────────┬───────────────────────────────────────────────────────────────┤
│         │                                                               │
│ 📊 Dash │  Monthly Summary                     [◀ Dec]  Jan 2026 [Feb ▶]│
│         │  ───────────────────────────────────────────────────────────  │
│ DAILY   │                                                               │
│ 📝 Entry│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────┐ │
│ 📋 Detail│  │ TOTAL       │ │ AVERAGE     │ │ DAYS        │ │ CREDIT  │ │
│         │  │ REVENUE     │ │ DAILY       │ │ COMPLETE    │ │ OUTSTAND│ │
│ FINANCE │  │             │ │             │ │             │ │         │ │
│ 👥 Credit│  │ MVR 524,000 │ │ MVR 21,833  │ │ 24 / 24     │ │ MVR 8,50│ │
│ 🏦 Bank  │  │             │ │             │ │ ✓ All done  │ │         │ │
│ 📱 Wallet│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────┘ │
│         │                                                               │
│ REPORTS │  [Export Report]                                              │
│ 📈 Month│                                                               │
│         │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│─────────│                                                               │
│ ⚙️ Setti│  REVENUE BY PAYMENT METHOD                                    │
│         │  ┌───────────────────────────────────────────────────────────┐│
│─────────│  │ Cash         │████████████████████████████│ MVR 285,000   ││
│ 👤 Ahmed│  │ Transfer     │████████████████            │ MVR 189,000   ││
│  Logout │  │ Credit       │█████                       │ MVR  50,000   ││
│         │  └───────────────────────────────────────────────────────────┘│
│         │                                                               │
│         │  REVENUE BY CUSTOMER TYPE                                     │
│         │  ┌───────────────────────────────────────────────────────────┐│
│         │  │ Consumer     │████████████████████        │ MVR 314,400   ││
│         │  │ Corporate    │████████████████            │ MVR 209,600   ││
│         │  └───────────────────────────────────────────────────────────┘│
│         │                                                               │
│         │  REVENUE BY CATEGORY                                          │
│         │  ┌───────────────────────────────────────────────────────────┐│
│         │  │ Dhiraagu Bills    │██████████████████████ │ MVR 196,500   ││
│         │  │ Retail Reload     │██████████████         │ MVR 108,000   ││
│         │  │ Wholesale Reload  │████████████████████   │ MVR 180,000   ││
│         │  │ SIM               │████                   │ MVR  24,000   ││
│         │  │ USIM              │███                    │ MVR  15,500   ││
│         │  └───────────────────────────────────────────────────────────┘│
│         │                                                               │
│         │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│         │                                                               │
│         │  DAILY BREAKDOWN                                              │
│         │  ┌───────────────────────────────────────────────────────────┐│
│         │  │ Date │ Cash    │Transfer│Credit │ Total  │ SIM │USIM│Stat││
│         │  ├──────┼─────────┼────────┼───────┼────────┼─────┼────┼────┤│
│         │  │ 01   │  12,500 │  8,200 │ 2,100 │ 22,800 │  10 │  5 │ ✓  ││
│         │  │ 02   │  11,800 │  7,500 │ 1,800 │ 21,100 │  12 │  8 │ ✓  ││
│         │  │ 03   │  13,200 │  9,100 │ 2,500 │ 24,800 │   8 │  4 │ ✓  ││
│         │  │ ...  │   ...   │  ...   │  ...  │  ...   │ ... │... │    ││
│         │  │ 24   │  14,100 │  8,100 │ 2,300 │ 24,500 │  12 │  8 │ ✓  ││
│         │  ├──────┼─────────┼────────┼───────┼────────┼─────┼────┼────┤│
│         │  │TOTAL │ 285,000 │189,000 │50,000 │524,000 │ 240 │120 │    ││
│         │  └───────────────────────────────────────────────────────────┘│
│         │                                                               │
│         │  VARIANCE SUMMARY                                             │
│         │  ┌───────────────────────────────────────────────────────────┐│
│         │  │ Cash Variance:   Total +MVR 320  │ Days with variance: 8  ││
│         │  │ Wallet Variance: Total -MVR 150  │ Days with variance: 5  ││
│         │  │ Largest cash +: MVR 120 (Jan 15) │ Largest -: MVR 80 (08) ││
│         │  └───────────────────────────────────────────────────────────┘│
│         │                                                               │
└─────────┴───────────────────────────────────────────────────────────────┘
```

---

### F) Bank Ledger

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ☰ BalanceX                                        👤 Ahmed (Owner) ▼   │
├─────────┬───────────────────────────────────────────────────────────────┤
│         │                                                               │
│ 📊 Dash │  Bank Ledger                                                  │
│         │  ───────────────────────────────────────────────────────────  │
│ DAILY   │                                                               │
│ 📝 Entry│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐              │
│ 📋 Detail│  │ CURRENT     │ │ THIS MONTH  │ │ THIS MONTH  │              │
│         │  │ BALANCE     │ │ DEPOSITS    │ │ WITHDRAWALS │              │
│ FINANCE │  │             │ │             │ │             │              │
│ 👥 Credit│  │ MVR 45,200  │ │ MVR 52,000  │ │ MVR 12,000  │              │
│ 🏦 Bank  │  │             │ │ ↑26 txns    │ │ ↓4 txns     │              │
│ 📱 Wallet│  └─────────────┘ └─────────────┘ └─────────────┘              │
│         │                                                               │
│ REPORTS │  [+ Add Deposit]  [+ Add Withdrawal]  [Set Opening Balance]   │
│ 📈 Month│                                                               │
│         │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│─────────│                                                               │
│ ⚙️ Setti│  Filter: [All Types ▼]  [Jan 2026 ▼]                          │
│         │                                                               │
│─────────│  TRANSACTION HISTORY                                          │
│ 👤 Ahmed│  ┌───────────────────────────────────────────────────────────┐│
│  Logout │  │ Date    │ Type       │ Amount    │ Reference │ Balance   ││
│         │  ├─────────┼────────────┼───────────┼───────────┼───────────┤│
│         │  │ Jan 24  │ 🟢 Deposit │  +2,000   │ Daily dep │  45,200   ││
│         │  │ Jan 23  │ 🟢 Deposit │  +2,500   │ Daily dep │  43,200   ││
│         │  │ Jan 22  │ 🔴 Withdraw│  -3,000   │ Rent pay  │  40,700   ││
│         │  │ Jan 22  │ 🟢 Deposit │  +1,800   │ Daily dep │  43,700   ││
│         │  │ Jan 21  │ 🟢 Deposit │  +2,200   │ Daily dep │  41,900   ││
│         │  │ Jan 20  │ 🔴 Withdraw│  -5,000   │ Supplier  │  39,700   ││
│         │  │ ...     │ ...        │  ...      │ ...       │  ...      ││
│         │  ├─────────┴────────────┴───────────┴───────────┴───────────┤│
│         │  │                                [1] [2] [3] ... [Next ▶]  ││
│         │  └───────────────────────────────────────────────────────────┘│
│         │                                                               │
│         │  Opening Balance (Jan 1, 2026): MVR 5,200                     │
│         │                                                               │
└─────────┴───────────────────────────────────────────────────────────────┘
```

---

### Add Bank Transaction Dialog

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Add Bank Transaction                                               [X]  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Transaction Type *                                                     │
│  ○ Deposit    ● Withdrawal                                              │
│                                                                         │
│  Date *                                                                 │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ 📅 Jan 24, 2026                                             ▼   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Amount (MVR) *                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ 3,000.00                                                        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Reference / Description *                                              │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Rent payment - January                                          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Notes (optional)                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                                                                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                       [ Cancel ]  [ Add Transaction ]   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### G) Credit Customers

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ☰ BalanceX                                        👤 Ahmed (Owner) ▼   │
├─────────┬───────────────────────────────────────────────────────────────┤
│         │                                                               │
│ 📊 Dash │  Credit Customers                                             │
│         │  ───────────────────────────────────────────────────────────  │
│ DAILY   │                                                               │
│ 📝 Entry│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐              │
│ 📋 Detail│  │ TOTAL       │ │ CONSUMER    │ │ CORPORATE   │              │
│         │  │ OUTSTANDING │ │ OUTSTANDING │ │ OUTSTANDING │              │
│ FINANCE │  │             │ │             │ │             │              │
│ 👥 Credit│  │ MVR 8,500   │ │ MVR 3,200   │ │ MVR 5,300   │              │
│ 🏦 Bank  │  │ 5 customers │ │ 3 customers │ │ 2 customers │              │
│ 📱 Wallet│  └─────────────┘ └─────────────┘ └─────────────┘              │
│         │                                                               │
│ REPORTS │  [+ Register Customer]                                        │
│ 📈 Month│                                                               │
│         │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│─────────│                                                               │
│ ⚙️ Setti│  🔍 [Search customers...                              ]       │
│         │                                                               │
│─────────│  Filter: [All ▼]  Sort: [Outstanding (High-Low) ▼]            │
│ 👤 Ahmed│                                                               │
│  Logout │  CUSTOMER LIST                                                │
│         │  ┌───────────────────────────────────────────────────────────┐│
│         │  │                                                           ││
│         │  │  ┌─────────────────────────────────────────────────────┐  ││
│         │  │  │ 🏢 Island Tech Ltd                     Corporate    │  ││
│         │  │  │ Outstanding: MVR 3,400    Limit: MVR 5,000          │  ││
│         │  │  │ Phone: 334-5678  |  Last activity: Jan 22           │  ││
│         │  │  │                [View Ledger] [Record Settlement]    │  ││
│         │  │  └─────────────────────────────────────────────────────┘  ││
│         │  │                                                           ││
│         │  │  ┌─────────────────────────────────────────────────────┐  ││
│         │  │  │ 🏢 Maldives Corp                       Corporate    │  ││
│         │  │  │ Outstanding: MVR 1,900    Limit: MVR 10,000         │  ││
│         │  │  │ Phone: 332-1234  |  Last activity: Jan 20           │  ││
│         │  │  │                [View Ledger] [Record Settlement]    │  ││
│         │  │  └─────────────────────────────────────────────────────┘  ││
│         │  │                                                           ││
│         │  │  ┌─────────────────────────────────────────────────────┐  ││
│         │  │  │ 👤 Ahmed Mohamed                       Consumer     │  ││
│         │  │  │ Outstanding: MVR 1,700    Limit: No limit           │  ││
│         │  │  │ Phone: 777-1234  |  Last activity: Jan 24           │  ││
│         │  │  │                [View Ledger] [Record Settlement]    │  ││
│         │  │  └─────────────────────────────────────────────────────┘  ││
│         │  │                                                           ││
│         │  │  ... more customers ...                                   ││
│         │  │                                                           ││
│         │  └───────────────────────────────────────────────────────────┘│
│         │                                                               │
└─────────┴───────────────────────────────────────────────────────────────┘
```

---

### Customer Ledger Dialog

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Customer Ledger - Ahmed Mohamed                                    [X]  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  👤 Ahmed Mohamed (Consumer)                                            │
│  Phone: 777-1234  |  Email: ahmed@email.com                             │
│  Credit Limit: No limit set                                             │
│                                                                         │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │ Outstanding Balance:                           MVR 1,700.00    │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  TRANSACTION HISTORY                                                    │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │ Date    │ Type       │ Amount   │ Reference  │ Balance        │    │
│  ├─────────┼────────────┼──────────┼────────────┼────────────────┤    │
│  │ Jan 24  │ 🔴 Credit  │ +500.00  │ INV-01     │     1,700.00   │    │
│  │ Jan 22  │ 🟢 Settle  │ -300.00  │ Cash       │     1,200.00   │    │
│  │ Jan 20  │ 🔴 Credit  │ +800.00  │            │     1,500.00   │    │
│  │ Jan 15  │ 🟢 Settle  │ -500.00  │ Transfer   │       700.00   │    │
│  │ Jan 10  │ 🔴 Credit  │ +700.00  │ INV-98     │     1,200.00   │    │
│  │ Jan 05  │ 🔴 Credit  │ +500.00  │            │       500.00   │    │
│  └─────────┴────────────┴──────────┴────────────┴────────────────┘    │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                     [Edit Customer]  [Record Settlement]  [ Close ]     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### Record Settlement Dialog

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Record Settlement                                                  [X]  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Customer: Ahmed Mohamed                                                │
│  Outstanding Balance: MVR 1,700.00                                      │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  Settlement Amount (MVR) *                                              │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ 500.00                                                          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│  [Pay Full Amount: MVR 1,700.00]                                        │
│                                                                         │
│  Payment Method *                                                       │
│  ○ Cash    ● Bank Transfer                                              │
│                                                                         │
│  Reference (optional)                                                   │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ TRF-2024-001                                                    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Notes (optional)                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Partial payment, remaining next week                            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  New Balance After Settlement: MVR 1,200.00                             │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                     [ Cancel ]  [ Record Settlement ]   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### Register Customer Dialog

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Register Customer                                                  [X]  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Customer Type *                                                        │
│  ● Consumer    ○ Corporate                                              │
│                                                                         │
│  Name *                                                                 │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Ahmed Mohamed                                                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Phone *                                                                │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ 777-1234                                                        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Email (optional)                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ ahmed@email.com                                                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Credit Limit (optional)                                                │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ 5,000.00                                                        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│  ℹ️ Leave blank for no limit. Owner approval required when exceeded.   │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                      [ Cancel ]  [ Register Customer ]  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### H) Reload Wallet

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ☰ BalanceX                                        👤 Ahmed (Owner) ▼   │
├─────────┬───────────────────────────────────────────────────────────────┤
│         │                                                               │
│ 📊 Dash │  Reload Wallet                                                │
│         │  ───────────────────────────────────────────────────────────  │
│ DAILY   │                                                               │
│ 📝 Entry│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐              │
│ 📋 Detail│  │ CURRENT     │ │ THIS MONTH  │ │ THIS MONTH  │              │
│         │  │ BALANCE     │ │ TOP-UPS     │ │ USAGE       │              │
│ FINANCE │  │             │ │             │ │             │              │
│ 👥 Credit│  │ MVR 11,400  │ │ MVR 85,000  │ │ MVR 78,500  │              │
│ 🏦 Bank  │  │ (as of today)│ │ 17 top-ups  │ │ from sales  │             │
│ 📱 Wallet│  └─────────────┘ └─────────────┘ └─────────────┘              │
│         │                                                               │
│ REPORTS │  [+ Add Top-up]  [Set Opening Balance]                        │
│ 📈 Month│                                                               │
│         │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│─────────│                                                               │
│ ⚙️ Setti│  TODAY'S WALLET ACTIVITY                                      │
│         │  ┌───────────────────────────────────────────────────────────┐│
│─────────│  │ Opening Balance:          15,000.00  (from yesterday)     ││
│ 👤 Ahmed│  │ + Top-ups:                +5,000.00  (1 top-up)           ││
│  Logout │  │ - Reload Sales:           -8,500.00  (from daily entry)   ││
│         │  │ ────────────────────────────────────                      ││
│         │  │ Expected Closing:         11,500.00                       ││
│         │  │ Actual Closing:           11,400.00  (from daily entry)   ││
│         │  │ Variance:                   -100.00  ⚠️                   ││
│         │  └───────────────────────────────────────────────────────────┘│
│         │                                                               │
│         │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│         │                                                               │
│         │  TOP-UP HISTORY                                               │
│         │  ┌───────────────────────────────────────────────────────────┐│
│         │  │ Date    │ Amount   │ Source    │ Notes        │ Action   ││
│         │  ├─────────┼──────────┼───────────┼──────────────┼──────────┤│
│         │  │ Jan 24  │ +5,000   │ 💵 Cash   │              │   [🗑]   ││
│         │  │ Jan 22  │ +5,000   │ 🏦 Bank   │ Bank transfer│   [🗑]   ││
│         │  │ Jan 20  │ +3,000   │ 💵 Cash   │              │   [🗑]   ││
│         │  │ Jan 18  │ +5,000   │ 🏦 Bank   │              │   [🗑]   ││
│         │  │ Jan 15  │ +5,000   │ 💵 Cash   │ Urgent topup │   [🗑]   ││
│         │  │ ...     │ ...      │ ...       │ ...          │   ...    ││
│         │  └───────────────────────────────────────────────────────────┘│
│         │                                                               │
│         │  MONTHLY TOP-UP SUMMARY                                       │
│         │  ┌───────────────────────────────────────────────────────────┐│
│         │  │ Source     │ Count │ Total                                ││
│         │  ├────────────┼───────┼──────────                            ││
│         │  │ 💵 Cash    │   10  │ MVR 45,000                           ││
│         │  │ 🏦 Bank    │    7  │ MVR 40,000                           ││
│         │  └───────────────────────────────────────────────────────────┘│
│         │                                                               │
└─────────┴───────────────────────────────────────────────────────────────┘
```

---

### Add Wallet Top-up Dialog

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Add Wallet Top-up                                                  [X]  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Date *                                                                 │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ 📅 Jan 24, 2026                                             ▼   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Amount (MVR) *                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ 5,000.00                                                        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Source *                                                               │
│  ● Cash (from drawer)    ○ Bank Transfer                                │
│                                                                         │
│  Notes (optional)                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                                                                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ℹ️ If source is Cash, this will be deducted from cash drawer.         │
│  ℹ️ If source is Bank, a bank withdrawal will be recorded.             │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                            [ Cancel ]  [ Add Top-up ]   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 7) Daily Sales Entry – Exact Structure

### Grid Layout

#### DHIRAAGU BILLS (with Credit)

| | Cash | Transfer | Credit (read-only) |
|---|------|----------|-------------------|
| Consumer | Input | Input | Auto from credit section |
| Corporate | Input | Input | Auto from credit section |

#### RETAIL RELOAD (no Credit)

| | Cash | Transfer |
|---|------|----------|
| Consumer | Input | Input |
| Corporate | Input | Input |

#### WHOLESALE RELOAD (no Credit)

| | Cash | Transfer |
|---|------|----------|
| Consumer | Input | Input |
| Corporate | Input | Input |

#### SIM (no Credit) + Quantity

| | Cash | Transfer | Quantity |
|---|------|----------|----------|
| Consumer | Input | Input | (single field) |
| Corporate | Input | Input | shared ↑ |

#### USIM (no Credit) + Quantity

| | Cash | Transfer | Quantity |
|---|------|----------|----------|
| Consumer | Input | Input | (single field) |
| Corporate | Input | Input | shared ↑ |

### Credit Sales Section

- Table with: Customer, Type (auto from customer), Amount, Reference, Delete
- [+ Add Credit Sale] button → opens dialog
- Consumer Credit Total (auto-sum)
- Corporate Credit Total (auto-sum)
- Balance indicator: ✓ Balanced / ⚠️ Unbalanced

### Cash Drawer Section

| Field | Type |
|-------|------|
| Opening Balance | Input |
| Expected Closing | Calculated |
| Actual Closing | Input |
| Variance | Calculated (with warning/block logic) |
| Bank Deposits Today | Input |

### Reload Wallet Section

| Field | Type |
|-------|------|
| Opening Balance | Auto from previous day (or input first time) |
| Top-ups Today | Sum of today's top-ups |
| Reload Sales Used | Auto-calculated from Retail + Wholesale Reload |
| Expected Closing | Calculated |
| Actual Closing | Input |
| Variance | Calculated (with warning/block logic) |

### Notes Section

- Free text area

### Summary Section

- Revenue by Payment Method (Cash, Transfer, Credit)
- Revenue by Customer Type (Consumer, Corporate)
- Grand Total

---

## 8) Data Definition Per Screen

### Login

| Data | Type | Source |
|------|------|--------|
| Username | Entered | User input |
| Password | Entered | User input |
| Session token | Generated | System |
| User role | Retrieved | Database |

### Dashboard

| Data | Type | Source |
|------|------|--------|
| Today's revenue | Calculated | Daily entry |
| Cash in hand | Calculated | Daily entry |
| Bank balance | Calculated | Bank ledger |
| Credit outstanding | Calculated | Credit customers |
| Alerts | Calculated | Various sources |
| Unverified days count | Calculated | Day verification status |
| Recent activity | Retrieved | Audit log |
| Revenue breakdown | Calculated | Daily entry |

### Daily Entry

| Data | Type | Source |
|------|------|--------|
| Date | Entered/Selected | User input |
| Category amounts (Cash, Transfer) | Entered | User input |
| Credit amounts | Calculated | Credit section |
| Credit sales list | Entered | User via dialog |
| SIM/USIM quantities | Entered | User input |
| Cash drawer opening | Entered | User input |
| Cash drawer actual closing | Entered | User input |
| Cash drawer expected | Calculated | Opening + Cash sales + Cash settlements - Bank deposits - Cash top-ups |
| Cash variance | Calculated | Actual - Expected |
| Bank deposits | Entered | User input |
| Wallet opening | Auto/Entered | Previous day's actual closing (or input first time) |
| Wallet top-ups | Linked | From wallet top-ups |
| Wallet reload used | Calculated | Retail + Wholesale reload totals |
| Wallet actual closing | Entered | User input |
| Wallet expected | Calculated | Opening + Top-ups - Reload used |
| Wallet variance | Calculated | Actual - Expected |
| Notes | Entered | User input |
| Status | System | Draft/Submitted |
| Submitted by | System | Current user |
| Submitted at | System | Timestamp |

### Day Detail

| Data | Type | Source |
|------|------|--------|
| Manual entry data | Retrieved | Daily entry |
| Telco screenshot | Retrieved | Uploaded image |
| Screenshot uploaded by | Retrieved | Upload metadata |
| Screenshot uploaded at | Retrieved | Upload metadata |
| Verification status | Retrieved | Verification record |
| Verified by | Retrieved | Verification record |
| Verified at | Retrieved | Verification record |
| Verification notes | Entered | User input |

### Monthly Summary

| Data | Type | Source |
|------|------|--------|
| Total revenue | Calculated | Sum of daily entries |
| Average daily | Calculated | Total / days with entries |
| Days complete | Calculated | Count of submitted days |
| Revenue by payment method | Calculated | Aggregate daily entries |
| Revenue by customer type | Calculated | Aggregate daily entries |
| Revenue by category | Calculated | Aggregate daily entries |
| Daily breakdown | Retrieved | Daily entries |
| SIM/USIM totals | Calculated | Sum quantities |
| Variance summary | Calculated | Aggregate variances |

### Bank Ledger

| Data | Type | Source |
|------|------|--------|
| Opening balance | Entered | Initial setup |
| Transactions | Entered | User via dialog |
| Running balance | Calculated | Opening + Deposits - Withdrawals |
| Monthly totals | Calculated | Aggregate by month |

### Credit Customers

| Data | Type | Source |
|------|------|--------|
| Customer info | Entered | Registration |
| Credit limit | Entered | Registration |
| Outstanding balance | Calculated | Credit sales - Settlements |
| Transaction history | Retrieved/Calculated | Credit sales + Settlements |
| Last activity date | Calculated | Most recent transaction |

### Reload Wallet

| Data | Type | Source |
|------|------|--------|
| Current balance | Calculated | Latest daily entry actual closing |
| Top-ups | Entered | User via dialog |
| Monthly top-up totals | Calculated | Aggregate by source |
| Daily activity | Calculated | From daily entries |

---

## 9) Telco File Import Rules

### Format

- **Type:** JPG/PNG screenshot (image file)
- **Purpose:** Reference document for visual verification
- **NOT:** Structured data file (CSV/XLSX) - no automatic parsing

### Upload Rules

| Rule | Details |
|------|---------|
| Supported formats | JPG, JPEG, PNG |
| Max file size | 10 MB |
| Storage | Linked to specific date |
| Replace | Can replace existing screenshot |
| Delete | Owner only can delete |
| Required | **Yes** - must be uploaded same day (end of day) |
| Timing | Same day as daily entry, typically end of day |

### Workflow

1. **Daily Entry First:** Sales staff enters data manually and submits
2. **Upload Screenshot:** Owner/Accountant uploads telco report screenshot for the date
3. **Visual Verification:** Owner/Accountant compares screenshot with manual entry
4. **Mark Verified:** Check verification box, add notes if any discrepancy

### Verification Status

| Status | Meaning |
|--------|---------|
| No Screenshot | Screenshot not yet uploaded (INCOMPLETE) |
| Uploaded, Not Verified | Screenshot uploaded but not reviewed |
| Verified | Manual comparison done, checkbox checked (COMPLETE) |
| Verified with Notes | Verified but discrepancy noted (COMPLETE) |

### Day Completion Status

A day is considered **COMPLETE** only when:
1. Daily entry is submitted
2. Telco screenshot is uploaded (required same day)
3. Screenshot is verified (checkbox checked)

A day is **INCOMPLETE** if any of the above is missing.

### Dashboard Alerts

Dashboard shows these alerts for Owner/Accountant:

| Alert | Trigger | Priority |
|-------|---------|----------|
| "X days not submitted" | Daily entry not submitted | High |
| "X days missing screenshot" | Entry submitted but no screenshot | High |
| "X days not verified" | Screenshot uploaded but not verified | Medium |
| "Cash variance > MVR 500 on [date]" | Hard block variance | High |
| "X credit customers overdue" | Outstanding > 30 days | Medium |

---

## 10) Key Calculations

### Daily Revenue

```
Daily Revenue = Sum of all categories (Cash + Transfer + Credit)
             = Dhiraagu Bills (all) + Retail Reload (all) + Wholesale Reload (all)
               + SIM (all) + USIM (all)
```

### Monthly Revenue

```
Monthly Revenue = Sum of Daily Revenue for all days in month
```

### Revenue by Payment Method

```
Total Cash     = Sum of all Cash columns across all categories
Total Transfer = Sum of all Transfer columns across all categories
Total Credit   = Sum of Credit section (Consumer + Corporate)
```

### Revenue by Customer Type

```
Total Consumer  = Sum of all Consumer rows across all categories and payment methods
Total Corporate = Sum of all Corporate rows across all categories and payment methods
```

### Credit Outstanding (per customer)

```
Outstanding = Sum of Credit Sales - Sum of Settlements
```

### Credit Outstanding (total)

```
Total Outstanding = Sum of all customer Outstanding balances
```

### Bank Running Balance

```
Current Balance = Opening Balance + Sum of Deposits - Sum of Withdrawals
```

### Reload Wallet Balance

```
Wallet Closing (Expected) = Opening Balance + Top-ups - Reload Sales Used

Where:
  Reload Sales Used = Retail Reload (Consumer Cash + Consumer Transfer
                      + Corporate Cash + Corporate Transfer)
                    + Wholesale Reload (Consumer Cash + Consumer Transfer
                      + Corporate Cash + Corporate Transfer)
```

### Wallet Variance

```
Wallet Variance = Actual Closing - Expected Closing

Validation:
- If variance ≠ 0 and ≤ MVR 500: WARNING (can submit with confirmation)
- If variance > MVR 500: HARD BLOCK (must balance)
```

### Cash Drawer Expected Closing

```
Expected Closing = Opening Balance
                 + Total Cash Sales (all categories)
                 + Cash Settlements Received (credit customers paying in cash)
                 - Bank Deposits
                 - Wallet Top-ups from Cash
```

### Cash Drawer Variance

```
Cash Variance = Actual Closing - Expected Closing

Validation:
- If variance ≠ 0 and ≤ MVR 500: WARNING (can submit with confirmation)
- If variance > MVR 500: HARD BLOCK (must balance)
```

### Settlement Impact

```
If settlement method = Cash:
  → Adds to Cash Drawer expected

If settlement method = Transfer:
  → Records as transfer received (no cash impact)
```

### Wallet Top-up Impact

```
If top-up source = Cash:
  → Deducts from Cash Drawer expected

If top-up source = Bank:
  → Records bank withdrawal (reduces bank balance)
```

### Credit Limit Check

```
If (Current Outstanding + New Credit Sale) > Credit Limit:
  → If user is Owner: Show override option
  → If user is not Owner: Block transaction, require Owner approval
```

---

## 11) Deliverables Checklist

### Before Coding Must Exist

#### Documentation

- [x] Requirement summary (this document)
- [x] User roles and permissions matrix
- [x] End-to-end workflows
- [x] Screen list with purposes
- [x] ASCII wireframes for all screens
- [x] Data definitions per screen
- [x] Calculation formulas
- [x] Telco screenshot upload rules
- [x] Variance validation rules

#### Templates & Test Data

- [ ] Sample Excel template (current manual tracking format)
- [ ] Sample telco report screenshot (JPG)
- [ ] Seed test data for:
  - 3 users (1 Owner, 1 Accountant, 1 Sales)
  - 5 credit customers (3 Consumer, 2 Corporate) with credit limits
  - 30 days of daily entries
  - 10 telco screenshots
  - 50 bank transactions
  - 30 wallet top-ups
  - Various variance scenarios

### Acceptance Criteria (per screen)

#### Login

- [ ] User can login with valid credentials
- [ ] Invalid credentials show error
- [ ] Session persists across page refresh
- [ ] Logout clears session
- [ ] Role is loaded and stored in session

#### Dashboard

- [ ] Shows today's summary cards
- [ ] Alerts display for:
  - [ ] Unsubmitted days
  - [ ] Missing screenshots (required)
  - [ ] Unverified screenshots
  - [ ] Cash/wallet variance > MVR 500
  - [ ] Overdue credit customers
- [ ] Alerts show count and are clickable to view details
- [ ] Quick actions navigate to correct screens
- [ ] Revenue breakdown shows correct totals
- [ ] Recent activity updates in real-time
- [ ] Navigation respects role permissions

#### Daily Entry

- [ ] Can select date (cannot select future dates)
- [ ] Grid shows correct structure per category (Credit only for Bills)
- [ ] Credit cells are read-only and auto-calculate from credit section
- [ ] Credit sales can be added via dialog
- [ ] Credit limit exceeded shows Owner approval requirement
- [ ] Credit section shows balance status
- [ ] Cannot submit if credit unbalanced (hard block)
- [ ] Cannot submit if variance > MVR 500 (hard block)
- [ ] Warning shown for any variance ≤ MVR 500
- [ ] Wallet opening auto-loads from previous day's actual closing
- [ ] Wallet calculations use correct formula
- [ ] Cash drawer calculations use correct formula
- [ ] Draft saves without validation
- [ ] Submit validates all required fields
- [ ] Submitted entry shows status badge

#### Day Detail

- [ ] Shows manual entry data summary
- [ ] Shows telco screenshot if uploaded
- [ ] Shows "Screenshot Required" indicator if not uploaded
- [ ] Can upload screenshot (Owner/Accountant only)
- [ ] Can view screenshot in full size modal
- [ ] Can replace screenshot
- [ ] Shows verification status
- [ ] Can mark as verified with checkbox
- [ ] Can add verification notes
- [ ] Shows who verified and when
- [ ] Shows day completion status (Complete/Incomplete)
- [ ] Incomplete days show clear indication of what's missing

#### Monthly Summary

- [ ] Month navigation works
- [ ] All totals calculate correctly
- [ ] Charts display correctly
- [ ] Daily breakdown shows all days
- [ ] Shows variance summary
- [ ] Export generates file

#### Bank Ledger

- [ ] Shows current balance
- [ ] Can add deposit (Owner/Accountant)
- [ ] Can add withdrawal (Owner/Accountant)
- [ ] Running balance calculates correctly
- [ ] Can filter by type and month
- [ ] Can set opening balance

#### Credit Customers

- [ ] Can register new customer (Owner/Accountant)
- [ ] Can set credit limit
- [ ] Can search customers
- [ ] Can filter by type
- [ ] Outstanding balance is correct
- [ ] Shows credit limit and usage
- [ ] Can view customer ledger
- [ ] Can record settlement (Owner/Accountant)
- [ ] Settlement cannot exceed outstanding
- [ ] Settlement updates balance immediately

#### Reload Wallet

- [ ] Shows current balance (from latest daily entry)
- [ ] Can add top-up (Owner/Accountant)
- [ ] Top-up source affects cash/bank correctly
- [ ] Monthly summary is correct
- [ ] Daily activity shows correctly

#### Settings

- [ ] User profile viewable
- [ ] Owner can manage users (add/edit/deactivate)
- [ ] Owner can reset passwords
- [ ] Data export works
- [ ] Data backup creates file
- [ ] Data clear requires confirmation (Owner only)

---

## 12) Design Decisions

### Confirmed Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Credit entry method | Hybrid (dedicated section + auto-calculated grid) | Single source of truth, handles 3-10 daily entries well |
| Credit cell behavior | Read-only, auto-calculated | Forces proper customer attribution |
| Credit only for | Dhiraagu Bills | Other categories (Reload, SIM, USIM) are cash/transfer only |
| Credit limit enforcement | Owner can override, others blocked | Maintains control while allowing flexibility |
| Variance warning threshold | Any variance > 0 | Staff should be aware of any discrepancy |
| Variance hard block | > MVR 500 | Prevents submission of significantly unbalanced days |
| Wallet opening balance | Auto carry-forward from previous day's actual | Reduces manual entry, maintains continuity |
| Telco report format | JPG/PNG screenshot | Source system generates images, not structured data |
| Telco report handling | Reference-only upload with visual verification | Simple to implement, image serves as audit trail |
| Telco screenshot required | **Yes** - must be uploaded same day | Critical for daily reconciliation and audit |
| Screenshot timing | Same day (end of day) | Available immediately after telco system closes |
| Unverified days alert | **Yes** - show on Dashboard | Owner/Accountant need visibility of incomplete days |
| Historical edit policy | Owner: any date, Accountant: last 7 days | Balances flexibility with control |

### Out of Scope (Future)

| Feature | Notes |
|---------|-------|
| OCR for screenshots | Could auto-extract values in future version |
| Multi-day telco reports | Assume daily reports only |
| Automated variance alerts | Email/SMS notifications |
| Mobile responsive design | Desktop-first for MVP |

---

## Summary

This document provides a complete MVP specification for enhancing BalanceX with:

- **Authentication & Roles:** Owner, Accountant, Sales with granular permissions
- **Credit Reconciliation:** Hybrid approach linking credit sales to customers, Owner override for limits
- **Simplified Grid:** Credit column only for Dhiraagu Bills, read-only and auto-calculated
- **Wallet Tracking:** Opening (auto from previous day) + Top-ups - Reload Sales = Expected Closing
- **Variance Validation:** Warning for any variance, hard block if > MVR 500
- **Telco Screenshots:** Reference-only upload with visual verification workflow

### Key Enhancements from Current App

1. Add authentication system with role-based permissions
2. Refactor daily entry to use dedicated credit section with customer linking
3. Add credit limit enforcement with Owner override
4. Add variance warning/blocking logic
5. Change telco import to screenshot upload with verification
6. Add Day Detail screen with screenshot viewer
7. Connect wallet calculations to reload sales
8. Auto carry-forward wallet opening balance

A developer can use this document to build the UI directly, with clear wireframes, data flows, and validation rules defined.

---

*Document generated for BalanceX MVP Enhancement*
*Version 1.2 - January 24, 2026*
