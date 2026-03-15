import { prisma } from "@/lib/db"
import { stripRetailGst } from "@/lib/utils/balance"
import { getWholesaleReloadTotal } from "@/lib/utils/wholesale-reload"

export interface WalletCalculation {
  opening: {
    balance: number
    source: "previous_day" | "initial_setup" | "manual"
    previousDate?: Date
  }
  topups: {
    fromCash: number
    fromBank: number
    total: number
  }
  reloadSalesUsed: {
    retailReload: { consumer: number; corporate: number; total: number }
    wholesaleReload: { consumer: number; corporate: number; total: number }
    total: number
  }
  closingExpected: number
  closingActual: number
  variance: number
}

export async function calculateWallet(
  entryId: string,
  entryDate: Date
): Promise<WalletCalculation> {
  const entry = await prisma.dailyEntry.findUnique({
    where: { id: entryId },
    include: {
      wallet: true,
      categories: {
        where: {
          category: { in: ["RETAIL_RELOAD", "WHOLESALE_RELOAD"] },
        },
      },
    },
  })

  if (!entry) {
    throw new Error("Entry not found")
  }

  // Determine opening balance and source
  const opening = {
    balance: 0,
    source: "manual" as "previous_day" | "initial_setup" | "manual",
    previousDate: undefined as Date | undefined,
  }

  if (entry.wallet) {
    opening.balance = Number(entry.wallet.opening)
    opening.source = entry.wallet.openingSource.toLowerCase() as typeof opening.source
  } else {
    // Try to get from previous day
    const previousDate = new Date(entryDate)
    previousDate.setDate(previousDate.getDate() - 1)

    const previousEntry = await prisma.dailyEntry.findUnique({
      where: { date: previousDate },
      include: { wallet: true },
    })

    if (previousEntry?.wallet) {
      opening.balance = Number(previousEntry.wallet.closingActual)
      opening.source = "previous_day"
      opening.previousDate = previousDate
    } else {
      // Try wallet settings
      const settings = await prisma.walletSettings.findFirst({
        orderBy: { openingDate: "desc" },
      })

      if (settings) {
        opening.balance = Number(settings.openingBalance)
        opening.source = "initial_setup"
      }
    }
  }

  // Get top-ups for this date
  const topupsData = await prisma.walletTopup.findMany({
    where: { date: entryDate },
  })

  const topups = {
    fromCash: topupsData
      .filter((t) => t.source === "CASH")
      .reduce((sum, t) => sum + Number(t.amount), 0),
    fromBank: topupsData
      .filter((t) => t.source === "BANK")
      .reduce((sum, t) => sum + Number(t.amount), 0),
    total: topupsData.reduce((sum, t) => sum + Number(t.amount), 0),
  }

  // Calculate reload sales used
  const reloadSalesUsed = {
    retailReload: { consumer: 0, corporate: 0, total: 0 },
    wholesaleReload: { consumer: 0, corporate: 0, total: 0 },
    total: 0,
  }

  for (const cat of entry.categories) {
    const consumerTotal =
      Number(cat.consumerCash) + Number(cat.consumerTransfer) + Number(cat.consumerCredit)
    const corporateTotal =
      Number(cat.corporateCash) + Number(cat.corporateTransfer) + Number(cat.corporateCredit)
    const categoryTotal = consumerTotal + corporateTotal

    if (cat.category === "RETAIL_RELOAD") {
      reloadSalesUsed.retailReload = {
        consumer: consumerTotal,
        corporate: corporateTotal,
        total: categoryTotal,
      }
      // Retail reload includes 8% GST — wallet cost is the pre-GST amount
      reloadSalesUsed.total += stripRetailGst(categoryTotal)
    } else if (cat.category === "WHOLESALE_RELOAD") {
      // Category grid stores cash received; wallet cost comes from line items (reload amount)
      reloadSalesUsed.wholesaleReload = {
        consumer: consumerTotal,
        corporate: corporateTotal,
        total: categoryTotal,
      }
    }
  }

  // Wholesale wallet cost: sum of reload amounts from line items (not category grid)
  const wholesaleWalletCost = await getWholesaleReloadTotal({ dailyEntryId: entryId })
  reloadSalesUsed.total += wholesaleWalletCost

  const closingActual = entry.wallet ? Number(entry.wallet.closingActual) : 0
  const closingExpected = opening.balance + topups.total - reloadSalesUsed.total
  const variance = closingActual - closingExpected

  return {
    opening,
    topups,
    reloadSalesUsed,
    closingExpected,
    closingActual,
    variance,
  }
}

export async function getPreviousDayClosing(date: Date): Promise<number | null> {
  const previousDate = new Date(date)
  previousDate.setDate(previousDate.getDate() - 1)

  const entry = await prisma.dailyEntry.findUnique({
    where: { date: previousDate },
    include: { wallet: true },
  })

  if (entry?.wallet) {
    return Number(entry.wallet.closingActual)
  }

  return null
}
