import { prisma } from "@/lib/db"
import type { TxClient } from "./atomic"

/**
 * Get the total wholesale reload amount (wallet cost) from line items.
 * This is the actual reload amount deducted from the wallet, NOT the cash received.
 *
 * Server-only — must not be imported from client components.
 * Accepts an optional transaction client for use inside atomic transactions.
 */
export async function getWholesaleReloadTotal(txOrFilter?: TxClient | {
  dailyEntryId?: string
  beforeDate?: Date
  dateRange?: { gte: Date; lte: Date }
}, filterArg?: {
  dailyEntryId?: string
  beforeDate?: Date
  dateRange?: { gte: Date; lte: Date }
}): Promise<number> {
  // Resolve overloaded arguments: getWholesaleReloadTotal(tx?, filter?)
  let db: TxClient | typeof prisma = prisma
  let filter: { dailyEntryId?: string; beforeDate?: Date; dateRange?: { gte: Date; lte: Date } } | undefined

  if (txOrFilter && typeof txOrFilter === "object" && "saleLineItem" in txOrFilter) {
    // First arg is a TxClient
    db = txOrFilter as TxClient
    filter = filterArg
  } else if (txOrFilter && typeof txOrFilter === "object") {
    // First arg is a filter object
    filter = txOrFilter as { dailyEntryId?: string; beforeDate?: Date; dateRange?: { gte: Date; lte: Date } }
  }

  const where: Record<string, unknown> = { category: "WHOLESALE_RELOAD" }
  if (filter?.dailyEntryId) {
    where.dailyEntryId = filter.dailyEntryId
  }
  if (filter?.beforeDate) {
    where.dailyEntry = { date: { lt: filter.beforeDate } }
  }
  if (filter?.dateRange) {
    where.dailyEntry = { date: { gte: filter.dateRange.gte, lte: filter.dateRange.lte } }
  }

  const agg = await db.saleLineItem.aggregate({
    where: where as Parameters<typeof prisma.saleLineItem.aggregate>[0]["where"],
    _sum: { amount: true },
  })
  return Number(agg._sum.amount ?? 0)
}
