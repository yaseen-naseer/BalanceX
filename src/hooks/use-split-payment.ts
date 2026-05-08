"use client"

import { useCallback, useMemo, useState } from "react"

export type PaymentMethod = "CASH" | "TRANSFER" | "CHEQUE"

export interface PaymentSplit {
  method: PaymentMethod
  amount: string
}

export const PAYMENT_METHODS: readonly PaymentMethod[] = ["CASH", "TRANSFER", "CHEQUE"] as const

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: "Cash",
  TRANSFER: "Transfer",
  CHEQUE: "Cheque",
}

/**
 * Wallet stores `source` as `CASH | BANK`. Cheque + Transfer both collapse to BANK
 * (single source of bank cashflow). Use this when persisting a wallet top-up.
 */
export function paymentMethodToWalletSource(method: PaymentMethod): "CASH" | "BANK" {
  return method === "CASH" ? "CASH" : "BANK"
}

const ALL_METHODS = PAYMENT_METHODS

export interface UseSplitPaymentOptions {
  /** Max simultaneous splits (defaults to 3 — matches the available payment methods). */
  maxSplits?: number
  /** Method seeded into the first split (defaults to CASH). */
  defaultMethod?: PaymentMethod
}

export interface UseSplitPaymentResult {
  /** Whether the dialog is currently in split mode. */
  isSplit: boolean
  /** Flip between split and single mode; resets the split list when entering split mode. */
  toggle: () => void

  splits: PaymentSplit[]
  addSplit: () => void
  removeSplit: (index: number) => void
  updateSplit: (index: number, patch: Partial<PaymentSplit>) => void

  /** Sum of split amounts as a number (NaN-safe). */
  splitTotal: number

  /** Maximum allowed simultaneous splits. */
  maxSplits: number

  /** Reset state to defaults — call from dialog reset handlers. */
  reset: () => void
}

/**
 * State-only hook for the wallet top-up + credit-settlement split-payment UI.
 * Pair with `<SplitPaymentInput />` for the rendering.
 */
export function useSplitPayment(opts: UseSplitPaymentOptions = {}): UseSplitPaymentResult {
  const maxSplits = Math.min(Math.max(opts.maxSplits ?? 3, 1), ALL_METHODS.length)
  const defaultMethod: PaymentMethod = opts.defaultMethod ?? "CASH"

  const initialSplits = useMemo<PaymentSplit[]>(
    () => [{ method: defaultMethod, amount: "" }],
    [defaultMethod],
  )

  const [isSplit, setIsSplit] = useState(false)
  const [splits, setSplits] = useState<PaymentSplit[]>(initialSplits)

  const splitTotal = useMemo(
    () => splits.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0),
    [splits],
  )

  const addSplit = useCallback(() => {
    setSplits((prev) => {
      if (prev.length >= maxSplits) return prev
      const used = new Set(prev.map((s) => s.method))
      const next = ALL_METHODS.find((m) => !used.has(m))
      return next ? [...prev, { method: next, amount: "" }] : prev
    })
  }, [maxSplits])

  const removeSplit = useCallback((index: number) => {
    setSplits((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)))
  }, [])

  const updateSplit = useCallback((index: number, patch: Partial<PaymentSplit>) => {
    setSplits((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  }, [])

  const reset = useCallback(() => {
    setIsSplit(false)
    setSplits([{ method: defaultMethod, amount: "" }])
  }, [defaultMethod])

  const toggle = useCallback(() => {
    setIsSplit((prev) => {
      const next = !prev
      // Entering split mode resets the list to a single seed split. Leaving split
      // mode also resets so a stale partial entry doesn't bleed back in.
      if (next) {
        setSplits([{ method: defaultMethod, amount: "" }])
      }
      return next
    })
  }, [defaultMethod])

  return { isSplit, toggle, splits, addSplit, removeSplit, updateSplit, splitTotal, maxSplits, reset }
}
