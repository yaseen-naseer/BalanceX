"use client"

import { useCallback } from "react"
import type { VarianceData } from "@/components/daily-entry/types"
import { VARIANCE_THRESHOLD } from "@/components/daily-entry/types"
import { CURRENCY_CODE, WALLET_VARIANCE_THRESHOLD } from "@/lib/constants"
import type { ValidationMessage, ValidationResult } from "@/lib/validations/shared"

export type { ValidationMessage, ValidationResult }

interface UseDailyEntryValidationOptions {
  variance: VarianceData
  reloadSalesTotal: number
  totalTopups: number
  walletOpening: number
}

export function useDailyEntryValidation({
  variance,
  reloadSalesTotal,
  totalTopups,
  walletOpening,
}: UseDailyEntryValidationOptions) {
  const validateBeforeSubmit = useCallback((): ValidationResult => {
    const messages: ValidationMessage[] = []
    const absCashVariance = Math.abs(variance.cashVariance)

    // Hard block if reload sales exceed wallet balance
    const availableWalletBalance = walletOpening + totalTopups
    if (reloadSalesTotal > availableWalletBalance) {
      messages.push({
        type: "block",
        message: `Reload sales (${reloadSalesTotal.toLocaleString()} ${CURRENCY_CODE}) exceed available wallet balance (${availableWalletBalance.toLocaleString()} ${CURRENCY_CODE}). Please add a top-up or reduce reload sales.`,
      })
    }

    // Hard block if cash variance exceeds threshold
    if (absCashVariance > VARIANCE_THRESHOLD) {
      messages.push({
        type: "block",
        message: `Cash variance exceeds ${CURRENCY_CODE} ${VARIANCE_THRESHOLD} (Current: ${variance.cashVariance > 0 ? "+" : ""}${variance.cashVariance} ${CURRENCY_CODE}).`,
      })
    }

    // Hard block if wallet variance exceeds threshold
    const absWalletVariance = Math.abs(variance.walletVariance)
    if (absWalletVariance > WALLET_VARIANCE_THRESHOLD) {
      messages.push({
        type: "block",
        message: `Wallet variance exceeds ${CURRENCY_CODE} ${WALLET_VARIANCE_THRESHOLD} (Current: ${variance.walletVariance > 0 ? "+" : ""}${variance.walletVariance} ${CURRENCY_CODE}).`,
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
        message: `Cash variance: ${variance.cashVariance > 0 ? "+" : ""}${variance.cashVariance} ${CURRENCY_CODE}`,
      })
    }

    // Warning for non-zero wallet variance within threshold
    if (absWalletVariance > 0) {
      messages.push({
        type: "warning",
        message: `Wallet variance: ${variance.walletVariance > 0 ? "+" : ""}${variance.walletVariance} ${CURRENCY_CODE}`,
      })
    }

    const hasWarnings = messages.some((m) => m.type === "warning")
    return { canSubmit: true, hasWarnings, hasBlocks: false, messages }
  }, [variance, reloadSalesTotal, totalTopups, walletOpening])

  return { validateBeforeSubmit }
}
