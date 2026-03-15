import { prisma } from "@/lib/db"
import { calculateReloadWalletCost } from "./balance"
import { getWholesaleReloadTotal } from "./wholesale-reload"
import { stripRetailGst } from "./balance"

/**
 * Get the current wallet balance (server-only).
 * Formula: opening + totalTopups - totalReloadSales
 */
export async function getCurrentWalletBalance(): Promise<number> {
  const [walletSettings, topupsAgg, reloadCategories, wholesaleReload] = await Promise.all([
    prisma.walletSettings.findFirst({ orderBy: { openingDate: "desc" } }),
    prisma.walletTopup.aggregate({ _sum: { amount: true } }),
    prisma.dailyEntryCategory.findMany({
      where: { category: { in: ["RETAIL_RELOAD", "WHOLESALE_RELOAD"] } },
    }),
    getWholesaleReloadTotal(),
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
 */
export async function checkWalletSufficiency(
  category: string,
  walletDeductionAmount: number
): Promise<string | null> {
  if (category !== "RETAIL_RELOAD" && category !== "WHOLESALE_RELOAD") {
    return null // not a reload category, no wallet check needed
  }

  const balance = await getCurrentWalletBalance()

  if (walletDeductionAmount > balance) {
    return `Insufficient wallet balance. Current balance: ${balance.toLocaleString()} MVR, required: ${walletDeductionAmount.toLocaleString()} MVR`
  }

  return null
}
