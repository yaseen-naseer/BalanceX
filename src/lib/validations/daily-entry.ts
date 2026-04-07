import { prisma } from "@/lib/db"
import { calculateCashDrawer } from "@/lib/calculations/cash-drawer"
import { calculateWallet } from "@/lib/calculations/wallet"
import { CASH_VARIANCE_THRESHOLD, WALLET_VARIANCE_THRESHOLD, CURRENCY_CODE } from "@/lib/constants"
import type { ValidationMessage } from "@/lib/validations/shared"

export type { ValidationMessage }

/**
 * Configurable variance thresholds (in MVR)
 * These can be overridden via environment variables.
 * For production, consider moving to a database settings table.
 */
const VARIANCE_LIMIT = {
  CASH_BLOCK: Number(process.env.VARIANCE_CASH_BLOCK_LIMIT) || CASH_VARIANCE_THRESHOLD,
  WALLET_BLOCK: Number(process.env.VARIANCE_WALLET_BLOCK_LIMIT) || WALLET_VARIANCE_THRESHOLD,
}

export interface ValidationResult {
  canSubmit: boolean
  hasWarnings: boolean
  hasBlocks: boolean
  creditBalanced: boolean
  cashVariance: {
    value: number
    status: "ok" | "warning" | "block"
  }
  walletVariance: {
    value: number
    status: "ok" | "warning" | "block"
  }
  messages: ValidationMessage[]
}

export async function validateDailyEntry(entryId: string): Promise<ValidationResult> {
  const entry = await prisma.dailyEntry.findUnique({
    where: { id: entryId },
    include: {
      categories: true,
      cashDrawer: true,
      wallet: true,
      creditSales: true,
    },
  })

  if (!entry) {
    throw new Error("Entry not found")
  }

  const result: ValidationResult = {
    canSubmit: true,
    hasWarnings: false,
    hasBlocks: false,
    creditBalanced: true,
    cashVariance: { value: 0, status: "ok" },
    walletVariance: { value: 0, status: "ok" },
    messages: [],
  }

  // 0. Zero-sales warning (B16) — warn if all category totals are zero
  const totalSales = entry.categories.reduce(
    (sum, cat) =>
      sum +
      Number(cat.consumerCash) +
      Number(cat.consumerTransfer) +
      Number(cat.consumerCredit) +
      Number(cat.corporateCash) +
      Number(cat.corporateTransfer) +
      Number(cat.corporateCredit),
    0
  )
  if (totalSales === 0) {
    result.hasWarnings = true
    result.messages.push({
      type: "warning",
      message: "Total sales are zero. Are you sure you want to submit an empty entry?",
      field: "sales",
    })
  }

  // 1. Credit balance check (total credit in grid vs total linked credit sales)
  const dhiraaguCategory = entry.categories.find(
    (c) => c.category === "DHIRAAGU_BILLS"
  )

  if (dhiraaguCategory) {
    const gridTotalCredit =
      Number(dhiraaguCategory.consumerCredit) + Number(dhiraaguCategory.corporateCredit)
    const linkedTotalCredit = entry.creditSales.reduce(
      (sum, sale) => sum + Number(sale.amount),
      0
    )

    const creditMismatch = Math.abs(gridTotalCredit - linkedTotalCredit) > 0.01

    if (creditMismatch) {
      result.creditBalanced = false
      result.canSubmit = false
      result.hasBlocks = true
      result.messages.push({
        type: "block",
        message: `Credit sales do not match grid totals: Grid ${CURRENCY_CODE} ${gridTotalCredit.toFixed(2)} ≠ Linked ${CURRENCY_CODE} ${linkedTotalCredit.toFixed(2)}`,
        field: "credit",
      })
    }
  }

  // 2. Cash variance check
  if (entry.cashDrawer) {
    const cashCalc = await calculateCashDrawer(entryId, entry.date)
    const cashVar = Math.abs(cashCalc.variance)
    result.cashVariance.value = cashCalc.variance

    if (cashVar > VARIANCE_LIMIT.CASH_BLOCK) {
      result.cashVariance.status = "block"
      result.canSubmit = false
      result.hasBlocks = true
      result.messages.push({
        type: "block",
        message: `Cash variance ${CURRENCY_CODE} ${cashVar.toFixed(2)} exceeds ${CURRENCY_CODE} ${VARIANCE_LIMIT.CASH_BLOCK} limit`,
        field: "cash_variance",
      })
    } else if (cashVar > 0) {
      result.cashVariance.status = "warning"
      result.hasWarnings = true
      result.messages.push({
        type: "warning",
        message: `Cash variance: ${CURRENCY_CODE} ${cashCalc.variance.toFixed(2)}`,
        field: "cash_variance",
      })
    }
  }

  // 3. Wallet variance — informational only, shown in UI, not a submission blocker
  if (entry.wallet) {
    const walletCalc = await calculateWallet(entryId, entry.date)
    result.walletVariance.value = walletCalc.variance
    if (Math.abs(walletCalc.variance) > 0) {
      result.walletVariance.status = "warning"
    }
  }

  return result
}

export async function validateBeforeSubmit(
  entryId: string
): Promise<{ valid: boolean; validation: ValidationResult }> {
  const validation = await validateDailyEntry(entryId)

  return {
    valid: validation.canSubmit,
    validation,
  }
}
