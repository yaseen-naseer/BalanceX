"use client"

import { useState, useCallback, useEffect, useMemo, useRef } from "react"
import { useDailyEntry, type CalculationData } from "./use-daily-entry"
import { useWallet } from "./use-wallet"
import { useAuth } from "./use-auth"
import { useLivePolling } from "./use-live-polling"
import { useDailyEntryLineItems } from "./use-daily-entry-line-items"
import { useDailyEntryCalculations } from "./use-daily-entry-calculations"
import { useDailyEntryValidation, type ValidationMessage, type ValidationResult } from "./use-daily-entry-validation"
import { useDailyEntrySubmission } from "./use-daily-entry-submission"
import { canEditDailyEntry } from "@/lib/permissions"
import type { DailyEntryWithRelations, CreateSaleLineItemDto, SaleLineItemData } from "@/types"
import {
  type Category,
  type CustomerType,
  type PaymentMethod,
  type LocalEntryData,
  type TotalsData,
  type VarianceData,
  CATEGORIES,
} from "@/components/daily-entry/types"

// Re-export types for consumers
export type { ValidationMessage, ValidationResult }

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
  // --- Core data hooks ---
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

  // --- Form state ---
  const [localData, setLocalData] = useState<LocalEntryData>(createEmptyLocalData())
  const [walletAutoLoaded, setWalletAutoLoaded] = useState(false)
  const [hasUserChanges, setHasUserChanges] = useState(false)
  const [walletOpeningSource, setWalletOpeningSource] = useState<string>("PREVIOUS_DAY")
  const [walletOpeningReason, setWalletOpeningReason] = useState<string | null>(null)
  const hasUserChangesRef = useRef(false)
  hasUserChangesRef.current = hasUserChanges

  // --- Line items (extracted hook) ---
  const {
    saleLineItems,
    saleLineItemsLoading,
    hasLineItems,
    getLineItemsForCell,
    getLineItemCount,
    addLineItem,
    editLineItem,
    deleteLineItem,
    refreshLineItems,
  } = useDailyEntryLineItems({
    entryId: entry?.id ?? null,
    setLocalData,
  })

  // --- Wallet data ---
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

  // --- Calculations (extracted hook) ---
  const {
    totals,
    reloadSalesTotal,
    variance,
    linkedCreditTotal,
    linkedConsumerCreditTotal,
    linkedCorporateCreditTotal,
  } = useDailyEntryCalculations({
    localData,
    calculationData,
    saleLineItems,
    totalTopups,
    entry,
  })

  // --- Validation (extracted hook) ---
  const { validateBeforeSubmit } = useDailyEntryValidation({
    variance,
    reloadSalesTotal,
    totalTopups,
    walletOpening: localData.wallet.opening,
  })

  // --- Submission (extracted hook) ---
  const {
    isSaving,
    isSubmitting,
    saveDraft: saveDraftInternal,
    submitEntry,
    refreshEntry,
    reopenEntry,
  } = useDailyEntrySubmission({
    date,
    entry,
    localData,
    walletOpeningSource,
    createEntry,
    updateEntry,
    submitEntryApi,
    reopenEntryApi,
    fetchEntry,
    refreshLineItems,
  })

  // Wrap saveDraft to pass setHasUserChanges
  const saveDraft = useCallback(
    () => saveDraftInternal(setHasUserChanges),
    [saveDraftInternal]
  )

  // --- Live polling ---
  const pollUrl = entry?.id ? `/api/daily-entries/${date}/poll` : null
  const { isLive, lastChecked } = useLivePolling({
    url: pollUrl,
    intervalMs: 10_000,
    enabled: !isLoading && !isSaving && !isSubmitting,
    onUpdate: useCallback(async () => {
      await refreshLineItems()
      fetchWallet()
      await fetchEntry(date, { silent: true })
    }, [fetchEntry, date, refreshLineItems, fetchWallet]),
  })

  // --- Edit permissions ---
  const editPermission = useMemo(() => {
    if (!user?.role) return { canEdit: false, reason: "Loading..." }
    const entryDate = new Date(date)
    const isOwnEntry = !entry || entry.createdBy === user.id
    return canEditDailyEntry(user.role, entryDate, isOwnEntry)
  }, [user?.role, user?.id, date, entry])

  // --- Sync entry → localData ---
  useEffect(() => {
    if (isLoading) return
    if (hasUserChangesRef.current) return
    setLocalData(entryToLocalData(entry))
    setHasUserChanges(false)
    setWalletAutoLoaded(false)
    setWalletOpeningSource(entry?.wallet?.openingSource || "PREVIOUS_DAY")
    setWalletOpeningReason(null)
  }, [entry, isLoading])

  // Fetch wallet when date changes
  useEffect(() => {
    fetchWallet()
  }, [date, fetchWallet])

  // Auto-load wallet opening from previous day
  const walletLoadSeqRef = useRef(0)
  useEffect(() => {
    const seq = ++walletLoadSeqRef.current
    const loadPreviousClosing = async () => {
      if (isLoading || walletAutoLoaded || localData.wallet.opening !== 0) return
      if (entry?.wallet && entry.wallet.openingSource !== 'PREVIOUS_DAY') return

      const previousData = await getPreviousClosing(date)
      if (seq !== walletLoadSeqRef.current) return // stale, discard
      if (previousData && previousData.previousClosing > 0) {
        setLocalData((prev) => ({
          ...prev,
          wallet: { ...prev.wallet, opening: previousData.previousClosing },
        }))
        setWalletAutoLoaded(true)
        if (entry) {
          setHasUserChanges(true)
        }
      }
    }
    loadPreviousClosing()
  }, [isLoading, entry, date, getPreviousClosing, walletAutoLoaded, localData.wallet.opening])

  // --- Form field handlers ---
  const handleValueChange = useCallback(
    (category: Category, customerType: CustomerType, paymentMethod: PaymentMethod, value: number) => {
      setHasUserChanges(true)
      setLocalData((prev) => {
        const key = `${customerType}${paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1)}` as keyof typeof prev.categories[Category]
        return {
          ...prev,
          categories: {
            ...prev.categories,
            [category]: { ...prev.categories[category], [key]: value },
          },
        }
      })
    },
    []
  )

  const handleQuantityChange = useCallback((category: Category, value: number) => {
    setHasUserChanges(true)
    setLocalData((prev) => ({
      ...prev,
      categories: {
        ...prev.categories,
        [category]: { ...prev.categories[category], quantity: value },
      },
    }))
  }, [])

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

  const overrideWalletOpening = useCallback((amount: number, reason: string) => {
    setLocalData((prev) => ({
      ...prev,
      wallet: { ...prev.wallet, opening: amount },
    }))
    setWalletOpeningSource("MANUAL")
    setWalletOpeningReason(reason)
    setHasUserChanges(true)
  }, [])

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

  const refreshWallet = useCallback(() => {
    fetchWallet()
  }, [fetchWallet])

  // --- Computed states ---
  const isSubmitted = entry?.status === "SUBMITTED"
  const isReadOnly = isSubmitted || !editPermission.canEdit
  const isDirty = hasUserChanges && !isReadOnly
  const amendments = entry?.amendments ?? []

  return {
    entry,
    localData,
    calculationData,
    totals,
    variance,
    dayTopups,
    totalTopups,
    reloadSalesTotal,
    linkedCreditTotal,
    linkedConsumerCreditTotal,
    linkedCorporateCreditTotal,
    saleLineItems,
    saleLineItemsLoading,
    hasLineItems,
    getLineItemsForCell,
    getLineItemCount,
    addLineItem,
    editLineItem,
    deleteLineItem,
    amendments,
    isLoading,
    isSaving,
    isSubmitting,
    isDirty,
    error,
    isSubmitted,
    isReadOnly,
    editPermission,
    isLive,
    lastChecked,
    walletOpeningSource,
    walletOpeningReason,
    overrideWalletOpening,
    handleValueChange,
    handleQuantityChange,
    handleFieldChange,
    getCategoryTotal,
    saveDraft,
    submitEntry,
    validateBeforeSubmit,
    refreshEntry,
    refreshWallet,
    reopenEntry,
  }
}
