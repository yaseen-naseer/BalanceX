import { prisma } from "@/lib/db"
import type { CategoryType, CustomerType, PaymentMethod } from "@prisma/client"
import type { TxClient } from "@/lib/utils/atomic"

/**
 * Maps (customerType, paymentMethod) to the DailyEntryCategory field name.
 * e.g. (CONSUMER, CASH) => "consumerCash"
 */
export function getCategoryFieldName(customerType: CustomerType, paymentMethod: PaymentMethod): string {
  const ct = customerType === "CONSUMER" ? "consumer" : "corporate"
  const pm = paymentMethod.charAt(0) + paymentMethod.slice(1).toLowerCase()
  return `${ct}${pm}`
}

/**
 * Recalculates the cell total from line items and updates the DailyEntryCategory.
 * Returns the new cell total.
 * Accepts an optional transaction client for atomicity.
 */
export async function syncCellTotal(
  dailyEntryId: string,
  category: CategoryType,
  customerType: CustomerType,
  paymentMethod: PaymentMethod,
  tx?: TxClient
): Promise<number> {
  const db = tx ?? prisma
  // For wholesale reload: grid shows cash received (cashAmount), not reload amount
  // For all others: grid shows the sale amount
  let total: number
  if (category === "WHOLESALE_RELOAD") {
    // Sum cashAmount where available, fall back to amount
    const items = await db.saleLineItem.findMany({
      where: { dailyEntryId, category, customerType, paymentMethod },
      select: { amount: true, cashAmount: true },
    })
    total = items.reduce((sum, item) => sum + Number(item.cashAmount ?? item.amount), 0)
  } else {
    const agg = await db.saleLineItem.aggregate({
      where: { dailyEntryId, category, customerType, paymentMethod },
      _sum: { amount: true },
    })
    total = Number(agg._sum.amount ?? 0)
  }

  const fieldName = getCategoryFieldName(customerType, paymentMethod)

  // Upsert the category record
  await db.dailyEntryCategory.upsert({
    where: { dailyEntryId_category: { dailyEntryId, category } },
    update: { [fieldName]: total },
    create: {
      dailyEntryId,
      category,
      [fieldName]: total,
    },
  })

  return total
}
