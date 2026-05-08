"use client"

import { useState, useEffect, useRef, useCallback, type Dispatch, type SetStateAction } from "react"
import type { DailyEntryWithRelations } from "@/types"
import type { LocalEntryData } from "@/components/daily-entry/types"

/**
 * The shape returned by `useWallet().getPreviousClosing` — kept inline here
 * (instead of importing) so the hook is decoupled from the wallet implementation.
 */
interface PreviousClosingData {
  previousClosing: number
  previousDate: string | null
  source: "PREVIOUS_DAY" | "INITIAL_SETUP"
}

export interface UseDailyEntryAutoLoadOptions {
  isLoading: boolean
  entry: DailyEntryWithRelations | null
  date: string
  /** Wallet hook's `getPreviousClosing` — fetches the prior day's wallet closing. */
  getPreviousClosing: (date: string) => Promise<PreviousClosingData | null>
  /** Previous day's cash drawer closing (already loaded by `useDailyEntry`). */
  previousCashClosing: number | null | undefined
  /** Current local wallet opening — auto-load only fires when this is 0. */
  walletOpening: number
  /** Current local cash drawer opening — auto-load only fires when this is 0. */
  cashDrawerOpening: number
  setLocalData: Dispatch<SetStateAction<LocalEntryData>>
  setHasUserChanges: Dispatch<SetStateAction<boolean>>
}

export interface UseDailyEntryAutoLoadReturn {
  /** Call this in the parent's entry-sync effect when the server entry changes. */
  resetAutoLoadFlags: () => void
}

/**
 * Owns the auto-load behaviour for a daily entry's wallet + cash-drawer opening
 * balances:
 *
 * 1. **Wallet opening**: when localData.wallet.opening is 0 and the entry's
 *    `wallet.openingSource` is `PREVIOUS_DAY` (or no entry yet), fetches the
 *    previous day's wallet closing and writes it into localData. Stale-protected
 *    via a sequence ref so a fast date-switch doesn't apply yesterday's data
 *    to today's load.
 * 2. **Cash drawer opening**: when localData.cashDrawer.opening is 0 and the
 *    parent has supplied a `previousCashClosing`, write that value in.
 *
 * Both auto-loads are guarded by per-flag state so they only fire **once** per
 * entry — manual edits afterwards are not overwritten. The parent must call
 * `resetAutoLoadFlags()` whenever it reloads the entry from the server (so
 * a fresh entry can re-trigger the auto-load).
 */
export function useDailyEntryAutoLoad({
  isLoading,
  entry,
  date,
  getPreviousClosing,
  previousCashClosing,
  walletOpening,
  cashDrawerOpening,
  setLocalData,
  setHasUserChanges,
}: UseDailyEntryAutoLoadOptions): UseDailyEntryAutoLoadReturn {
  const [walletAutoLoaded, setWalletAutoLoaded] = useState(false)
  const [cashAutoLoaded, setCashAutoLoaded] = useState(false)
  const walletLoadSeqRef = useRef(0)

  // Auto-load wallet opening from previous day's closing.
  useEffect(() => {
    const seq = ++walletLoadSeqRef.current
    const loadPreviousClosing = async () => {
      if (isLoading || walletAutoLoaded || walletOpening !== 0) return
      if (entry?.wallet && entry.wallet.openingSource !== "PREVIOUS_DAY") return

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
  }, [
    isLoading,
    entry,
    date,
    getPreviousClosing,
    walletAutoLoaded,
    walletOpening,
    setLocalData,
    setHasUserChanges,
  ])

  // Auto-load cash drawer opening from previous day's actual closing.
  // The React Compiler flags `setCashAutoLoaded(true)` as a "cascading renders" risk
  // because the effect calls setState synchronously, but the `cashAutoLoaded` guard
  // ensures it fires exactly once per entry load — no cascade. Behaviour-preserved
  // from the original single-hook implementation.
  useEffect(() => {
    if (isLoading || cashAutoLoaded) return
    if (cashDrawerOpening !== 0) return
    if (previousCashClosing == null || previousCashClosing === 0) return

    setLocalData((prev) => ({
      ...prev,
      cashDrawer: { ...prev.cashDrawer, opening: previousCashClosing },
    }))
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCashAutoLoaded(true)
    if (entry) {
      setHasUserChanges(true)
    }
  }, [
    isLoading,
    entry,
    previousCashClosing,
    cashAutoLoaded,
    cashDrawerOpening,
    setLocalData,
    setHasUserChanges,
  ])

  const resetAutoLoadFlags = useCallback(() => {
    setWalletAutoLoaded(false)
    setCashAutoLoaded(false)
  }, [])

  return { resetAutoLoadFlags }
}
