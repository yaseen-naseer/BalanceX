import { prisma } from "@/lib/db"
import { calculateCashDrawer } from "@/lib/calculations/cash-drawer"
import { calculateWallet } from "@/lib/calculations/wallet"

/**
 * Configurable variance thresholds (in MVR)
 * These can be overridden via environment variables.
 * For production, consider moving to a database settings table.
 */
const VARIANCE_THRESHOLD = {
  /** Maximum allowed cash variance before blocking submission (MVR) */
  CASH_BLOCK: Number(process.env.VARIANCE_CASH_BLOCK_LIMIT) || 500,
  /** Maximum allowed wallet variance before blocking submission (MVR) */
  WALLET_BLOCK: Number(process.env.VARIANCE_WALLET_BLOCK_LIMIT) || 500,
}

export interface ValidationMessage {
  type: "warning" | "block"
  message: string
  field?: string
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
        message: `Credit sales do not match grid totals: Grid MVR ${gridTotalCredit.toFixed(2)} ≠ Linked MVR ${linkedTotalCredit.toFixed(2)}`,
        field: "credit",
      })
    }
  }

  // 2. Cash variance check
  if (entry.cashDrawer) {
    const cashCalc = await calculateCashDrawer(entryId, entry.date)
    const cashVar = Math.abs(cashCalc.variance)
    result.cashVariance.value = cashCalc.variance

    if (cashVar > VARIANCE_THRESHOLD.CASH_BLOCK) {
      result.cashVariance.status = "block"
      result.canSubmit = false
      result.hasBlocks = true
      result.messages.push({
        type: "block",
        message: `Cash variance MVR ${cashVar.toFixed(2)} exceeds MVR ${VARIANCE_THRESHOLD.CASH_BLOCK} limit`,
        field: "cash_variance",
      })
    } else if (cashVar > 0) {
      result.cashVariance.status = "warning"
      result.hasWarnings = true
      result.messages.push({
        type: "warning",
        message: `Cash variance: MVR ${cashCalc.variance.toFixed(2)}`,
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
