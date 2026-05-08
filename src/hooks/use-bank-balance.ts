"use client"

import { useEffect, useState } from "react"
import { useApiClient } from "./use-api-client"

interface BankBalanceResponse {
  currentBalance: number
}

/**
 * Fetch the current bank balance — used by dialogs that need to warn when a
 * bank-sourced action would exceed available balance (e.g. wallet top-up).
 *
 * Pass `enabled` to gate the fetch (typically the dialog's `isOpen` state) so
 * the call only fires when the dialog opens. Refires on every open transition,
 * giving up-to-date balance even if other tabs added bank transactions.
 *
 * Routes through `useApiClient`, so 401 responses trigger the S16 forced-signOut
 * flow (raw `fetch()` would not).
 */
export function useBankBalance(enabled: boolean): number | null {
  const api = useApiClient()
  const [balance, setBalance] = useState<number | null>(null)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    api.get<BankBalanceResponse>("/api/bank").then((result) => {
      if (cancelled) return
      if (result.success && result.data?.currentBalance != null) {
        setBalance(result.data.currentBalance)
      }
    })
    return () => {
      cancelled = true
    }
  }, [enabled, api])

  return balance
}
