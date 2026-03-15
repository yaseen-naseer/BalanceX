import { prisma } from '@/lib/db'
import type { CategoryType } from '@prisma/client'
import { stripRetailGst } from '@/lib/utils/balance'

/**
 * Calculate total cash sales from categories
 */
export function calculateTotalCashSales(
  categories: Array<{ consumerCash: unknown; corporateCash: unknown }>
): number {
  return categories.reduce(
    (sum, cat) => sum + Number(cat.consumerCash) + Number(cat.corporateCash),
    0
  )
}

/**
 * Calculate total reload wallet cost from categories.
 * Retail reload: strips 8% GST (customer pays 108, wallet cost = 100).
 * Wholesale reload: full amount deducted from wallet.
 */
export function calculateReloadSales(
  categories: Array<{
    category: string
    consumerCash: unknown
    consumerTransfer: unknown
    consumerCredit: unknown
    corporateCash: unknown
    corporateTransfer: unknown
    corporateCredit: unknown
  }>,
  wholesaleReloadFromLineItems?: number
): number {
  let total = 0
  for (const cat of categories) {
    if (cat.category === 'RETAIL_RELOAD') {
      const catTotal =
        Number(cat.consumerCash) +
        Number(cat.consumerTransfer) +
        Number(cat.consumerCredit) +
        Number(cat.corporateCash) +
        Number(cat.corporateTransfer) +
        Number(cat.corporateCredit)
      total += stripRetailGst(catTotal)
    }
    // Wholesale: category grid stores cash received, not wallet cost
    // Wallet cost comes from line items
  }
  if (wholesaleReloadFromLineItems != null) {
    total += wholesaleReloadFromLineItems
  }
  return Math.round(total * 100) / 100
}

/**
 * Get cash settlements for a date
 */
export async function getCashSettlements(date: Date): Promise<number> {
  const result = await prisma.creditTransaction.aggregate({
    _sum: { amount: true },
    where: {
      date,
      type: 'SETTLEMENT',
      paymentMethod: 'CASH',
    },
  })
  return Number(result._sum.amount || 0)
}

/**
 * Get wallet topups from cash for a date
 */
export async function getWalletTopupsFromCash(date: Date): Promise<number> {
  const result = await prisma.walletTopup.aggregate({
    _sum: { amount: true },
    where: {
      date,
      source: 'CASH',
    },
  })
  return Number(result._sum.amount || 0)
}

/**
 * Get total wallet topups for a date
 */
export async function getTotalWalletTopups(date: Date): Promise<number> {
  const result = await prisma.walletTopup.aggregate({
    _sum: { amount: true },
    where: { date },
  })
  return Number(result._sum.amount || 0)
}

/**
 * Calculate cash drawer expected and variance
 */
export interface DailyEntryCashDrawerResult {
  expected: number
  variance: number
}

export function calculateCashDrawerVariance(
  opening: number,
  totalCashSales: number,
  cashSettlements: number,
  bankDeposits: number,
  walletTopupsFromCash: number,
  closingActual: number
): DailyEntryCashDrawerResult {
  const expected = opening + totalCashSales + cashSettlements - bankDeposits - walletTopupsFromCash
  const variance = closingActual - expected
  return { expected, variance }
}

/**
 * Calculate wallet expected and variance
 */
export interface DailyEntryWalletResult {
  expected: number
  variance: number
}

export function calculateWalletVariance(
  opening: number,
  totalTopups: number,
  totalReloadSales: number,
  closingActual: number
): DailyEntryWalletResult {
  const expected = opening + totalTopups - totalReloadSales
  const variance = closingActual - expected
  return { expected, variance }
}

/**
 * Recalculate expected values and variances for an entry
 */
export async function recalculateEntryValues(entryId: string): Promise<void> {
  const entry = await prisma.dailyEntry.findUnique({
    where: { id: entryId },
    include: { cashDrawer: true, wallet: true, categories: true },
  })

  if (!entry) return

  const entryDate = entry.date

  // Get external data
  const [cashSettlements, walletTopupsFromCash, totalWalletTopups] = await Promise.all([
    getCashSettlements(entryDate),
    getWalletTopupsFromCash(entryDate),
    getTotalWalletTopups(entryDate),
  ])

  // Calculate totals
  const totalCashSales = calculateTotalCashSales(entry.categories)
  // Wholesale wallet cost from line items (category grid stores cash received)
  const wholesaleLineItemAgg = await prisma.saleLineItem.aggregate({
    where: { dailyEntryId: entryId, category: 'WHOLESALE_RELOAD' },
    _sum: { amount: true },
  })
  const wholesaleReload = Number(wholesaleLineItemAgg._sum.amount ?? 0)
  const totalReloadSales = calculateReloadSales(entry.categories, wholesaleReload)

  // Update cash drawer
  if (entry.cashDrawer) {
    const { expected, variance } = calculateCashDrawerVariance(
      Number(entry.cashDrawer.opening),
      totalCashSales,
      cashSettlements,
      Number(entry.cashDrawer.bankDeposits),
      walletTopupsFromCash,
      Number(entry.cashDrawer.closingActual)
    )

    await prisma.dailyEntryCashDrawer.update({
      where: { dailyEntryId: entryId },
      data: {
        closingExpected: expected,
        variance: variance,
      },
    })
  }

  // Update wallet
  if (entry.wallet) {
    let walletOpening = Number(entry.wallet.opening)

    // When openingSource is PREVIOUS_DAY, always derive opening from the previous day's
    // actual closing balance so the stored value stays accurate even if it was initially
    // saved as 0 due to a race condition on first save.
    if (entry.wallet.openingSource === 'PREVIOUS_DAY') {
      const prevDate = new Date(entryDate)
      prevDate.setDate(prevDate.getDate() - 1)
      const prevEntry = await prisma.dailyEntry.findUnique({
        where: { date: prevDate },
        include: { wallet: true },
      })
      if (prevEntry?.wallet) {
        walletOpening = Number(prevEntry.wallet.closingActual)
      }
    }

    const walletClosingActual = Number(entry.wallet.closingActual)
    const { expected: walletExpected, variance: walletVariance } = calculateWalletVariance(
      walletOpening,
      totalWalletTopups,
      totalReloadSales,
      walletClosingActual
    )

    await prisma.dailyEntryWallet.update({
      where: { dailyEntryId: entryId },
      data: {
        opening: walletOpening,
        closingExpected: walletExpected,
        variance: walletVariance,
      },
    })
  }
}

/**
 * Update or create cash drawer
 */
export async function upsertCashDrawer(
  entryId: string,
  existing: { opening: unknown; bankDeposits: unknown; closingActual: unknown } | null,
  data: { opening?: number; bankDeposits?: number; closingActual?: number }
): Promise<void> {
  if (existing) {
    await prisma.dailyEntryCashDrawer.update({
      where: { dailyEntryId: entryId },
      data: {
        opening: data.opening ?? Number(existing.opening),
        bankDeposits: data.bankDeposits ?? Number(existing.bankDeposits),
        closingActual: data.closingActual ?? Number(existing.closingActual),
      },
    })
  } else {
    await prisma.dailyEntryCashDrawer.create({
      data: {
        dailyEntryId: entryId,
        opening: data.opening || 0,
        bankDeposits: data.bankDeposits || 0,
        closingActual: data.closingActual || 0,
      },
    })
  }
}

/**
 * Update or create wallet
 */
export async function upsertWallet(
  entryId: string,
  existing: { opening: unknown; openingSource: string; closingActual: unknown } | null,
  data: { opening?: number; openingSource?: string; closingActual?: number }
): Promise<void> {
  if (existing) {
    await prisma.dailyEntryWallet.update({
      where: { dailyEntryId: entryId },
      data: {
        opening: data.opening ?? Number(existing.opening),
        openingSource: (data.openingSource ?? existing.openingSource) as 'PREVIOUS_DAY' | 'INITIAL_SETUP',
        closingActual: data.closingActual ?? Number(existing.closingActual),
      },
    })
  } else {
    await prisma.dailyEntryWallet.create({
      data: {
        dailyEntryId: entryId,
        opening: data.opening || 0,
        openingSource: (data.openingSource || 'PREVIOUS_DAY') as 'PREVIOUS_DAY' | 'INITIAL_SETUP',
        closingActual: data.closingActual || 0,
      },
    })
  }
}

/**
 * Update or create category
 */
export async function upsertCategory(
  entryId: string,
  existingCategories: Array<{ id: string; category: string }>,
  category: {
    category: string
    consumerCash?: number
    consumerTransfer?: number
    consumerCredit?: number
    corporateCash?: number
    corporateTransfer?: number
    corporateCredit?: number
    quantity?: number
  }
): Promise<void> {
  const existing = existingCategories.find((c) => c.category === category.category)

  if (existing) {
    await prisma.dailyEntryCategory.update({
      where: { id: existing.id },
      data: {
        consumerCash: category.consumerCash,
        consumerTransfer: category.consumerTransfer,
        consumerCredit: category.consumerCredit,
        corporateCash: category.corporateCash,
        corporateTransfer: category.corporateTransfer,
        corporateCredit: category.corporateCredit,
        quantity: category.quantity,
      },
    })
  } else {
    await prisma.dailyEntryCategory.create({
      data: {
        dailyEntryId: entryId,
        category: category.category as CategoryType,
        consumerCash: category.consumerCash || 0,
        consumerTransfer: category.consumerTransfer || 0,
        consumerCredit: category.consumerCredit || 0,
        corporateCash: category.corporateCash || 0,
        corporateTransfer: category.corporateTransfer || 0,
        corporateCredit: category.corporateCredit || 0,
        quantity: category.quantity || 0,
      },
    })
  }
}

/**
 * Update or create notes
 */
export async function upsertNotes(
  entryId: string,
  existingNotes: { content: string | null } | null,
  content: string | undefined
): Promise<void> {
  if (content === undefined) return

  if (existingNotes) {
    await prisma.dailyEntryNotes.update({
      where: { dailyEntryId: entryId },
      data: { content },
    })
  } else if (content) {
    await prisma.dailyEntryNotes.create({
      data: {
        dailyEntryId: entryId,
        content,
      },
    })
  }
}

/**
 * Full entry include for queries
 */
export const fullEntryInclude = {
  user: { select: { id: true, name: true, username: true } },
  cashDrawer: true,
  wallet: true,
  categories: true,
  notes: true,
  creditSales: {
    include: {
      customer: { select: { id: true, name: true, type: true } },
    },
  },
  screenshot: true,
  amendments: {
    orderBy: { reopenedAt: 'asc' as const },
    include: {
      reopenedByUser: { select: { id: true, name: true } },
      resubmittedByUser: { select: { id: true, name: true } },
    },
  },
}
