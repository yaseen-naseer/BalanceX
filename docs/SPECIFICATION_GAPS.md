# BalanceX MVP - Specification Gaps

**Last Updated:** January 25, 2026
**Cross-Check Against:** MVP_SPECIFICATION.md v1.2

This document lists gaps between the MVP specification and the current implementation, identified through systematic code review.

---

## Summary

| Priority | Count | Completed | Description |
|----------|-------|-----------|-------------|
| HIGH | 1 | 1 ✅ | Critical missing feature |
| MEDIUM | 6 | 6 ✅ | Should fix before production |
| LOW | 5 | 5 ✅ | Polish/enhancement items |
| **TOTAL** | **12** | **12** | **ALL COMPLETE** ✅ |

---

## HIGH Priority Gaps

### 1. Dashboard: Today's Breakdown Table ✅ COMPLETED

**Specification Reference:** Section 6B - Dashboard Wireframe (lines 497-505)

**Requirement:**
Dashboard should display a "TODAY'S BREAKDOWN" table showing revenue breakdown:

```
              │   Cash    │ Transfer │  Credit  │  TOTAL   │
├──────────────┼───────────┼──────────┼──────────┼──────────┤
│ Consumer     │   4,200   │   1,800  │    800   │   6,800  │
│ Corporate    │   3,500   │   1,650  │    500   │   5,650  │
├──────────────┼───────────┼──────────┼──────────┼──────────┤
│ TOTAL        │   7,700   │   3,450  │  1,300   │  12,450  │
```

**Status:** Implemented (January 25, 2026)

**Implementation:**
- ✅ API returns `todayBreakdown` object with Consumer/Corporate × Cash/Transfer/Credit matrix
- ✅ Added `TodayBreakdownTable` component to dashboard
- ✅ Shows "No sales recorded today" when no data
- ✅ Visible to both Sales users and Owner/Accountant
- ✅ Added `TodayBreakdown` type to types/index.ts

**Files Modified:**
- `src/app/api/dashboard/route.ts` - Added breakdown calculation
- `src/app/(dashboard)/page.tsx` - Added TodayBreakdownTable component
- `src/types/index.ts` - Added TodayBreakdown interface

---

## MEDIUM Priority Gaps

### 2. Dashboard: Cash in Hand Card ✅ COMPLETED

**Specification Reference:** Section 6B - Dashboard Wireframe (line 481)

**Requirement:**
Dashboard should show 4 summary cards:
1. Today's Revenue ✓
2. **Cash in Hand** ✓
3. Bank Balance ✓
4. Credit Outstanding ✓

**Status:** Implemented (January 25, 2026)

**Implementation:**
- ✅ API calculates cash in hand from today's cash drawer
- ✅ If day is submitted: shows actual closing amount
- ✅ If day is draft: shows opening + cash sales - bank deposits
- ✅ Added Cash in Hand card with Banknote icon
- ✅ Shows "No entry today" when no daily entry exists
- ✅ Hidden from Sales users (financial data)

**Files Modified:**
- `src/app/api/dashboard/route.ts` - Added cashInHand calculation
- `src/app/(dashboard)/page.tsx` - Replaced Month Revenue with Cash in Hand card
- `src/types/index.ts` - Added cashInHand to DashboardSummary

---

### 3. Daily Entry: Cash Expected Formula Mismatch ✅ COMPLETED

**Specification Reference:** Section 10 - Key Calculations (lines 1577-1585)

**Requirement:**
```
Cash Expected Closing = Opening Balance
                      + Total Cash Sales (all categories)
                      + Cash Settlements Received
                      - Bank Deposits
                      - Wallet Top-ups from Cash
```

**Status:** Implemented (January 25, 2026)

**Implementation:**
- ✅ API GET endpoint now returns `calculationData` with `cashSettlements` and `walletTopupsFromCash` totals
- ✅ Hook updated to include `calculationData` in return value
- ✅ Frontend formula updated to match backend:
  ```typescript
  cashExpected = opening + cashSales + cashSettlements - bankDeposits - walletTopupsFromCash
  ```
- ✅ Frontend and backend now use identical calculation

**Files Modified:**
- `src/app/api/daily-entries/[date]/route.ts` - Added calculationData to GET response
- `src/hooks/use-daily-entry.ts` - Added CalculationData interface and state
- `src/app/(dashboard)/daily-entry/page.tsx` - Updated cashExpected formula

---

### 4. Credit Customers: Type Filter Missing ✅ COMPLETED

**Specification Reference:** Section 6G - Credit Customers Wireframe (line 1019)

**Requirement:**
```
Filter: [All ▼]  Sort: [Outstanding (High-Low) ▼]
```

**Status:** Implemented (January 25, 2026)

**Implementation:**
- ✅ Added `typeFilter` state with options: ALL, CONSUMER, CORPORATE
- ✅ Added Select dropdown next to search input
- ✅ Filter is applied to customer list along with search query
- ✅ Shows "All Types", "Consumer", "Corporate" options

**Files Modified:**
- `src/app/(dashboard)/credit/page.tsx` - Added type filter dropdown and filtering logic

---

### 5. Bank Ledger: Month/Type Filter UI ✅ COMPLETED

**Specification Reference:** Section 6F - Bank Ledger Wireframe (line 934)

**Requirement:**
```
Filter: [All Types ▼]  [Jan 2026 ▼]
```

**Status:** Implemented (January 25, 2026)

**Implementation:**
- ✅ Added `typeFilter` state with options: ALL, DEPOSIT, WITHDRAWAL
- ✅ Added `monthFilter` state with last 12 months as options
- ✅ Type filter dropdown shows "All Types", "Deposits", "Withdrawals"
- ✅ Month filter dropdown shows months like "Jan 2026", "Dec 2025", etc.
- ✅ Transactions table filters based on both selected filters
- ✅ Running balance calculation uses all transactions for accuracy, then filters display
- ✅ Summary cards still show current month totals for consistency

**Files Modified:**
- `src/app/(dashboard)/bank/page.tsx` - Added Select imports, filter state, filter UI, and filtering logic

---

### 6. Wallet: Monthly Usage Metrics ✅ COMPLETED

**Specification Reference:** Section 6H - Reload Wallet Wireframe (lines 1177-1182)

**Requirement:**
Summary cards should show:
1. Current Balance ✓
2. This Month Top-ups ✓
3. **This Month Usage** ✓

**Status:** Implemented (January 25, 2026)

**Implementation:**
- ✅ API calculates monthly usage from daily entries (Retail Reload + Wholesale Reload)
- ✅ Added `monthlyUsage` to wallet API response
- ✅ Added `monthlyUsage` state to useWallet hook
- ✅ Replaced "From Cash" and "From Bank" cards with "This Month Usage" card
- ✅ Shows usage in red with minus sign (e.g., "-5,000 MVR")
- ✅ Includes helper text "Retail + Wholesale Reload Sales"
- ✅ Summary now shows 3 cards: Top-ups, Usage, Current Balance

**Files Modified:**
- `src/app/api/wallet/route.ts` - Added monthly reload sales calculation
- `src/hooks/use-wallet.ts` - Added monthlyUsage to state and return
- `src/app/(dashboard)/wallet/page.tsx` - Updated summary cards UI

---

### 7. Reports: SIM/USIM Quantities in Daily Breakdown ✅ COMPLETED

**Specification Reference:** Section 6E - Monthly Summary Wireframe (lines 889-898)

**Requirement:**
Daily breakdown table should include:
```
│ Date │ Cash    │Transfer│Credit │ Total  │ SIM │USIM│Stat│
```

**Status:** Implemented (January 25, 2026)

**Implementation:**
- ✅ API now extracts SIM and USIM quantities for each daily entry
- ✅ Added `simQuantity` and `usimQuantity` to daily breakdown response
- ✅ Updated `DailyBreakdown` interface in use-reports hook
- ✅ Added SIM and USIM columns to daily breakdown table
- ✅ Shows "-" when quantity is 0 for cleaner display
- ✅ Total row shows monthly totals for SIM and USIM
- ✅ CSV export updated to include SIM and USIM columns

**Files Modified:**
- `src/app/api/reports/route.ts` - Added simQuantity and usimQuantity to daily breakdown
- `src/hooks/use-reports.ts` - Added fields to DailyBreakdown interface
- `src/app/(dashboard)/reports/page.tsx` - Added columns to table and CSV export

---

## LOW Priority Gaps

### 8. Day Detail: Step-by-Step Reconciliation ✅ COMPLETED

**Specification Reference:** Section 6D - Day Detail Wireframe (lines 794-799)

**Requirement:**
```
RECONCILIATION
│ Cash Drawer:  Expected 5,200 | Actual 5,250 | Var +50 ⚠️ │
│ Wallet:       Expected 11,500| Actual 11,400| Var -100 ⚠️│
│ Bank Deposit: MVR 2,000                                   │
```

**Status:** Implemented (January 26, 2026)

**Implementation:**
- ✅ Added summary RECONCILIATION card matching spec wireframe format
- ✅ Shows Cash Drawer: Expected | Actual | Variance with warning indicator
- ✅ Shows Wallet: Expected | Actual | Variance with warning indicator
- ✅ Shows Bank Deposit amount when deposits exist
- ✅ Added detailed Calculation Breakdown section showing step-by-step formulas:
  - Cash Drawer: Opening + Cash Sales + Cash Settlements - Bank Deposits - Wallet Top-ups = Expected
  - Wallet: Opening + Top-ups - Reload Sales = Expected
- ✅ Color-coded calculation steps (green for additions, red for deductions, blue for bank)
- ✅ Uses calculationData from API for accurate cashSettlements and walletTopupsFromCash values
- ✅ Uses useWallet hook to get top-ups for the selected date

**Files Modified:**
- `src/app/(dashboard)/day-detail/page.tsx` - Added reconciliation summary card and calculation breakdown

---

### 9. Day Detail: Wallet Top-ups List ✅ COMPLETED

**Specification Reference:** Section 7 - Daily Sales Entry Structure (lines 1318-1327)

**Requirement:**
Day detail should show wallet top-ups that occurred on that day.

**Status:** Implemented (January 26, 2026)

**Implementation:**
- ✅ Added Wallet Top-ups section to day-detail page
- ✅ Shows list of all top-ups for the selected date
- ✅ Each top-up displays source (CASH/BANK badge), notes if any, and amount
- ✅ Shows total top-ups amount at the bottom with separator
- ✅ Uses `getTopupsByDate` from useWallet hook to get filtered list
- ✅ Amounts displayed in green with + prefix to indicate additions

**Files Modified:**
- `src/app/(dashboard)/day-detail/page.tsx` - Added Wallet Top-ups section

---

### 10. Credit Customers: Consumer/Corporate Outstanding Split ✅ COMPLETED

**Specification Reference:** Section 6G - Credit Customers Wireframe (lines 1006-1011)

**Requirement:**
Summary cards should show:
1. Total Outstanding ✓
2. **Consumer Outstanding** ✓
3. **Corporate Outstanding** ✓

**Status:** Implemented (January 26, 2026)

**Implementation:**
- ✅ Added `consumerOutstanding` and `corporateOutstanding` calculations
- ✅ Updated summary cards to show 3 cards: Total Outstanding, Consumer Outstanding, Corporate Outstanding
- ✅ Each card shows the outstanding amount and count of customers of that type
- ✅ Color-coded cards: Rose for total (when > 0), Amber for consumer, Blue for corporate
- ✅ Green text when no outstanding balance, colored text when there is a balance
- ✅ Helper text shows customer count (e.g., "5 consumers", "3 corporates")

**Files Modified:**
- `src/app/(dashboard)/credit/page.tsx` - Updated calculations and summary cards

---

### 11. Wallet: Today's Activity Summary ✅ COMPLETED

**Specification Reference:** Section 6H - Reload Wallet Wireframe (lines 1188-1197)

**Requirement:**
```
TODAY'S WALLET ACTIVITY
│ Opening Balance:          15,000.00  (from yesterday)     │
│ + Top-ups:                +5,000.00  (1 top-up)           │
│ - Reload Sales:           -8,500.00  (from daily entry)   │
│ Expected Closing:         11,500.00                       │
│ Actual Closing:           11,400.00  (from daily entry)   │
│ Variance:                   -100.00  ⚠️                   │
```

**Status:** Implemented (January 26, 2026)

**Implementation:**
- ✅ Added "Today's Wallet Activity" card to wallet page
- ✅ Shows Opening Balance with source (from yesterday/initial setup)
- ✅ Shows + Top-ups with count (e.g., "2 top-ups")
- ✅ Shows - Reload Sales calculated from daily entry categories
- ✅ Shows Expected Closing from daily entry wallet data
- ✅ Shows Actual Closing from daily entry wallet data
- ✅ Shows Variance with color-coded background:
  - Green background with checkmark when variance is 0
  - Amber background with warning for small variance (≤500)
  - Rose background with warning for high variance (>500)
- ✅ Shows empty state when no daily entry exists for today
- ✅ Uses useDailyEntry hook to fetch today's wallet data

**Files Modified:**
- `src/app/(dashboard)/wallet/page.tsx` - Added Today's Wallet Activity section

---

### 12. Reports: Credit Outstanding Summary Card ✅ COMPLETED

**Specification Reference:** Section 6E - Monthly Summary Wireframe (lines 852-857)

**Requirement:**
Summary cards should include "Credit Outstanding" card.

**Status:** Implemented (January 26, 2026)

**Implementation:**
- ✅ Replaced "Cash Variance" card with "Credit Outstanding" card
- ✅ Shows total outstanding amount from all credit aging buckets (Current + 30+ + 60+ + 90+ days)
- ✅ Shows count of customers with balance as subtitle
- ✅ Uses CreditCard icon to match the context
- ✅ Color-coded variant based on aging:
  - Red/danger when 60+ or 90+ days outstanding exists
  - Amber/warning when 30+ days outstanding exists
  - Default otherwise

**Files Modified:**
- `src/app/(dashboard)/reports/page.tsx` - Replaced Cash Variance card with Credit Outstanding card

---

## Implementation Priority Order

### Phase 1: Critical (1 item)
1. Dashboard: Today's Breakdown Table

### Phase 2: Important (6 items)
2. Dashboard: Cash in Hand Card
3. Daily Entry: Cash Expected Formula Fix
4. Credit: Type Filter Dropdown
5. Bank: Month/Type Filter UI
6. Wallet: Monthly Usage Metrics
7. Reports: SIM/USIM Quantity Columns

### Phase 3: Polish (5 items)
8. Day Detail: Reconciliation Breakdown
9. Day Detail: Wallet Top-ups List
10. Credit: Outstanding Split by Type
11. Wallet: Today's Activity Summary
12. Reports: Credit Outstanding Card

---

## Notes

- All gaps are UI/UX enhancements - core functionality is complete
- Backend data exists for most gaps, just needs API exposure
- No security or permission gaps identified
- All role-based access controls are properly implemented

---

*Document generated from cross-check analysis on January 25, 2026*
