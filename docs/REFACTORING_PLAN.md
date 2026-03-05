# BalanceX Codebase Refactoring Plan

**Created:** January 31, 2026
**Status:** ✅ COMPLETE
**Total Estimated Phases:** 5
**Last Updated:** January 31, 2026 (All Phases Complete)

---

## Executive Summary

The BalanceX codebase audit revealed **15,991 lines of code** across 82 files with significant architectural issues:

- **14 files exceed 300 lines** (recommended max for maintainability)
- **1 file exceeds 1,200 lines** (daily-entry page - critical)
- **70% boilerplate duplication** across hooks
- **26 React hooks** in a single component
- **Missing abstraction layers** for common patterns

This document outlines a phased approach to refactor the codebase following professional system design practices.

---

## Current State Analysis

### Critical Files Requiring Immediate Attention

| File | Lines | Priority | Issue |
|------|-------|----------|-------|
| `daily-entry/page.tsx` | 1,240 | P0 | God component, 26 hooks, 9 inline dialogs |
| `day-detail/page.tsx` | 870 | P1 | Multiple sections need extraction |
| `settings/page.tsx` | 799 | P1 | User management + data export combined |
| `credit/page.tsx` | 730 | P2 | Large page component |
| `bank/page.tsx` | 713 | P2 | Large page component |
| `reports/page.tsx` | 650 | P2 | Large page component |
| `wallet/page.tsx` | 522 | P2 | Large page component |
| `api/daily-entries/[date]/route.ts` | 523 | P2 | Complex API route |
| `api/dashboard/route.ts` | 505 | P2 | Mixed concerns |
| `credit-sale-dialog.tsx` | 497 | P2 | Oversized dialog component |

### Anti-Patterns Identified

1. **God Component Pattern** - Single components handling too many responsibilities
2. **Boilerplate Duplication** - Same loading/error patterns repeated 35+ times
3. **Inline Component Definitions** - Components defined inside page files
4. **Missing Abstraction Layers** - No shared hooks for common operations
5. **Mixed Concerns in API Routes** - Business logic mixed with HTTP handling

---

## Phase 1: Foundation - Create Shared Hooks

**Goal:** Eliminate boilerplate duplication by creating reusable hooks
**Impact:** Reduces ~2,000 lines of duplicated code
**Files to Create:** 4 new hooks

### Task 1.1: Create `useAsyncOperation` Hook

**Purpose:** Replace repeated loading/error state management pattern

**Current Pattern (repeated 35+ times):**
```typescript
const [isLoading, setIsLoading] = useState(false)
const [error, setError] = useState<string | null>(null)

const someOperation = async () => {
  setIsLoading(true)
  setError(null)
  try {
    // ... operation
  } catch (err) {
    setError("Error message")
  } finally {
    setIsLoading(false)
  }
}
```

**New Hook:**
```typescript
// src/hooks/use-async-operation.ts
export function useAsyncOperation<T>() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<T | null>(null)

  const execute = useCallback(async (
    operation: () => Promise<T>,
    options?: { onSuccess?: (data: T) => void; onError?: (error: string) => void }
  ) => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await operation()
      setData(result)
      options?.onSuccess?.(result)
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred"
      setError(message)
      options?.onError?.(message)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  const reset = useCallback(() => {
    setIsLoading(false)
    setError(null)
    setData(null)
  }, [])

  return { isLoading, error, data, execute, reset }
}
```

**Location:** `src/hooks/use-async-operation.ts`
**Lines:** ~50

---

### Task 1.2: Create `useApiClient` Hook

**Purpose:** Unified API client with consistent error handling

**New Hook:**
```typescript
// src/hooks/use-api-client.ts
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export function useApiClient() {
  const request = useCallback(async <T>(
    url: string,
    options?: RequestInit
  ): Promise<ApiResponse<T>> => {
    try {
      const response = await fetch(url, {
        headers: { "Content-Type": "application/json" },
        ...options,
      })
      const data = await response.json()
      return data
    } catch (err) {
      return { success: false, error: "Network error" }
    }
  }, [])

  const get = useCallback(<T>(url: string) =>
    request<T>(url), [request])

  const post = useCallback(<T>(url: string, body: unknown) =>
    request<T>(url, { method: "POST", body: JSON.stringify(body) }), [request])

  const put = useCallback(<T>(url: string, body: unknown) =>
    request<T>(url, { method: "PUT", body: JSON.stringify(body) }), [request])

  const del = useCallback(<T>(url: string) =>
    request<T>(url, { method: "DELETE" }), [request])

  return { get, post, put, delete: del, request }
}
```

**Location:** `src/hooks/use-api-client.ts`
**Lines:** ~60

---

### Task 1.3: Create `useDialogState` Hook

**Purpose:** Manage dialog open/close state with data

**New Hook:**
```typescript
// src/hooks/use-dialog-state.ts
export function useDialogState<T = undefined>() {
  const [isOpen, setIsOpen] = useState(false)
  const [data, setData] = useState<T | undefined>(undefined)

  const open = useCallback((initialData?: T) => {
    setData(initialData)
    setIsOpen(true)
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
    setData(undefined)
  }, [])

  return { isOpen, data, open, close, setData }
}
```

**Location:** `src/hooks/use-dialog-state.ts`
**Lines:** ~25

---

### Task 1.4: Create `useFormField` Hook

**Purpose:** Manage form field state with validation

**New Hook:**
```typescript
// src/hooks/use-form-field.ts
export function useFormField<T>(initialValue: T, validator?: (value: T) => string | null) {
  const [value, setValue] = useState<T>(initialValue)
  const [error, setError] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)

  const handleChange = useCallback((newValue: T) => {
    setValue(newValue)
    if (touched && validator) {
      setError(validator(newValue))
    }
  }, [touched, validator])

  const handleBlur = useCallback(() => {
    setTouched(true)
    if (validator) {
      setError(validator(value))
    }
  }, [validator, value])

  const reset = useCallback(() => {
    setValue(initialValue)
    setError(null)
    setTouched(false)
  }, [initialValue])

  return { value, error, touched, handleChange, handleBlur, reset, setValue }
}
```

**Location:** `src/hooks/use-form-field.ts`
**Lines:** ~35

---

### Task 1.5: Update Hook Exports

**File:** `src/hooks/index.ts`

```typescript
export * from "./use-async-operation"
export * from "./use-api-client"
export * from "./use-dialog-state"
export * from "./use-form-field"
export * from "./use-auth"
export * from "./use-bank"
export * from "./use-credit-customers"
export * from "./use-daily-entry"
export * from "./use-dashboard"
export * from "./use-reports"
export * from "./use-wallet"
```

---

### Phase 1 Checklist

- [x] Create `src/hooks/use-async-operation.ts` ✅ (100 lines)
- [x] Create `src/hooks/use-api-client.ts` ✅ (165 lines)
- [x] Create `src/hooks/use-dialog-state.ts` ✅ (130 lines)
- [x] Create `src/hooks/use-form-field.ts` ✅ (270 lines)
- [x] Update `src/hooks/index.ts` exports ✅
- [ ] Write unit tests for new hooks (deferred to later)
- [x] Verify build passes ✅

**Phase 1 Status:** ✅ COMPLETED (January 31, 2026)

**Actual Lines Added:** ~665 lines (more comprehensive than planned)
**Features Implemented:**
- `useAsyncOperation` - Loading/error state management with execute/reset
- `useApiClient` - Unified API client with get/post/put/patch/delete methods
- `useDialogState` - Single dialog state management with data support
- `useMultiDialogState` - Multiple dialog management (bonus)
- `useFormField` - Form field with validation, touched, dirty states
- `useForm` - Multi-field form management (bonus)
- `validators` - Common validation functions (bonus)

**Estimated Lines to be Removed (in future phases):** ~1,500

---

## Phase 2: Extract Shared Components

**Goal:** Create reusable components used across multiple pages
**Impact:** Reduces duplication, improves consistency
**Files to Create:** 5 new components

### Task 2.1: Create `CurrencyInput` Component

**Extract from:** `daily-entry/page.tsx` (lines 91-124)

**New Component:**
```typescript
// src/components/shared/currency-input.tsx
"use client"

import { Input } from "@/components/ui/input"
import { useCallback } from "react"

interface CurrencyInputProps {
  value: number
  onChange: (value: number) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function CurrencyInput({
  value,
  onChange,
  placeholder = "0",
  disabled = false,
  className,
}: CurrencyInputProps) {
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9.]/g, "")
    const num = parseFloat(raw) || 0
    onChange(num)
  }, [onChange])

  const formatDisplay = useCallback((num: number) => {
    if (num === 0) return ""
    return num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  }, [])

  return (
    <Input
      type="text"
      inputMode="decimal"
      value={formatDisplay(value)}
      onChange={handleChange}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
    />
  )
}
```

**Location:** `src/components/shared/currency-input.tsx`
**Lines:** ~45

---

### Task 2.2: Create `ConfirmDialog` Component

**Purpose:** Reusable confirmation dialog for delete/submit actions

**New Component:**
```typescript
// src/components/shared/confirm-dialog.tsx
"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: "default" | "destructive"
  onConfirm: () => void
  onCancel?: () => void
  isLoading?: boolean
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
  isLoading = false,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel} disabled={isLoading}>
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isLoading}
            className={variant === "destructive" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
          >
            {isLoading ? "Processing..." : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

**Location:** `src/components/shared/confirm-dialog.tsx`
**Lines:** ~60

---

### Task 2.3: Create `DataTable` Component

**Purpose:** Reusable table with sorting, filtering, pagination

**New Component:**
```typescript
// src/components/shared/data-table.tsx
"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"

interface Column<T> {
  key: keyof T | string
  header: string
  render?: (item: T) => React.ReactNode
  className?: string
}

interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  isLoading?: boolean
  emptyMessage?: string
  onRowClick?: (item: T) => void
}

export function DataTable<T extends { id: string }>({
  data,
  columns,
  isLoading = false,
  emptyMessage = "No data found",
  onRowClick,
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {emptyMessage}
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((col) => (
            <TableHead key={String(col.key)} className={col.className}>
              {col.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((item) => (
          <TableRow
            key={item.id}
            onClick={() => onRowClick?.(item)}
            className={onRowClick ? "cursor-pointer hover:bg-muted" : ""}
          >
            {columns.map((col) => (
              <TableCell key={String(col.key)} className={col.className}>
                {col.render
                  ? col.render(item)
                  : String(item[col.key as keyof T] ?? "")}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

**Location:** `src/components/shared/data-table.tsx`
**Lines:** ~80

---

### Task 2.4: Create `StatCard` Component

**Purpose:** Reusable statistics card for dashboards

**New Component:**
```typescript
// src/components/shared/stat-card.tsx
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { LucideIcon } from "lucide-react"

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: LucideIcon
  trend?: {
    value: number
    label?: string
  }
  variant?: "default" | "success" | "warning" | "danger"
  className?: string
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = "default",
  className,
}: StatCardProps) {
  const variantStyles = {
    default: "",
    success: "border-green-200 bg-green-50",
    warning: "border-amber-200 bg-amber-50",
    danger: "border-red-200 bg-red-50",
  }

  const trendColor = trend?.value && trend.value > 0
    ? "text-green-600"
    : trend?.value && trend.value < 0
      ? "text-red-600"
      : "text-muted-foreground"

  return (
    <Card className={cn(variantStyles[variant], className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
        {trend && (
          <p className={cn("text-xs mt-1", trendColor)}>
            {trend.value > 0 ? "+" : ""}{trend.value.toFixed(1)}%
            {trend.label && ` ${trend.label}`}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
```

**Location:** `src/components/shared/stat-card.tsx`
**Lines:** ~65

---

### Task 2.5: Create `LoadingState` Component

**Purpose:** Consistent loading state across pages

**New Component:**
```typescript
// src/components/shared/loading-state.tsx
"use client"

import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface LoadingStateProps {
  message?: string
  fullPage?: boolean
  className?: string
}

export function LoadingState({
  message = "Loading...",
  fullPage = false,
  className,
}: LoadingStateProps) {
  const content = (
    <div className={cn("flex flex-col items-center justify-center gap-2", className)}>
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )

  if (fullPage) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        {content}
      </div>
    )
  }

  return content
}
```

**Location:** `src/components/shared/loading-state.tsx`
**Lines:** ~35

---

### Task 2.6: Create Shared Components Index

**File:** `src/components/shared/index.ts`

```typescript
export * from "./currency-input"
export * from "./confirm-dialog"
export * from "./data-table"
export * from "./stat-card"
export * from "./loading-state"
```

---

### Phase 2 Checklist

- [x] Create `src/components/shared/` directory ✅
- [x] Create `currency-input.tsx` ✅ (~250 lines)
- [x] Create `confirm-dialog.tsx` ✅ (~280 lines)
- [x] Create `data-table.tsx` ✅ (~380 lines)
- [x] Create `stat-card.tsx` ✅ (~230 lines)
- [x] Create `loading-state.tsx` ✅ (~250 lines)
- [x] Create `index.ts` exports ✅ (~35 lines)
- [ ] Write unit tests for components (deferred to later)
- [x] Verify build passes ✅

**Phase 2 Status:** ✅ COMPLETED (January 31, 2026)

**Actual Lines Added:** ~1,425 lines (more comprehensive than planned)

**Components Implemented:**

| Component | Lines | Features |
|-----------|-------|----------|
| `CurrencyInput` | 250 | Decimal input, formatting, min/max, size variants, `formatMVR` helper |
| `ConfirmDialog` | 280 | 4 variants, loading state, `DeleteConfirmDialog`, `SubmitConfirmDialog` |
| `DataTable` | 380 | Sorting, pagination, search, loading/empty states, row click |
| `StatCard` | 230 | 5 variants, trend display, icon, loading, `StatCardGrid`, `CompactStatCard` |
| `LoadingState` | 250 | 3 sizes, `LoadingOverlay`, `PageLoadingSkeleton`, `InlineLoader` |

**Bonus Components Added:**
- `formatCurrency()` and `formatMVR()` utility functions
- `DeleteConfirmDialog` - specialized delete confirmation
- `SubmitConfirmDialog` - specialized submit with warnings
- `StatCardGrid` - responsive grid container for stat cards
- `CompactStatCard` - inline stat display
- `LoadingOverlay` - overlay with blur effect
- `PageLoadingSkeleton` - full page loading skeletons (cards, table, form types)
- `InlineLoader` - small inline loading indicator

**Reusability Impact:** Can be used in 8+ pages

---

## Phase 3: Refactor Daily Entry Page (Critical)

**Goal:** Reduce `daily-entry/page.tsx` from 1,240 to ~400 lines
**Impact:** Most critical refactoring - affects core functionality
**Files to Create:** 6 new components + 1 hook

### Task 3.1: Create `useDailyEntryForm` Hook

**Purpose:** Extract all form state management from page

**New Hook:**
```typescript
// src/hooks/use-daily-entry-form.ts
"use client"

import { useState, useCallback, useEffect } from "react"
import { useDailyEntry } from "./use-daily-entry"
import type { DailyEntryWithRelations, CategoryType } from "@/types"

interface CategoryData {
  consumerCash: number
  consumerTransfer: number
  consumerCredit: number
  corporateCash: number
  corporateTransfer: number
  corporateCredit: number
  quantity: number
}

interface FormState {
  categories: Record<CategoryType, CategoryData>
  cashDrawer: {
    opening: number
    bankDeposits: number
    closingActual: number
  }
  wallet: {
    opening: number
    closingActual: number
  }
  notes: string
}

export function useDailyEntryForm(date: string) {
  const { entry, calculationData, isLoading, error, fetchEntry, updateEntry, submitEntry } = useDailyEntry({ date })

  const [formState, setFormState] = useState<FormState>(/* initial state */)
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Initialize form from entry
  useEffect(() => {
    if (entry) {
      // Map entry to form state
      setFormState(/* mapped state */)
      setIsDirty(false)
    }
  }, [entry])

  // Category update handler
  const updateCategory = useCallback((
    category: CategoryType,
    field: keyof CategoryData,
    value: number
  ) => {
    setFormState(prev => ({
      ...prev,
      categories: {
        ...prev.categories,
        [category]: {
          ...prev.categories[category],
          [field]: value,
        },
      },
    }))
    setIsDirty(true)
  }, [])

  // Cash drawer update handler
  const updateCashDrawer = useCallback((field: string, value: number) => {
    setFormState(prev => ({
      ...prev,
      cashDrawer: { ...prev.cashDrawer, [field]: value },
    }))
    setIsDirty(true)
  }, [])

  // Wallet update handler
  const updateWallet = useCallback((field: string, value: number) => {
    setFormState(prev => ({
      ...prev,
      wallet: { ...prev.wallet, [field]: value },
    }))
    setIsDirty(true)
  }, [])

  // Save handler
  const save = useCallback(async () => {
    setIsSaving(true)
    try {
      await updateEntry(date, /* transform formState to DTO */)
      setIsDirty(false)
    } finally {
      setIsSaving(false)
    }
  }, [date, formState, updateEntry])

  // Calculate totals
  const totals = useMemo(() => {
    // Calculate all totals from formState
    return {
      totalCash: 0,
      totalTransfer: 0,
      totalCredit: 0,
      grandTotal: 0,
      cashExpected: 0,
      walletExpected: 0,
      cashVariance: 0,
      walletVariance: 0,
    }
  }, [formState, calculationData])

  return {
    entry,
    formState,
    totals,
    calculationData,
    isLoading,
    isSaving,
    isDirty,
    error,
    updateCategory,
    updateCashDrawer,
    updateWallet,
    save,
    submitEntry,
    fetchEntry,
  }
}
```

**Location:** `src/hooks/use-daily-entry-form.ts`
**Lines:** ~150

---

### Task 3.2: Create `CategoryTable` Component

**Purpose:** Render the sales categories table

**Location:** `src/components/daily-entry/category-table.tsx`
**Lines:** ~120

---

### Task 3.3: Create `CashDrawerSection` Component

**Purpose:** Cash drawer input section

**Location:** `src/components/daily-entry/cash-drawer-section.tsx`
**Lines:** ~80

---

### Task 3.4: Create `WalletSection` Component

**Purpose:** Wallet balance input section

**Location:** `src/components/daily-entry/wallet-section.tsx`
**Lines:** ~80

---

### Task 3.5: Create `WalletTopupDialog` Component

**Extract from:** `daily-entry/page.tsx` (lines 125-220)

**Location:** `src/components/daily-entry/wallet-topup-dialog.tsx`
**Lines:** ~100

---

### Task 3.6: Create `SubmissionDialog` Component

**Purpose:** Handle submission with validation warnings

**Location:** `src/components/daily-entry/submission-dialog.tsx`
**Lines:** ~120

---

### Task 3.7: Create `DailySummaryCard` Component

**Purpose:** Show daily totals summary

**Location:** `src/components/daily-entry/daily-summary-card.tsx`
**Lines:** ~80

---

### Task 3.8: Refactor Main Page

**After extraction, the page should:**
- Import extracted components
- Use `useDailyEntryForm` hook
- Handle routing/date selection
- Compose the UI

**Target:** `src/app/(dashboard)/daily-entry/page.tsx`
**Target Lines:** ~300-400

---

### Phase 3 Checklist

- [x] Create `src/components/daily-entry/` directory ✅
- [x] Create `use-daily-entry-form.ts` hook ✅ (~350 lines)
- [x] Create `types.ts` (shared types & constants) ✅ (~95 lines)
- [x] Create `category-table.tsx` ✅ (~160 lines)
- [x] Create `cash-drawer-section.tsx` ✅ (~110 lines)
- [x] Create `wallet-section.tsx` ✅ (~145 lines)
- [x] Create `wallet-topup-dialog.tsx` ✅ (~85 lines)
- [x] Create `credit-sales-section.tsx` ✅ (~130 lines)
- [x] Create `submission-dialog.tsx` ✅ (~55 lines)
- [x] Create `daily-summary-bar.tsx` ✅ (~45 lines)
- [x] Create `index.ts` exports ✅ (~25 lines)
- [x] Refactor `daily-entry/page.tsx` ✅ (~300 lines)
- [ ] Write integration tests (deferred to later)
- [x] Verify all functionality works ✅
- [x] Verify build passes ✅

**Phase 3 Status:** ✅ COMPLETED (January 31, 2026)

**Lines Before:** 1,240
**Lines After (page):** ~300 lines (76% reduction!)
**Total Lines (page + components + hook):** ~1,500 lines

**Files Created:**

| File | Lines | Purpose |
|------|-------|---------|
| `types.ts` | 95 | Shared types, configs, constants |
| `use-daily-entry-form.ts` | 350 | Form state management hook |
| `category-table.tsx` | 160 | Sales grid component |
| `cash-drawer-section.tsx` | 110 | Cash reconciliation |
| `wallet-section.tsx` | 145 | Wallet tracking |
| `wallet-topup-dialog.tsx` | 85 | Add topup dialog |
| `credit-sales-section.tsx` | 130 | Credit sales display |
| `submission-dialog.tsx` | 55 | Variance warning dialog |
| `daily-summary-bar.tsx` | 45 | Summary bar |
| `index.ts` | 25 | Exports |

**Net Benefits:**
- Page reduced from 1,240 to ~300 lines (76% reduction)
- Form logic extracted to reusable hook
- Components can be unit tested independently
- Better separation of concerns
- Reusable patterns for other pages

---

## Phase 4: Refactor Other Large Pages

**Goal:** Reduce all page components to <400 lines
**Files to Refactor:** 7 pages

### Task 4.1: Refactor `day-detail/page.tsx` (870 → 350 lines)

**Extract:**
- `ReconciliationCard` component
- `SalesBreakdownTable` component
- `ScreenshotSection` component
- `WalletTopupsSection` component

**New Components:**
- `src/components/day-detail/reconciliation-card.tsx` (~100 lines)
- `src/components/day-detail/sales-breakdown-table.tsx` (~120 lines)
- `src/components/day-detail/screenshot-section.tsx` (~150 lines)
- `src/components/day-detail/wallet-topups-section.tsx` (~80 lines)

---

### Task 4.2: Refactor `settings/page.tsx` (799 → 300 lines)

**Extract:**
- `UserManagementSection` component
- `UserEditDialog` component
- `DataExportSection` component
- `DataClearDialog` component

**New Components:**
- `src/components/settings/user-management-section.tsx` (~200 lines)
- `src/components/settings/user-edit-dialog.tsx` (~150 lines)
- `src/components/settings/data-export-section.tsx` (~100 lines)
- `src/components/settings/data-clear-dialog.tsx` (~80 lines)

---

### Task 4.3: Refactor `credit/page.tsx` (730 → 350 lines)

**Extract:**
- `CustomerList` component
- `CustomerCard` component
- `TransactionHistory` component

**New Components:**
- `src/components/credit/customer-list.tsx` (~150 lines)
- `src/components/credit/customer-card.tsx` (~100 lines)
- `src/components/credit/transaction-history.tsx` (~120 lines)

---

### Task 4.4: Refactor `bank/page.tsx` (713 → 350 lines)

**Extract:**
- `BankSummaryCards` component
- `TransactionTable` component
- `TransactionDialog` component

**New Components:**
- `src/components/bank/bank-summary-cards.tsx` (~80 lines)
- `src/components/bank/transaction-table.tsx` (~150 lines)
- `src/components/bank/transaction-dialog.tsx` (~120 lines)

---

### Task 4.5: Refactor `reports/page.tsx` (650 → 300 lines)

**Extract:**
- `ReportSummaryCards` component
- `DailyBreakdownTable` component
- `CreditAgingTable` component
- `ExportButtons` component

**New Components:**
- `src/components/reports/report-summary-cards.tsx` (~100 lines)
- `src/components/reports/daily-breakdown-table.tsx` (~150 lines)
- `src/components/reports/credit-aging-table.tsx` (~80 lines)
- `src/components/reports/export-buttons.tsx` (~50 lines)

---

### Task 4.6: Refactor `wallet/page.tsx` (522 → 300 lines)

**Extract:**
- `WalletSummaryCards` component
- `TopupHistoryTable` component
- `TodayActivityCard` component

**New Components:**
- `src/components/wallet/wallet-summary-cards.tsx` (~80 lines)
- `src/components/wallet/topup-history-table.tsx` (~120 lines)
- `src/components/wallet/today-activity-card.tsx` (~100 lines)

---

### Task 4.7: Refactor `(dashboard)/page.tsx` (493 → 300 lines)

**Extract:**
- `DashboardAlerts` component
- `RecentActivity` component
- `TodayBreakdownTable` component (already exists inline)

**New Components:**
- `src/components/dashboard/dashboard-alerts.tsx` (~80 lines)
- `src/components/dashboard/recent-activity.tsx` (~100 lines)

---

### Task 4.8: Refactor `credit-sale-dialog.tsx` (497 → 250 lines)

**Extract:**
- `CustomerSearch` component
- `SaleForm` component

**New Components:**
- `src/components/credit/customer-search.tsx` (~120 lines)
- `src/components/credit/sale-form.tsx` (~100 lines)

---

### Phase 4 Checklist

- [x] Refactor `day-detail/page.tsx` ✅ (870 → 240 lines)
- [x] Refactor `settings/page.tsx` ✅ (799 → 305 lines)
- [x] Refactor `credit/page.tsx` ✅ (730 → 129 lines)
- [x] Refactor `bank/page.tsx` ✅ (713 → 205 lines)
- [x] Refactor `reports/page.tsx` ✅ (650 → 249 lines)
- [x] Refactor `wallet/page.tsx` ✅ (522 → 142 lines)
- [x] Refactor `(dashboard)/page.tsx` ✅ (493 → 225 lines)
- [x] Refactor `credit-sale-dialog.tsx` ✅ (497 → 254 lines)
- [x] Verify all functionality ✅
- [x] Update imports ✅
- [x] Verify build passes ✅

**Phase 4 Status:** ✅ COMPLETED (January 31, 2026)

**Total New Components:** 32 components across 8 feature directories
**Total Lines Reduction:** ~4,234 lines → ~1,549 lines (63% reduction in page files)

**Files Created:**

| Directory | Components | Purpose |
|-----------|------------|---------|
| `day-detail/` | 6 | reconciliation-card, sales-breakdown, screenshot-section, wallet-topups-section, credit-sales-section, types |
| `settings/` | 5 | user-form-dialog, user-table, password-change-dialog, data-management-section, types |
| `credit/` | 9 | customer-form-dialog, settlement-dialog, ledger-dialog, summary-cards, customer-table, customer-selector, customer-info-card, limit-warning-dialog, types |
| `bank/` | 6 | add-transaction-dialog, opening-balance-dialog, edit-transaction-dialog, summary-cards, transaction-table, types |
| `reports/` | 3 | summary-card, daily-breakdown-table, breakdown-sections |
| `wallet/` | 4 | add-topup-dialog, summary-cards, today-activity-card, topup-history-table |
| `dashboard/` | 4 | stat-card, alerts-section, breakdown-table, activity-feed |

**Key Achievements:**
- All page components now under 310 lines (target was <400)
- credit/page.tsx achieved 82% reduction (730 → 129 lines)
- All extracted components are independently testable
- Consistent barrel export pattern (index.ts) in all directories

---

## Phase 5: Refactor API Routes & Utilities

**Goal:** Improve API route organization and reduce duplication
**Files to Refactor:** 5 API routes

### Task 5.1: Create API Response Helpers

**New Utility:**
```typescript
// src/lib/api/response.ts
import { NextResponse } from "next/server"

export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status })
}

export function errorResponse(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status })
}

export function validationError(errors: Record<string, string>) {
  return NextResponse.json({ success: false, errors }, { status: 400 })
}

export function notFoundError(resource: string) {
  return NextResponse.json(
    { success: false, error: `${resource} not found` },
    { status: 404 }
  )
}

export function serverError(message = "Internal server error") {
  return NextResponse.json({ success: false, error: message }, { status: 500 })
}
```

**Location:** `src/lib/api/response.ts`
**Lines:** ~30

---

### Task 5.2: Create API Middleware Helpers

**New Utility:**
```typescript
// src/lib/api/middleware.ts
import { NextRequest } from "next/server"
import { requirePermission } from "@/lib/api-auth"
import { Permission } from "@/lib/permissions"
import { serverError } from "./response"

type Handler = (req: NextRequest, context: { params: Record<string, string> }) => Promise<Response>

export function withPermission(permission: Permission) {
  return (handler: Handler): Handler => {
    return async (req, context) => {
      const auth = await requirePermission(permission)
      if (auth.error) return auth.error
      return handler(req, context)
    }
  }
}

export function withErrorHandling(handler: Handler): Handler {
  return async (req, context) => {
    try {
      return await handler(req, context)
    } catch (error) {
      console.error("API Error:", error)
      return serverError()
    }
  }
}

export function compose(...middlewares: ((h: Handler) => Handler)[]) {
  return (handler: Handler): Handler => {
    return middlewares.reduceRight((h, middleware) => middleware(h), handler)
  }
}
```

**Location:** `src/lib/api/middleware.ts`
**Lines:** ~40

---

### Task 5.3: Split Dashboard Route

**Current:** `src/app/api/dashboard/route.ts` (505 lines)

**Extract to:**
- `src/lib/calculations/dashboard.ts` - Revenue, credit, bank calculations
- Keep route for orchestration only

**Target:** Route reduced to ~150 lines

---

### Task 5.4: Split Daily Entries Route

**Current:** `src/app/api/daily-entries/[date]/route.ts` (523 lines)

**Extract to:**
- `src/lib/calculations/daily-entry.ts` - Validation and calculation logic
- Keep route for HTTP handling only

**Target:** Route reduced to ~200 lines

---

### Task 5.5: Refactor Existing Hooks to Use New Patterns

**Update these hooks to use `useAsyncOperation`:**
- `use-bank.ts`
- `use-wallet.ts`
- `use-credit-customers.ts`
- `use-daily-entry.ts`
- `use-reports.ts`
- `use-dashboard.ts`

**Expected reduction:** ~30% per hook

---

### Phase 5 Checklist

- [x] Create `src/lib/api/response.ts` ✅
- [x] Create `src/lib/api/middleware.ts` ✅
- [x] Create `src/lib/api/index.ts` exports ✅
- [x] Extract dashboard calculations ✅ (506 → 140 lines, 72% reduction)
- [x] Extract daily-entry calculations ✅ (523 → 192 lines, 63% reduction)
- [x] Refactor all existing hooks ✅
- [x] Update API routes to use helpers ✅
- [x] Verify all functionality ✅
- [x] Verify build passes ✅

**Phase 5 Status:** ✅ COMPLETED (January 31, 2026)

**Files Created:**

| File | Lines | Purpose |
|------|-------|---------|
| `src/lib/api/response.ts` | 76 | API response helpers (successResponse, errorResponse, notFoundError, etc.) |
| `src/lib/api/middleware.ts` | 143 | API middleware (withAuth, withPermission, compose, parseBody, etc.) |
| `src/lib/api/index.ts` | 25 | Barrel exports for api utilities |
| `src/lib/calculations/dashboard.ts` | 270 | Dashboard calculation functions |
| `src/lib/calculations/daily-entry.ts` | 321 | Daily entry calculation and upsert functions |

**API Route Reductions:**

| Route | Before | After | Reduction |
|-------|--------|-------|-----------|
| `api/dashboard/route.ts` | 506 | 140 | 72% |
| `api/daily-entries/[date]/route.ts` | 523 | 192 | 63% |

**Hook Refactoring:**

| Hook | Before | After | Reduction |
|------|--------|-------|-----------|
| `use-dashboard.ts` | 49 | 40 | 18% |
| `use-reports.ts` | 125 | 117 | 6% |
| `use-bank.ts` | 186 | 127 | 32% |
| `use-wallet.ts` | 164 | 129 | 21% |
| `use-credit-customers.ts` | 150 | 98 | 35% |
| `use-daily-entry.ts` | 196 | 160 | 18% |

**Key Achievements:**
- All hooks now use `useApiClient` for consistent API calls
- API routes use standardized response helpers
- Dashboard and daily-entry calculation logic extracted to reusable functions
- Middleware pattern ready for future API routes
- Build passes successfully

---

## Final Directory Structure

After all phases, the codebase should look like:

```
src/
├── app/
│   ├── (dashboard)/
│   │   ├── page.tsx (~300 lines)
│   │   ├── daily-entry/page.tsx (~350 lines)
│   │   ├── day-detail/page.tsx (~350 lines)
│   │   ├── bank/page.tsx (~300 lines)
│   │   ├── credit/page.tsx (~350 lines)
│   │   ├── wallet/page.tsx (~300 lines)
│   │   ├── reports/page.tsx (~300 lines)
│   │   ├── settings/page.tsx (~300 lines)
│   │   └── import/page.tsx (~300 lines)
│   └── api/
│       └── ... (routes ~150-200 lines each)
│
├── components/
│   ├── shared/
│   │   ├── currency-input.tsx
│   │   ├── confirm-dialog.tsx
│   │   ├── data-table.tsx
│   │   ├── stat-card.tsx
│   │   ├── loading-state.tsx
│   │   └── index.ts
│   ├── daily-entry/
│   │   ├── category-table.tsx
│   │   ├── cash-drawer-section.tsx
│   │   ├── wallet-section.tsx
│   │   ├── wallet-topup-dialog.tsx
│   │   ├── submission-dialog.tsx
│   │   ├── daily-summary-card.tsx
│   │   └── index.ts
│   ├── day-detail/
│   │   └── ... (4 components)
│   ├── settings/
│   │   └── ... (4 components)
│   ├── credit/
│   │   └── ... (5 components)
│   ├── bank/
│   │   └── ... (3 components)
│   ├── wallet/
│   │   └── ... (3 components)
│   ├── reports/
│   │   └── ... (4 components)
│   ├── dashboard/
│   │   └── ... (3 components)
│   ├── layout/
│   │   └── ... (existing)
│   ├── auth/
│   │   └── ... (existing)
│   └── ui/
│       └── ... (existing shadcn components)
│
├── hooks/
│   ├── use-async-operation.ts (NEW)
│   ├── use-api-client.ts (NEW)
│   ├── use-dialog-state.ts (NEW)
│   ├── use-form-field.ts (NEW)
│   ├── use-daily-entry-form.ts (NEW)
│   ├── use-daily-entry.ts (refactored)
│   ├── use-bank.ts (refactored)
│   ├── use-wallet.ts (refactored)
│   ├── use-credit-customers.ts (refactored)
│   ├── use-reports.ts (refactored)
│   ├── use-dashboard.ts (refactored)
│   ├── use-auth.ts
│   └── index.ts
│
├── lib/
│   ├── api/
│   │   ├── response.ts (NEW)
│   │   ├── middleware.ts (NEW)
│   │   └── index.ts (NEW)
│   ├── calculations/
│   │   ├── dashboard.ts (NEW - extracted)
│   │   ├── daily-entry.ts (NEW - extracted)
│   │   ├── revenue.ts
│   │   ├── credit.ts
│   │   ├── wallet.ts
│   │   ├── cash-drawer.ts
│   │   └── index.ts
│   ├── validations/
│   │   └── daily-entry.ts
│   ├── api-auth.ts
│   ├── auth.ts
│   ├── db.ts
│   ├── permissions.ts
│   └── utils.ts
│
└── types/
    └── index.ts
```

---

## Success Metrics

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Largest page component | 1,240 | ~350 | <400 |
| Files >300 lines | 14 | 3-4 | <5 |
| Max hooks per component | 26 | ~8 | <10 |
| Boilerplate duplication | 70% | <15% | <20% |
| Reusable components | 4 | ~40 | 35+ |
| Shared hooks | 0 | 5 | 4+ |
| API helper functions | 0 | 10+ | 8+ |

---

## Timeline Estimate

| Phase | Description | Scope |
|-------|-------------|-------|
| Phase 1 | Foundation Hooks | 4 hooks, ~170 lines |
| Phase 2 | Shared Components | 5 components, ~285 lines |
| Phase 3 | Daily Entry Refactor | 7 components + 1 hook |
| Phase 4 | Other Pages | ~25 components |
| Phase 5 | API & Utilities | Helpers + refactoring |

---

## Notes

- Always run tests after each task
- Verify build passes before moving to next task
- Keep git commits atomic (one component per commit)
- Update imports across codebase after extractions
- Document any breaking changes

---

*Document created: January 31, 2026*
*Last updated: January 31, 2026*
