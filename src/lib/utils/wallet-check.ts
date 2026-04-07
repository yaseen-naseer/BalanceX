import { prisma } from "@/lib/db"
import { calculateReloadWalletCost } from "./balance"
import { getWholesaleReloadTotal } from "./wholesale-reload"
import { stripRetailGst } from "./balance"
import { CURRENCY_CODE } from "@/lib/constants"
import type { TxClient } from "./atomic"

/**
 * Get the current wallet balance (server-only).
 * Formula: opening + totalTopups - totalReloadSales
 *
 * Accepts an optional transaction client for use inside atomic transactions.
 */
export async function getCurrentWalletBalance(tx?: TxClient): Promise<number> {
  const db = tx ?? prisma
  const [walletSettings, topupsAgg, reloadCategories, wholesaleReload] = await Promise.all([
    db.walletSettings.findFirst({ orderBy: { openingDate: "desc" } }),
    db.walletTopup.aggregate({ _sum: { amount: true } }),
    db.dailyEntryCategory.findMany({
      where: { category: { in: ["RETAIL_RELOAD", "WHOLESALE_RELOAD"] } },
    }),
    getWholesaleReloadTotal(tx),
  ])

  const opening = walletSettings ? Number(walletSettings.openingBalance) : 0
  const totalTopups = Number(topupsAgg._sum.amount ?? 0)
  const totalReloadSales = calculateReloadWalletCost(reloadCategories, wholesaleReload)

  return Math.round((opening + totalTopups - totalReloadSales) * 100) / 100
}

/**
 * Calculate the wallet cost (deduction) for a given sale.
 * - Retail reload: strips 8% GST from the sale amount
 * - Wholesale reload: the amount IS the reload (wallet deduction)
 */
export function getWalletDeduction(
  category: string,
  amount: number
): number {
  if (category === "RETAIL_RELOAD") {
    return stripRetailGst(amount)
  }
  if (category === "WHOLESALE_RELOAD") {
    return amount
  }
  return 0
}

/**
 * Check if a reload sale can be made given the current wallet balance.
 * Returns null if OK, or an error message string if insufficient balance.
 *
 * Accepts an optional transaction client for use inside atomic transactions.
 */
export async function checkWalletSufficiency(
  category: string,
  walletDeductionAmount: number,
  tx?: TxClient
): Promise<string | null> {
  if (category !== "RETAIL_RELOAD" && category !== "WHOLESALE_RELOAD") {
    return null // not a reload category, no wallet check needed
  }

  const balance = await getCurrentWalletBalance(tx)

  if (walletDeductionAmount > balance) {
    return `Insufficient wallet balance. Current balance: ${balance.toLocaleString()} ${CURRENCY_CODE}, required: ${walletDeductionAmount.toLocaleString()} ${CURRENCY_CODE}`
  }

  return null
}
