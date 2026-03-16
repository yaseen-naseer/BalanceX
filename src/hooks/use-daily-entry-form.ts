"use client"

import { useState, useCallback, useEffect, useMemo, useRef } from "react"
import { useDailyEntry, type CalculationData } from "./use-daily-entry"
import { useWallet } from "./use-wallet"
import { useAuth } from "./use-auth"
import { useSaleLineItems } from "./use-sale-line-items"
import { useLivePolling } from "./use-live-polling"
import { canEditDailyEntry } from "@/lib/permissions"
import { stripRetailGst } from "@/lib/utils/balance"
import type { DailyEntryWithRelations, CreateDailyEntryDto, UpdateDailyEntryDto, SaleLineItemData, CreateSaleLineItemDto } from "@/types"
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

  // Derive credit from linked credit sales, grouped by category and customer type
  const creditByCategory = new Map<string, { consumer: number; corporate: number }>()
  const creditCategories = ['DHIRAAGU_BILLS', 'WHOLESALE_RELOAD']
  for (const cat of creditCategories) {
    creditByCategory.set(cat, { consumer: 0, corporate: 0 })
  }
  entry.creditSales?.forEach((s) => {
    const cat = s.category || 'DHIRAAGU_BILLS'
    const existing = creditByCategory.get(cat)
    if (existing) {
      if (s.customer.type === 'CONSUMER') existing.consumer += Number(s.amount)
      else existing.corporate += Number(s.amount)
    }
  })

  entry.categories?.forEach((cat) => {
    const isDhiraagu = cat.category === 'DHIRAAGU_BILLS'
    const creditData = creditByCategory.get(cat.category)
    data.categories[cat.category] = {
      consumerCash: Number(cat.consumerCash),
      consumerTransfer: Number(cat.consumerTransfer),
      // Credit values are derived from linked credit sales per category
      consumerCredit: creditData ? creditData.consumer : 0,
      corporateCash: isDhiraagu ? Number(cat.corporateCash) : 0,
      corporateTransfer: isDhiraagu ? Number(cat.corporateTransfer) : 0,
      corporateCredit: isDhiraagu && creditData ? creditData.corporate : 0,
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
  linkedConsumerCreditTotal: number
  linkedCorporateCreditTotal: number

  // State
  isLoading: boolean
  isSaving: boolean
  isSubmitting: boolean
  isDirty: boolean
  error: string | null
  isSubmitted: boolean
  isReadOnly: boolean
  editPermission: { canEdit: boolean; reason?: string }

  // Live polling
  isLive: boolean
  lastChecked: Date | null

  // Wallet opening override
  walletOpeningSource: string
  walletOpeningReason: string | null
  overrideWalletOpening: (amount: number, reason: string) => void

  // Handlers
  handleValueChange: (category: Category, customerType: CustomerType, paymentMethod: PaymentMethod, value: number) => void
  handleQuantityChange: (category: Category, value: number) => void
  handleFieldChange: (field: string, value: number | string) => void
  getCategoryTotal: (category: Category) => number

  // Sale line items
  saleLineItems: SaleLineItemData[]
  saleLineItemsLoading: boolean
  hasLineItems: (category: string, customerType: string, paymentMethod: string) => boolean
  getLineItemsForCell: (category: string, customerType: string, paymentMethod: string) => SaleLineItemData[]
  getLineItemCount: (category: string, customerType: string, paymentMethod: string) => number
  addLineItem: (data: CreateSaleLineItemDto) => Promise<{ success: boolean; cellTotal?: number; cellCount?: number }>
  editLineItem: (id: string, data: { amount?: number; serviceNumber?: string | null; note?: string | null; reason: string }) => Promise<{ success: boolean; cellTotal?: number; cellCount?: number }>
  deleteLineItem: (id: string, reason?: string) => Promise<{ success: boolean; cellTotal?: number; cellCount?: number }>

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

  // Sale line items
  const {
    lineItems: saleLineItems,
    isLoading: saleLineItemsLoading,
    hasLineItems,
    getLineItemsForCell,
    getLineItemCount,
    addLineItem: addLineItemApi,
    editLineItem: editLineItemApi,
    deleteLineItem: deleteLineItemApi,
    refreshLineItems,
  } = useSaleLineItems(entry?.id ?? null)

  // Form state
  const [localData, setLocalData] = useState<LocalEntryData>(createEmptyLocalData())
  const [isSaving, setIsSaving] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [walletAutoLoaded, setWalletAutoLoaded] = useState(false)
  const [hasUserChanges, setHasUserChanges] = useState(false)
  const [walletOpeningSource, setWalletOpeningSource] = useState<string>("PREVIOUS_DAY")
  const [walletOpeningReason, setWalletOpeningReason] = useState<string | null>(null)
  const hasUserChangesRef = useRef(false)
  hasUserChangesRef.current = hasUserChanges

  // Live polling — detect remote changes and refetch
  // Always poll (both editor and viewer tabs). Line items, credit sales, and wallet
  // always refresh since they are server-authoritative (saved immediately).
  // Grid cells with line items are patched directly from refreshed line item data.
  const pollUrl = entry?.id ? `/api/daily-entries/${date}/poll` : null
  const { isLive, lastChecked } = useLivePolling({
    url: pollUrl,
    intervalMs: 10_000,
    enabled: !isLoading && !isSaving && !isSubmitting,
    onUpdate: useCallback(async () => {
      // Always refresh server-authoritative data
      await refreshLineItems()
      fetchWallet()
      // Refresh the full entry (includes grid data, credit sales, etc.)
      await fetchEntry(date, { silent: true })
    }, [fetchEntry, date, refreshLineItems, fetchWallet]),
  })

  // When line items change, patch grid cells that are backed by line items
  // This ensures the category grid stays in sync with line item totals
  const prevLineItemsRef = useRef<SaleLineItemData[]>([])
  useEffect(() => {
    if (saleLineItems === prevLineItemsRef.current) return
    prevLineItemsRef.current = saleLineItems
    if (saleLineItems.length === 0) return

    // Group line items by cell and compute totals
    const cellTotals = new Map<string, number>()
    for (const li of saleLineItems) {
      const ct = li.customerType.toLowerCase()
      const pm = li.paymentMethod.toLowerCase()
      const fieldKey = `${ct}${pm.charAt(0).toUpperCase() + pm.slice(1)}`
      const cellKey = `${li.category}:${fieldKey}`
      // Wholesale grid shows cash received, others show amount
      const value = li.category === "WHOLESALE_RELOAD" ? Number(li.cashAmount ?? li.amount) : Number(li.amount)
      cellTotals.set(cellKey, (cellTotals.get(cellKey) || 0) + value)
    }

    if (cellTotals.size === 0) return

    setLocalData((prev) => {
      const next = { ...prev, categories: { ...prev.categories } }
      let changed = false
      for (const [cellKey, total] of cellTotals) {
        const [category, fieldKey] = cellKey.split(":")
        const cat = prev.categories[category as Category]
        if (cat && cat[fieldKey as keyof typeof cat] !== total) {
          next.categories[category as Category] = { ...cat, [fieldKey]: total }
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [saleLineItems])

  // Check edit permissions
  const editPermission = useMemo(() => {
    if (!user?.role) return { canEdit: false, reason: "Loading..." }
    const entryDate = new Date(date)
    const isOwnEntry = !entry || entry.createdBy === user.id
    return canEditDailyEntry(user.role, entryDate, isOwnEntry)
  }, [user?.role, user?.id, date, entry])

  // Update local data when entry changes (after loading completes)
  useEffect(() => {
    // Don't reset to zeros while still loading — entry is temporarily null
    if (isLoading) return
    // Don't overwrite local edits from a background refetch
    if (hasUserChangesRef.current) return
    setLocalData(entryToLocalData(entry))
    setHasUserChanges(false)
    setWalletAutoLoaded(false)
    setWalletOpeningSource(entry?.wallet?.openingSource || "PREVIOUS_DAY")
    setWalletOpeningReason(null)
  }, [entry, isLoading])

  // Fetch wallet when date changes (entry fetch is handled by useDailyEntry)
  useEffect(() => {
    fetchWallet()
  }, [date, fetchWallet])

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

  // Calculate reload wallet cost — retail strips 8% GST, wholesale uses line items' reload amount
  const reloadSalesTotal = useMemo(() => {
    const retail = localData.categories.RETAIL_RELOAD
    const retailTotal = retail.consumerCash + retail.consumerTransfer
    // Wholesale: category grid now stores cash received, wallet cost = sum of line item amounts (reload)
    const wholesaleWalletCost = saleLineItems
      .filter((li) => li.category === 'WHOLESALE_RELOAD')
      .reduce((sum, li) => sum + Number(li.amount), 0)
    return Math.round((stripRetailGst(retailTotal) + wholesaleWalletCost) * 100) / 100
  }, [localData, saleLineItems])

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

  // Credit data — per type
  const linkedConsumerCreditTotal = useMemo(() => {
    if (!entry?.creditSales) return 0
    return entry.creditSales
      .filter((s) => s.customer.type === 'CONSUMER')
      .reduce((sum, s) => sum + Number(s.amount), 0)
  }, [entry?.creditSales])

  const linkedCorporateCreditTotal = useMemo(() => {
    if (!entry?.creditSales) return 0
    return entry.creditSales
      .filter((s) => s.customer.type === 'CORPORATE')
      .reduce((sum, s) => sum + Number(s.amount), 0)
  }, [entry?.creditSales])

  const linkedCreditTotal = useMemo(
    () => linkedConsumerCreditTotal + linkedCorporateCreditTotal,
    [linkedConsumerCreditTotal, linkedCorporateCreditTotal]
  )

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

  // Override wallet opening balance with reason
  const overrideWalletOpening = useCallback((amount: number, reason: string) => {
    setLocalData((prev) => ({
      ...prev,
      wallet: { ...prev.wallet, opening: amount },
    }))
    setWalletOpeningSource("MANUAL")
    setWalletOpeningReason(reason)
    setHasUserChanges(true)
  }, [])

  // Add line item and update local form data
  const addLineItem = useCallback(
    async (data: CreateSaleLineItemDto) => {
      const result = await addLineItemApi(data)
      if (result.success && result.cellTotal !== undefined) {
        // Update local form data to reflect new cell total
        const ctKey = data.customerType.toLowerCase() as CustomerType
        const pmKey = data.paymentMethod.toLowerCase() as PaymentMethod
        const fieldKey = `${ctKey}${pmKey.charAt(0).toUpperCase() + pmKey.slice(1)}` as keyof LocalEntryData["categories"][Category]
        setLocalData((prev) => ({
          ...prev,
          categories: {
            ...prev.categories,
            [data.category]: {
              ...prev.categories[data.category as Category],
              [fieldKey]: result.cellTotal,
            },
          },
        }))
      }
      return result
    },
    [addLineItemApi]
  )

  // Edit line item and update local form data
  const editLineItem = useCallback(
    async (id: string, data: { amount?: number; serviceNumber?: string | null; note?: string | null; reason: string }) => {
      const item = saleLineItems.find((li) => li.id === id)
      const result = await editLineItemApi(id, data)
      if (result.success && result.cellTotal !== undefined && item) {
        const ctKey = item.customerType.toLowerCase() as CustomerType
        const pmKey = item.paymentMethod.toLowerCase() as PaymentMethod
        const fieldKey = `${ctKey}${pmKey.charAt(0).toUpperCase() + pmKey.slice(1)}` as keyof LocalEntryData["categories"][Category]
        setLocalData((prev) => ({
          ...prev,
          categories: {
            ...prev.categories,
            [item.category]: {
              ...prev.categories[item.category as Category],
              [fieldKey]: result.cellTotal,
            },
          },
        }))
      }
      return result
    },
    [editLineItemApi, saleLineItems]
  )

  // Delete line item and update local form data
  const deleteLineItem = useCallback(
    async (id: string, reason?: string) => {
      // Find the line item to know which cell to update
      const item = saleLineItems.find((li) => li.id === id)
      const result = await deleteLineItemApi(id, reason)
      if (result.success && result.cellTotal !== undefined && item) {
        const ctKey = item.customerType.toLowerCase() as CustomerType
        const pmKey = item.paymentMethod.toLowerCase() as PaymentMethod
        const fieldKey = `${ctKey}${pmKey.charAt(0).toUpperCase() + pmKey.slice(1)}` as keyof LocalEntryData["categories"][Category]
        setLocalData((prev) => ({
          ...prev,
          categories: {
            ...prev.categories,
            [item.category]: {
              ...prev.categories[item.category as Category],
              [fieldKey]: result.cellTotal,
            },
          },
        }))
      }
      return result
    },
    [deleteLineItemApi, saleLineItems]
  )

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
        consumerCredit: ['DHIRAAGU_BILLS', 'WHOLESALE_RELOAD'].includes(cat.key) ? localData.categories[cat.key].consumerCredit : 0,
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
        openingSource: walletOpeningSource as "PREVIOUS_DAY" | "INITIAL_SETUP" | "MANUAL",
        closingActual: localData.wallet.closingActual,
      },
      notes: localData.notes || undefined,
    }
  }, [date, localData, walletOpeningSource])

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
  }, [variance, reloadSalesTotal, totalTopups, localData.wallet.opening])

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
    await refreshLineItems()
  }, [fetchEntry, date, refreshLineItems])

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
    linkedConsumerCreditTotal,
    linkedCorporateCreditTotal,

    // Sale line items
    saleLineItems,
    saleLineItemsLoading,
    hasLineItems,
    getLineItemsForCell,
    getLineItemCount,
    addLineItem,
    editLineItem,
    deleteLineItem,

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

    // Live polling
    isLive,
    lastChecked,

    // Wallet opening override
    walletOpeningSource,
    walletOpeningReason,
    overrideWalletOpening,

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
