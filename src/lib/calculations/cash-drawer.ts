import { prisma } from "@/lib/db"
import { toNum } from "@/lib/utils/decimal"

export interface CashDrawerCalculation {
  opening: number
  openingFloat: number
  cashSales: {
    dhiraaguBills: { consumer: number; corporate: number }
    retailReload: { consumer: number; corporate: number }
    wholesaleReload: { consumer: number; corporate: number }
    sim: { consumer: number; corporate: number }
    usim: { consumer: number; corporate: number }
    total: number
  }
  cashSettlements: number
  bankDeposits: number
  walletTopupsFromCash: number
  closingExpected: number
  closingActual: number
  closingFloat: number
  variance: number
  floatVariance: number
}

export async function calculateCashDrawer(
  entryId: string,
  entryDate: Date
): Promise<CashDrawerCalculation> {
  const entry = await prisma.dailyEntry.findUnique({
    where: { id: entryId },
    include: {
      cashDrawer: true,
      categories: true,
      cashFloat: true,
    },
  })

  if (!entry) {
    throw new Error("Entry not found")
  }

  // Get cash sales by category
  const cashSales = {
    dhiraaguBills: { consumer: 0, corporate: 0 },
    retailReload: { consumer: 0, corporate: 0 },
    wholesaleReload: { consumer: 0, corporate: 0 },
    sim: { consumer: 0, corporate: 0 },
    usim: { consumer: 0, corporate: 0 },
    total: 0,
  }

  for (const cat of entry.categories) {
    const consumerCash = toNum(cat.consumerCash)
    const corporateCash = toNum(cat.corporateCash)

    switch (cat.category) {
      case "DHIRAAGU_BILLS":
        cashSales.dhiraaguBills = { consumer: consumerCash, corporate: corporateCash }
        break
      case "RETAIL_RELOAD":
        cashSales.retailReload = { consumer: consumerCash, corporate: corporateCash }
        break
      case "WHOLESALE_RELOAD":
        cashSales.wholesaleReload = { consumer: consumerCash, corporate: corporateCash }
        break
      case "SIM":
        cashSales.sim = { consumer: consumerCash, corporate: corporateCash }
        break
      case "USIM":
        cashSales.usim = { consumer: consumerCash, corporate: corporateCash }
        break
    }

    cashSales.total += consumerCash + corporateCash
  }

  // Get cash settlements for this date
  const cashSettlementsAgg = await prisma.creditTransaction.aggregate({
    _sum: { amount: true },
    where: {
      date: entryDate,
      type: "SETTLEMENT",
      paymentMethod: "CASH",
    },
  })
  const cashSettlements = toNum(cashSettlementsAgg._sum.amount)

  // Get wallet top-ups from cash for this date
  const walletTopupsAgg = await prisma.walletTopup.aggregate({
    _sum: { amount: true },
    where: {
      date: entryDate,
      source: "CASH",
    },
  })
  const walletTopupsFromCash = toNum(walletTopupsAgg._sum.amount)

  const opening = entry.cashDrawer ? toNum(entry.cashDrawer.opening) : 0
  const bankDeposits = entry.cashDrawer ? toNum(entry.cashDrawer.bankDeposits) : 0
  const closingActual = entry.cashDrawer ? toNum(entry.cashDrawer.closingActual) : 0

  // Get cash float data
  const openingFloat = entry.cashFloat ? toNum(entry.cashFloat.openingTotal) : 0
  const closingFloat = entry.cashFloat ? toNum(entry.cashFloat.closingTotal) : 0
  const floatVariance = entry.cashFloat ? toNum(entry.cashFloat.variance) : 0

  // Calculate expected closing (excluding float)
  // The float stays constant in the drawer, so we calculate cash separately
  const closingExpected =
    opening + cashSales.total + cashSettlements - bankDeposits - walletTopupsFromCash

  // Total variance includes cash variance only (float is tracked separately)
  const variance = closingActual - closingExpected

  return {
    opening,
    openingFloat,
    cashSales,
    cashSettlements,
    bankDeposits,
    walletTopupsFromCash,
    closingExpected,
    closingActual,
    closingFloat,
    variance,
    floatVariance,
  }
}

export function getVarianceStatus(variance: number): "ok" | "warning" | "block" {
  const absVariance = Math.abs(variance)
  if (absVariance === 0) return "ok"
  if (absVariance <= 500) return "warning"
  return "block"
}
