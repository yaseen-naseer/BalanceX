/**
 * Pure helpers used by `useDailyEntryForm` to convert between API shapes
 * (`DailyEntryWithRelations`) and the local form-state shape (`LocalEntryData`).
 *
 * Extracted to a non-React module so they can be unit-tested without a hook
 * environment, and to keep the orchestrator hook focused on composition.
 */
import type { DailyEntryWithRelations } from "@/types"
import {
  type Category,
  type LocalEntryData,
  CATEGORIES,
} from "@/components/daily-entry/types"

/**
 * Create an empty local-data structure for form initialization.
 * All categories present, all amounts zero, no notes.
 */
export function createEmptyLocalData(): LocalEntryData {
  const categories = {} as LocalEntryData["categories"]
  CATEGORIES.forEach((cat) => {
    categories[cat.key] = {
      consumerCash: 0,
      consumerTransfer: 0,
      consumerCredit: 0,
      corporateCash: 0,
      corporateTransfer: 0,
      corporateCredit: 0,
      quantity: 0,
    }
  })
  return {
    categories,
    cashDrawer: { opening: 0, bankDeposits: 0, closingActual: 0 },
    wallet: { opening: 0, closingActual: 0 },
    notes: "",
  }
}

/**
 * Convert a `DailyEntryWithRelations` (server shape) to `LocalEntryData` (form shape).
 *
 * Key behaviours:
 * - Credit values per category/customerType are derived from the entry's
 *   `creditSales` array, NOT from the category row's stored credit columns.
 *   Only `DHIRAAGU_BILLS` and `WHOLESALE_RELOAD` carry credit; other categories
 *   keep their `consumerCredit` / `corporateCredit` at 0.
 * - For `WHOLESALE_RELOAD`, only consumer credit is populated (corporate credit
 *   is suppressed).
 * - Cash/transfer fields are taken straight from the category row, except for
 *   non-`DHIRAAGU_BILLS` categories where corporate cash/transfer are forced to 0.
 * - Cash drawer + wallet + notes are mirrored if present, otherwise stay at the
 *   empty-data defaults.
 */
export function entryToLocalData(entry: DailyEntryWithRelations | null): LocalEntryData {
  if (!entry) return createEmptyLocalData()

  const data = createEmptyLocalData()

  // Derive credit from linked credit sales, grouped by category and customer type.
  const creditByCategory = new Map<string, { consumer: number; corporate: number }>()
  const creditCategories = ["DHIRAAGU_BILLS", "WHOLESALE_RELOAD"]
  for (const cat of creditCategories) {
    creditByCategory.set(cat, { consumer: 0, corporate: 0 })
  }
  entry.creditSales?.forEach((s) => {
    const cat = s.category || "DHIRAAGU_BILLS"
    const existing = creditByCategory.get(cat)
    if (existing) {
      if (s.customer.type === "CONSUMER") existing.consumer += Number(s.amount)
      else existing.corporate += Number(s.amount)
    }
  })

  entry.categories?.forEach((cat) => {
    const isDhiraagu = cat.category === "DHIRAAGU_BILLS"
    const creditData = creditByCategory.get(cat.category)
    data.categories[cat.category] = {
      consumerCash: Number(cat.consumerCash),
      consumerTransfer: Number(cat.consumerTransfer),
      consumerCredit: creditData ? creditData.consumer : 0,
      corporateCash: isDhiraagu ? Number(cat.corporateCash) : 0,
      corporateTransfer: isDhiraagu ? Number(cat.corporateTransfer) : 0,
      corporateCredit: isDhiraagu && creditData ? creditData.corporate : 0,
      quantity: Number(cat.quantity),
    }
  })

  // Apply credit values even for categories that don't have a DB row yet.
  for (const [catKey, creditData] of creditByCategory) {
    const existing = entry.categories?.find((c) => c.category === catKey)
    if (!existing && (creditData.consumer > 0 || creditData.corporate > 0)) {
      const isDhiraagu = catKey === "DHIRAAGU_BILLS"
      const key = catKey as Category
      data.categories[key] = {
        ...data.categories[key],
        consumerCredit: creditData.consumer,
        corporateCredit: isDhiraagu ? creditData.corporate : 0,
      }
    }
  }

  if (entry.cashDrawer) {
    data.cashDrawer = {
      opening: Number(entry.cashDrawer.opening),
      bankDeposits: Number(entry.cashDrawer.bankDeposits),
      closingActual: Number(entry.cashDrawer.closingActual),
    }
  }

  if (entry.wallet) {
    data.wallet = {
      opening: Number(entry.wallet.opening),
      closingActual: Number(entry.wallet.closingActual),
    }
  }

  if (entry.notes) {
    data.notes = entry.notes.content || ""
  }

  return data
}
