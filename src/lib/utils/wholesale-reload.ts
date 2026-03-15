import { prisma } from "@/lib/db"

/**
 * Get the total wholesale reload amount (wallet cost) from line items.
 * This is the actual reload amount deducted from the wallet, NOT the cash received.
 *
 * Server-only — must not be imported from client components.
 */
export async function getWholesaleReloadTotal(filter?: {
  dailyEntryId?: string
  beforeDate?: Date
  dateRange?: { gte: Date; lte: Date }
}): Promise<number> {
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

  const agg = await prisma.saleLineItem.aggregate({
    where: where as Parameters<typeof prisma.saleLineItem.aggregate>[0]["where"],
    _sum: { amount: true },
  })
  return Number(agg._sum.amount ?? 0)
}
