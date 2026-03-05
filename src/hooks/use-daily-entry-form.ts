"use client"

import { useState, useCallback, useEffect, useMemo } from "react"
import { useDailyEntry, type CalculationData } from "./use-daily-entry"
import { useWallet } from "./use-wallet"
import { useAuth } from "./use-auth"
import { canEditDailyEntry } from "@/lib/permissions"
import type { DailyEntryWithRelations, CreateDailyEntryDto, UpdateDailyEntryDto } from "@/types"
import {
  type Category,
  type CustomerType,
  type PaymentMethod,
  type LocalEntryData,
  type TotalsData,
  type VarianceData,
  CATEGORIES,
  VARIANCE_THRESHOLD,
} from "@/components/daily-entry/types"

/**
 * Creates empty local data structure for form initialization
 */
function createEmptyLocalData(): LocalEntryData {
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
 * Converts a DailyEntryWithRelations to LocalEntryData for form editing
 */
function entryToLocalData(entry: DailyEntryWithRelations | null): LocalEntryData {
  if (!entry) return createEmptyLocalData()

  const data = createEmptyLocalData()

  entry.categories?.forEach((cat) => {
    const isDhiraagu = cat.category === 'DHIRAAGU_BILLS'
    data.categories[cat.category] = {
      consumerCash: Number(cat.consumerCash),
      consumerTransfer: Number(cat.consumerTransfer),
      // Credit and corporate only allowed for Dhiraagu Bills
      consumerCredit: isDhiraagu ? Number(cat.consumerCredit) : 0,
      corporateCash: isDhiraagu ? Number(cat.corporateCash) : 0,
      corporateTransfer: isDhiraagu ? Number(cat.corporateTransfer) : 0,
      corporateCredit: isDhiraagu ? Number(cat.corporateCredit) : 0,
      quantity: Number(cat.quantity),
    }
  })

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

export interface ValidationMessage {
  type: "block" | "warning"
  message: string
}

export interface ValidationResult {
  canSubmit: boolean
  hasWarnings: boolean
  hasBlocks: boolean
  messages: ValidationMessage[]
}

export interface UseDailyEntryFormOptions {
  date: string
}

export interface UseDailyEntryFormReturn {
  // Data
  entry: DailyEntryWithRelations | null
  localData: LocalEntryData
  calculationData: CalculationData
  totals: TotalsData
  variance: VarianceData

  // Wallet data
  dayTopups: Array<{ id: string; amount: number; source: string; notes?: string | null }>
  totalTopups: number
  reloadSalesTotal: number

  // Credit data
  linkedCreditTotal: number
  gridCreditTotal: number
  creditBalanced: boolean

  // State
  isLoading: boolean
  isSaving: boolean
  isSubmitting: boolean
  isDirty: boolean
  error: string | null
  isSubmitted: boolean
  isReadOnly: boolean
  editPermission: { canEdit: boolean; reason?: string }

  // Handlers
  handleValueChange: (category: Category, customerType: CustomerType, paymentMethod: PaymentMethod, value: number) => void
  handleQuantityChange: (category: Category, value: number) => void
  handleFieldChange: (field: string, value: number | string) => void
  getCategoryTotal: (category: Category) => number

  // Amendment data
  amendments: NonNullable<DailyEntryWithRelations['amendments']>

  // Actions
  saveDraft: () => Promise<string | false>
  submitEntry: (acknowledgeWarnings?: boolean) => Promise<{ success: boolean; requiresConfirmation?: boolean; messages?: ValidationMessage[] }>
  validateBeforeSubmit: () => ValidationResult
  refreshEntry: () => Promise<void>
  refreshWallet: () => void
  reopenEntry: (reason: string) => Promise<boolean>
}

export function useDailyEntryForm({ date }: UseDailyEntryFormOptions): UseDailyEntryFormReturn {
  const {
    entry,
    calculationData,
    isLoading,
    error,
    fetchEntry,
    createEntry,
    updateEntry,
    submitEntry: submitEntryApi,
    reopenEntry: reopenEntryApi,
  } = useDailyEntry({ date })

  const {
    topups,
    fetchWallet,
    getTotalTopupsByDate,
    getTopupsByDate,
    getPreviousClosing
  } = useWallet()

  const { user } = useAuth()

  // Form state
  const [localData, setLocalData] = useState<LocalEntryData>(createEmptyLocalData())
  const [isSaving, setIsSaving] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [walletAutoLoaded, setWalletAutoLoaded] = useState(false)
  const [hasUserChanges, setHasUserChanges] = useState(false)

  // Check edit permissions
  const editPermission = useMemo(() => {
    if (!user?.role) return { canEdit: false, reason: "Loading..." }
    const entryDate = new Date(date)
    const isOwnEntry = !entry || entry.createdBy === user.id
    return canEditDailyEntry(user.role, entryDate, isOwnEntry)
  }, [user?.role, user?.id, date, entry])

  // Update local data when entry changes
  useEffect(() => {
    setLocalData(entryToLocalData(entry))
    setHasUserChanges(false)
    setWalletAutoLoaded(false)
  }, [entry])

  // Fetch entry when date changes
  useEffect(() => {
    fetchEntry(date)
    fetchWallet()
  }, [date, fetchEntry, fetchWallet])

  // Auto-load wallet opening from previous day when opening is 0
  // Handles both new entries (no entry yet) and existing entries saved with opening=0
  useEffect(() => {
    const loadPreviousClosing = async () => {
      // Skip if: still loading, already auto-loaded, or opening is already set
      if (isLoading || walletAutoLoaded || localData.wallet.opening !== 0) return
      // Skip if entry exists but was intentionally set to non-PREVIOUS_DAY source
      if (entry?.wallet && entry.wallet.openingSource !== 'PREVIOUS_DAY') return

      const previousData = await getPreviousClosing(date)
      if (previousData && previousData.previousClosing > 0) {
        setLocalData((prev) => ({
          ...prev,
          wallet: {
            ...prev.wallet,
            opening: previousData.previousClosing,
          },
        }))
        setWalletAutoLoaded(true)
        // Mark dirty only when correcting an existing saved entry (needs a re-save)
        if (entry) {
          setHasUserChanges(true)
        }
      }
    }
    loadPreviousClosing()
  }, [isLoading, entry, date, getPreviousClosing, walletAutoLoaded, localData.wallet.opening])

  // Wallet data - transform to expected format
  const dayTopups = useMemo(
    () => getTopupsByDate(date).map(t => ({
      id: t.id,
      amount: Number(t.amount),
      source: t.source,
      notes: t.notes,
    })),
    [getTopupsByDate, date, topups]
  )

  const totalTopups = useMemo(
    () => getTotalTopupsByDate(date),
    [getTotalTopupsByDate, date, topups]
  )

  // Calculate totals
  const totals = useMemo<TotalsData>(() => {
    let totalCash = 0,
      totalTransfer = 0,
      totalCredit = 0,
      consumerTotal = 0,
      corporateTotal = 0

    CATEGORIES.forEach((cat) => {
      const c = localData.categories[cat.key]
      totalCash += c.consumerCash + c.corporateCash
      totalTransfer += c.consumerTransfer + c.corporateTransfer
      totalCredit += c.consumerCredit + c.corporateCredit
      consumerTotal += c.consumerCash + c.consumerTransfer + c.consumerCredit
      corporateTotal += c.corporateCash + c.corporateTransfer + c.corporateCredit
    })

    return {
      totalCash,
      totalTransfer,
      totalCredit,
      totalRevenue: totalCash + totalTransfer + totalCredit,
      consumerTotal,
      corporateTotal,
    }
  }, [localData])

  // Calculate reload sales (for wallet) — only consumer cash + transfer (credit/corporate disabled for reload)
  const reloadSalesTotal = useMemo(() => {
    const retail = localData.categories.RETAIL_RELOAD
    const wholesale = localData.categories.WHOLESALE_RELOAD
    return (
      retail.consumerCash + retail.consumerTransfer +
      wholesale.consumerCash + wholesale.consumerTransfer
    )
  }, [localData])

  // Calculate variance data
  const variance = useMemo<VarianceData>(() => {
    const walletExpected = localData.wallet.opening + totalTopups - reloadSalesTotal
    const walletVariance = localData.wallet.closingActual - walletExpected

    const cashExpected =
      localData.cashDrawer.opening +
      totals.totalCash +
      calculationData.cashSettlements -
      localData.cashDrawer.bankDeposits -
      calculationData.walletTopupsFromCash

    const cashVariance = localData.cashDrawer.closingActual - cashExpected

    return {
      cashExpected,
      cashVariance,
      walletExpected,
      walletVariance,
    }
  }, [localData, totalTopups, reloadSalesTotal, totals.totalCash, calculationData])

  // Credit data
  const linkedCreditTotal = useMemo(() => {
    if (!entry?.creditSales) return 0
    return entry.creditSales.reduce((sum, sale) => sum + Number(sale.amount), 0)
  }, [entry?.creditSales])

  const gridCreditTotal = useMemo(() => {
    return (
      localData.categories.DHIRAAGU_BILLS.consumerCredit +
      localData.categories.DHIRAAGU_BILLS.corporateCredit
    )
  }, [localData])

  const creditBalanced = gridCreditTotal === linkedCreditTotal

  // Value change handler
  const handleValueChange = useCallback(
    (category: Category, customerType: CustomerType, paymentMethod: PaymentMethod, value: number) => {
      setHasUserChanges(true)
      setLocalData((prev) => {
        const key = `${customerType}${paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1)}` as keyof typeof prev.categories[Category]
        return {
          ...prev,
          categories: {
            ...prev.categories,
            [category]: {
              ...prev.categories[category],
              [key]: value,
            },
          },
        }
      })
    },
    []
  )

  // Quantity change handler
  const handleQuantityChange = useCallback((category: Category, value: number) => {
    setHasUserChanges(true)
    setLocalData((prev) => ({
      ...prev,
      categories: {
        ...prev.categories,
        [category]: {
          ...prev.categories[category],
          quantity: value,
        },
      },
    }))
  }, [])

  // Generic field change handler
  const handleFieldChange = useCallback((field: string, value: number | string) => {
    setHasUserChanges(true)
    setLocalData((prev) => {
      if (field === "notes") {
        return { ...prev, notes: value as string }
      }
      if (field.startsWith("cashDrawer.")) {
        const subField = field.split(".")[1] as keyof LocalEntryData["cashDrawer"]
        return { ...prev, cashDrawer: { ...prev.cashDrawer, [subField]: value } }
      }
      if (field.startsWith("wallet.")) {
        const subField = field.split(".")[1] as keyof LocalEntryData["wallet"]
        return { ...prev, wallet: { ...prev.wallet, [subField]: value } }
      }
      return prev
    })
  }, [])

  // Get category total
  const getCategoryTotal = useCallback(
    (category: Category) => {
      const cat = localData.categories[category]
      return (
        cat.consumerCash + cat.consumerTransfer + cat.consumerCredit +
        cat.corporateCash + cat.corporateTransfer + cat.corporateCredit
      )
    },
    [localData]
  )

  // Build entry DTO
  const buildEntryData = useCallback((): CreateDailyEntryDto => {
    return {
      date,
      categories: CATEGORIES.map((cat) => ({
        category: cat.key,
        consumerCash: localData.categories[cat.key].consumerCash,
        consumerTransfer: localData.categories[cat.key].consumerTransfer,
        consumerCredit: cat.key === 'DHIRAAGU_BILLS' ? localData.categories[cat.key].consumerCredit : 0,
        corporateCash: cat.key === 'DHIRAAGU_BILLS' ? localData.categories[cat.key].corporateCash : 0,
        corporateTransfer: cat.key === 'DHIRAAGU_BILLS' ? localData.categories[cat.key].corporateTransfer : 0,
        corporateCredit: cat.key === 'DHIRAAGU_BILLS' ? localData.categories[cat.key].corporateCredit : 0,
        quantity: localData.categories[cat.key].quantity,
      })),
      cashDrawer: {
        opening: localData.cashDrawer.opening,
        bankDeposits: localData.cashDrawer.bankDeposits,
        closingActual: localData.cashDrawer.closingActual,
      },
      wallet: {
        opening: localData.wallet.opening,
        closingActual: localData.wallet.closingActual,
      },
      notes: localData.notes || undefined,
    }
  }, [date, localData])

  // Validate before submit
  const validateBeforeSubmit = useCallback((): ValidationResult => {
    const messages: ValidationMessage[] = []
    const absCashVariance = Math.abs(variance.cashVariance)

    // Hard block if reload sales exceed wallet balance
    const availableWalletBalance = localData.wallet.opening + totalTopups
    if (reloadSalesTotal > availableWalletBalance) {
      messages.push({
        type: "block",
        message: `Reload sales (${reloadSalesTotal.toLocaleString()} MVR) exceed available wallet balance (${availableWalletBalance.toLocaleString()} MVR). Please add a top-up or reduce reload sales.`,
      })
    }

    // Hard block if credit is unbalanced
    if (!creditBalanced && (gridCreditTotal > 0 || linkedCreditTotal > 0)) {
      messages.push({
        type: "block",
        message: `Credit is unbalanced: Grid shows ${gridCreditTotal.toLocaleString()} MVR but linked sales total ${linkedCreditTotal.toLocaleString()} MVR.`,
      })
    }

    // Hard block if cash variance exceeds threshold
    if (absCashVariance > VARIANCE_THRESHOLD) {
      messages.push({
        type: "block",
        message: `Cash variance exceeds MVR ${VARIANCE_THRESHOLD} (Current: ${variance.cashVariance > 0 ? "+" : ""}${variance.cashVariance} MVR).`,
      })
    }

    // Check for blocks
    const hasBlocks = messages.some((m) => m.type === "block")
    if (hasBlocks) {
      return { canSubmit: false, hasWarnings: false, hasBlocks: true, messages }
    }

    // Warning for non-zero cash variance within threshold
    if (absCashVariance > 0) {
      messages.push({
        type: "warning",
        message: `Cash variance: ${variance.cashVariance > 0 ? "+" : ""}${variance.cashVariance} MVR`,
      })
    }

    // Wallet variance is informational only — shown in the wallet section, not a submit blocker

    const hasWarnings = messages.some((m) => m.type === "warning")
    return { canSubmit: true, hasWarnings, hasBlocks: false, messages }
  }, [variance, creditBalanced, gridCreditTotal, linkedCreditTotal, reloadSalesTotal, totalTopups, localData.wallet.opening])

  // Save draft
  const saveDraft = useCallback(async (): Promise<string | false> => {
    setIsSaving(true)
    try {
      const data = buildEntryData()
      if (entry) {
        await updateEntry(date, data as UpdateDailyEntryDto)
        setHasUserChanges(false)
        return entry.id
      } else {
        const created = await createEntry(data)
        setHasUserChanges(false)
        return created?.id ?? false
      }
    } catch {
      return false
    } finally {
      setIsSaving(false)
    }
  }, [buildEntryData, entry, date, updateEntry, createEntry])

  // Submit entry
  const submitEntry = useCallback(
    async (acknowledgeWarnings: boolean = false): Promise<{
      success: boolean
      requiresConfirmation?: boolean
      messages?: ValidationMessage[]
    }> => {
      setIsSubmitting(true)
      try {
        const data = buildEntryData()
        if (!entry) {
          await createEntry(data)
        } else {
          await updateEntry(date, data as UpdateDailyEntryDto)
        }

        const result = await submitEntryApi(date, acknowledgeWarnings)

        if (result.success) {
          await fetchEntry(date)
          return { success: true }
        } else if (result.requiresConfirmation && result.validation) {
          const messages = result.validation.messages.filter((m) => m.type === "warning")
          return { success: false, requiresConfirmation: true, messages }
        } else if (result.validation?.hasBlocks) {
          const messages = result.validation.messages.filter((m) => m.type === "block")
          return { success: false, messages }
        } else {
          // Re-fetch entry to re-sync client state with server (e.g. if entry was
          // committed as SUBMITTED before a post-processing error occurred)
          await fetchEntry(date)
          return { success: false, messages: [{ type: "block", message: result.error || "Failed to submit" }] }
        }
      } catch {
        await fetchEntry(date)
        return { success: false, messages: [{ type: "block", message: "Failed to submit entry" }] }
      } finally {
        setIsSubmitting(false)
      }
    },
    [buildEntryData, entry, date, createEntry, updateEntry, submitEntryApi, fetchEntry]
  )

  // Refresh functions
  const refreshEntry = useCallback(async () => {
    await fetchEntry(date)
  }, [fetchEntry, date])

  const refreshWallet = useCallback(() => {
    fetchWallet()
  }, [fetchWallet])

  // Reopen entry
  const reopenEntry = useCallback(async (reason: string): Promise<boolean> => {
    const success = await reopenEntryApi(date, reason)
    if (success) {
      await fetchEntry(date)
    }
    return success
  }, [reopenEntryApi, date, fetchEntry])

  // Computed states
  const isSubmitted = entry?.status === "SUBMITTED"
  const isReadOnly = isSubmitted || !editPermission.canEdit
  const isDirty = hasUserChanges && !isReadOnly
  const amendments = entry?.amendments ?? []

  return {
    // Data
    entry,
    localData,
    calculationData,
    totals,
    variance,

    // Wallet data
    dayTopups,
    totalTopups,
    reloadSalesTotal,

    // Credit data
    linkedCreditTotal,
    gridCreditTotal,
    creditBalanced,

    // Amendment data
    amendments,

    // State
    isLoading,
    isSaving,
    isSubmitting,
    isDirty,
    error,
    isSubmitted,
    isReadOnly,
    editPermission,

    // Handlers
    handleValueChange,
    handleQuantityChange,
    handleFieldChange,
    getCategoryTotal,

    // Actions
    saveDraft,
    submitEntry,
    validateBeforeSubmit,
    refreshEntry,
    refreshWallet,
    reopenEntry,
  }
}
