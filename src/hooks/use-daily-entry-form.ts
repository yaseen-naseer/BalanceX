"use client"

import { useState, useCallback, useEffect, useMemo } from "react"
import { useDailyEntry, type CalculationData } from "./use-daily-entry"
import { useWallet } from "./use-wallet"
import { useAuth } from "./use-auth"
import { useLivePolling } from "./use-live-polling"
import { useDailyEntryLineItems } from "./use-daily-entry-line-items"
import { useDailyEntryCalculations } from "./use-daily-entry-calculations"
import { useDailyEntryValidation, type ValidationMessage, type ValidationResult } from "./use-daily-entry-validation"
import { useDailyEntrySubmission } from "./use-daily-entry-submission"
import { useDailyEntryAutoLoad } from "./use-daily-entry-auto-load"
import { useDailyEntryEditor } from "./use-daily-entry-editor"
import { useBusinessRules } from "./use-business-rules"
import { canEditDailyEntry } from "@/lib/permissions"
import type { DailyEntryWithRelations, CreateSaleLineItemDto, SaleLineItemData } from "@/types"
import {
  type Category,
  type CustomerType,
  type PaymentMethod,
  type LocalEntryData,
  type TotalsData,
  type VarianceData,
} from "@/components/daily-entry/types"

// Re-export types for consumers
export type { ValidationMessage, ValidationResult }

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
  dayTopups: Array<{ id: string; amount: number; paidAmount?: number; source: string; notes?: string | null; splitGroupId?: string | null }>
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
  activeEditors: Array<{ userId: string; userName: string }>

  // Wallet opening override
  walletOpeningSource: string
  walletOpeningReason: string | null
  overrideWalletOpening: (amount: number, reason: string) => Promise<boolean>

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
  deleteTopup: (id: string) => Promise<boolean>
  editTopup: (id: string, data: { amount: number; paidAmount?: number; source: string; notes?: string }) => Promise<boolean>
  reopenEntry: (reason: string) => Promise<boolean>
}

/**
 * Top-level orchestrator for the daily-entry editing flow. Composes:
 *
 * - `useDailyEntry` / `useWallet` — server data sources.
 * - `useDailyEntryEditor` — local form state + edit handlers (Stage 3 extraction).
 * - `useDailyEntryAutoLoad` — auto-fill wallet/cash openings from previous day.
 * - `useDailyEntryLineItems` — sale-line-item CRUD bound to the current entry.
 * - `useDailyEntryCalculations` — totals + variance + linked credit derivations.
 * - `useDailyEntryValidation` — pre-submit validation messages.
 * - `useDailyEntrySubmission` — saveDraft / submit / refresh / reopen mutations.
 * - `useLivePolling` — multi-user presence + change polling.
 *
 * Returns a single object (`UseDailyEntryFormReturn`) consumed by the daily-entry
 * page and pushed into the daily-entry context. Public API is intentionally wide
 * because every section of the page reads `form.*` fields directly — preserved
 * byte-identically across the Phase 2.5 stages.
 */
export function useDailyEntryForm({ date }: UseDailyEntryFormOptions): UseDailyEntryFormReturn {
  // --- Core data hooks ---
  const {
    entry,
    calculationData,
    previousCashClosing,
    isLoading,
    error,
    fetchEntry,
    createEntry,
    updateEntry,
    submitEntry: submitEntryApi,
    reopenEntry: reopenEntryApi,
  } = useDailyEntry({ date })

  const {
    openingBalance: walletOpeningBalanceSetting,
    fetchWallet,
    getTotalTopupsByDate,
    getTopupsByDate,
    getPreviousClosing,
    editTopup,
    deleteTopup,
    setOpeningBalance: persistWalletOpeningBalance,
  } = useWallet()

  const { user } = useAuth()
  const { rules: businessRules } = useBusinessRules()

  // --- Form state + handlers (extracted hook) ---
  const editor = useDailyEntryEditor({
    walletOpeningBalanceSetting,
    persistWalletOpeningBalance,
  })

  // --- Auto-load (wallet opening from previous day, cash drawer from previous day) ---
  const { resetAutoLoadFlags } = useDailyEntryAutoLoad({
    isLoading,
    entry,
    date,
    getPreviousClosing,
    previousCashClosing,
    walletOpening: editor.localData.wallet.opening,
    cashDrawerOpening: editor.localData.cashDrawer.opening,
    setLocalData: editor.setLocalData,
    setHasUserChanges: editor.setHasUserChanges,
  })

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
    setLocalData: editor.setLocalData,
  })

  // --- Wallet data ---
  // `getTopupsByDate` / `getTotalTopupsByDate` already close over `topups`,
  // so listing `topups` again would be a redundant dep.
  const dayTopups = useMemo(
    () => getTopupsByDate(date).map(t => ({
      id: t.id,
      amount: Number(t.amount),
      paidAmount: t.paidAmount ? Number(t.paidAmount) : undefined,
      source: t.source,
      notes: t.notes,
      splitGroupId: t.splitGroupId,
    })),
    [getTopupsByDate, date]
  )

  const totalTopups = useMemo(
    () => getTotalTopupsByDate(date),
    [getTotalTopupsByDate, date]
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
    localData: editor.localData,
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
    walletOpening: editor.localData.wallet.opening,
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
    localData: editor.localData,
    walletOpeningSource: editor.walletOpeningSource,
    createEntry,
    updateEntry,
    submitEntryApi,
    reopenEntryApi,
    fetchEntry,
    refreshLineItems,
  })

  // Wrap saveDraft to clear the dirty flag on success (via editor's setter).
  const saveDraft = useCallback(
    () => saveDraftInternal(editor.setHasUserChanges),
    [saveDraftInternal, editor.setHasUserChanges]
  )

  // --- Live polling ---
  const pollUrl = entry?.id ? `/api/daily-entries/${date}/poll` : null
  const [activeEditors, setActiveEditors] = useState<Array<{ userId: string; userName: string }>>([])
  const { isLive, lastChecked } = useLivePolling({
    url: pollUrl,
    intervalMs: 10_000,
    enabled: !isLoading && !isSaving && !isSubmitting,
    onUpdate: useCallback(async () => {
      await refreshLineItems()
      fetchWallet()
      await fetchEntry(date, { silent: true })
    }, [fetchEntry, date, refreshLineItems, fetchWallet]),
    onData: useCallback((data: unknown) => {
      const d = data as { activeEditors?: Array<{ userId: string; userName: string }> }
      setActiveEditors(d?.activeEditors ?? [])
    }, []),
  })

  // Clean up presence on page unload or date change
  useEffect(() => {
    if (!pollUrl) return
    const handleUnload = () => {
      fetch(pollUrl, { method: 'DELETE', keepalive: true }).catch(() => {})
    }
    window.addEventListener('beforeunload', handleUnload)
    return () => {
      window.removeEventListener('beforeunload', handleUnload)
      handleUnload() // Also clean up when date changes or component unmounts
    }
  }, [pollUrl])

  // --- Edit permissions (uses owner-tunable accountant window from BusinessRulesSettings) ---
  const editPermission = useMemo(() => {
    if (!user?.role) return { canEdit: false, reason: "Loading..." }
    const entryDate = new Date(date)
    const isOwnEntry = !entry || entry.createdBy === user.id
    return canEditDailyEntry(user.role, entryDate, isOwnEntry, {
      accountantEditWindowDays: businessRules.accountantEditWindowDays,
    })
  }, [user?.role, user?.id, date, entry, businessRules.accountantEditWindowDays])

  // --- Sync entry → localData (skipped if user has unsaved changes; ref check inside editor) ---
  useEffect(() => {
    if (isLoading) return
    const synced = editor.syncFromEntry(entry)
    // Only allow auto-load to refire if the sync actually applied — otherwise the
    // user's unsaved changes are still in localData and we'd over-write them.
    if (synced) resetAutoLoadFlags()
    // editor.syncFromEntry + resetAutoLoadFlags are stable callbacks; intentionally
    // excluded to keep the same trigger conditions as before.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry, isLoading])

  // Fetch wallet when date changes
  useEffect(() => {
    fetchWallet()
  }, [date, fetchWallet])

  const refreshWallet = useCallback(() => {
    fetchWallet()
  }, [fetchWallet])

  // --- Computed states ---
  const isSubmitted = entry?.status === "SUBMITTED"
  const isReadOnly = isSubmitted || !editPermission.canEdit
  const isDirty = editor.hasUserChanges && !isReadOnly
  const amendments = entry?.amendments ?? []

  return {
    entry,
    localData: editor.localData,
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
    activeEditors,
    walletOpeningSource: editor.walletOpeningSource,
    walletOpeningReason: editor.walletOpeningReason,
    overrideWalletOpening: editor.overrideWalletOpening,
    handleValueChange: editor.handleValueChange,
    handleQuantityChange: editor.handleQuantityChange,
    handleFieldChange: editor.handleFieldChange,
    getCategoryTotal: editor.getCategoryTotal,
    saveDraft,
    submitEntry,
    validateBeforeSubmit,
    refreshEntry,
    refreshWallet,
    deleteTopup,
    editTopup,
    reopenEntry,
  }
}
