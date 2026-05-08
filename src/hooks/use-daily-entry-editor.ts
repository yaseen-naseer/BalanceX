"use client"

import { useState, useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react"
import { createEmptyLocalData, entryToLocalData } from "./use-daily-entry-form-helpers"
import type { DailyEntryWithRelations } from "@/types"
import {
  type Category,
  type CustomerType,
  type PaymentMethod,
  type LocalEntryData,
} from "@/components/daily-entry/types"

export interface UseDailyEntryEditorOptions {
  /**
   * The current `WalletSettings.openingBalance` value (system-wide running balance).
   * Used by `overrideWalletOpening` to compute the delta and persist a new
   * system-wide opening if the user adjusts today's wallet opening.
   */
  walletOpeningBalanceSetting: number
  /** From `useWallet().setOpeningBalance` — persists the wallet's all-time opening + reason. */
  persistWalletOpeningBalance: (balance: number, reason: string) => Promise<boolean>
}

export interface UseDailyEntryEditorReturn {
  // --- State ---
  localData: LocalEntryData
  setLocalData: Dispatch<SetStateAction<LocalEntryData>>
  hasUserChanges: boolean
  setHasUserChanges: Dispatch<SetStateAction<boolean>>
  walletOpeningSource: string
  walletOpeningReason: string | null

  // --- Server → form sync ---
  /**
   * Mirror a freshly-loaded server entry into the local form state.
   * **Returns false** (no-op) if the user has unsaved changes — protects in-progress edits.
   * Returns true when the sync actually ran, so the caller can chain follow-up actions
   * (e.g. resetting auto-load flags).
   */
  syncFromEntry: (entry: DailyEntryWithRelations | null) => boolean

  // --- Field handlers ---
  handleValueChange: (
    category: Category,
    customerType: CustomerType,
    paymentMethod: PaymentMethod,
    value: number,
  ) => void
  handleQuantityChange: (category: Category, value: number) => void
  handleFieldChange: (field: string, value: number | string) => void

  // --- Wallet override ---
  overrideWalletOpening: (amount: number, reason: string) => Promise<boolean>

  // --- Derived helpers ---
  getCategoryTotal: (category: Category) => number
}

/**
 * Owns the editable form state for a daily entry: `localData` (categories +
 * cash drawer + wallet + notes), the dirty flag (`hasUserChanges`), and the
 * wallet-opening override metadata (`walletOpeningSource`, `walletOpeningReason`).
 *
 * Exposes:
 * - The state itself + setters (so sibling hooks like `useDailyEntryLineItems`
 *   and `useDailyEntryAutoLoad` can write to `localData` / `hasUserChanges`).
 * - A `syncFromEntry()` method that mirrors a server entry into the form state,
 *   protected by the same unsaved-changes guard the original orchestrator used.
 * - The four user-facing form handlers (`handleValueChange`, `handleQuantityChange`,
 *   `handleFieldChange`, `overrideWalletOpening`) and `getCategoryTotal`.
 */
export function useDailyEntryEditor({
  walletOpeningBalanceSetting,
  persistWalletOpeningBalance,
}: UseDailyEntryEditorOptions): UseDailyEntryEditorReturn {
  const [localData, setLocalData] = useState<LocalEntryData>(createEmptyLocalData())
  const [hasUserChanges, setHasUserChanges] = useState(false)
  const [walletOpeningSource, setWalletOpeningSource] = useState<string>("PREVIOUS_DAY")
  const [walletOpeningReason, setWalletOpeningReason] = useState<string | null>(null)

  // Mirror state into a ref so `syncFromEntry` can read the latest value without
  // re-creating itself on every render. The ref is updated post-commit via a
  // dependency-less effect — `syncFromEntry` is only called from the orchestrator's
  // own entry-sync effect, which runs after this one in the commit phase, so the
  // ref always has the freshest value by the time it's read.
  const hasUserChangesRef = useRef(false)
  useEffect(() => {
    hasUserChangesRef.current = hasUserChanges
  })

  const syncFromEntry = useCallback((entry: DailyEntryWithRelations | null): boolean => {
    if (hasUserChangesRef.current) return false
    setLocalData(entryToLocalData(entry))
    setHasUserChanges(false)
    setWalletOpeningSource(entry?.wallet?.openingSource || "PREVIOUS_DAY")
    setWalletOpeningReason(null)
    return true
  }, [])

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
    [],
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

  const overrideWalletOpening = useCallback(
    async (amount: number, reason: string): Promise<boolean> => {
      // Shift the system-wide WalletSettings.openingBalance by the same delta so
      // the wallet's all-time current balance stays consistent with today's
      // corrected opening.
      const oldTodayOpening = localData.wallet.opening
      const delta = amount - oldTodayOpening
      if (delta !== 0) {
        const newSystemOpening = walletOpeningBalanceSetting + delta
        const ok = await persistWalletOpeningBalance(
          newSystemOpening < 0 ? 0 : newSystemOpening,
          reason,
        )
        if (!ok) return false
      }
      setLocalData((prev) => ({
        ...prev,
        wallet: { ...prev.wallet, opening: amount },
      }))
      setWalletOpeningSource("MANUAL")
      setWalletOpeningReason(reason)
      setHasUserChanges(true)
      return true
    },
    [localData.wallet.opening, walletOpeningBalanceSetting, persistWalletOpeningBalance],
  )

  const getCategoryTotal = useCallback(
    (category: Category) => {
      const cat = localData.categories[category]
      return (
        cat.consumerCash + cat.consumerTransfer + cat.consumerCredit +
        cat.corporateCash + cat.corporateTransfer + cat.corporateCredit
      )
    },
    [localData],
  )

  return {
    localData,
    setLocalData,
    hasUserChanges,
    setHasUserChanges,
    walletOpeningSource,
    walletOpeningReason,
    syncFromEntry,
    handleValueChange,
    handleQuantityChange,
    handleFieldChange,
    overrideWalletOpening,
    getCategoryTotal,
  }
}
