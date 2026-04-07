import { prisma } from '@/lib/db'
import type { CategoryType } from '@prisma/client'
import DecimalLight from 'decimal.js-light'
import { stripRetailGst } from '@/lib/utils/balance'
import { toNum } from '@/lib/utils/decimal'
import { withTransaction } from '@/lib/utils/atomic'
import type { TxClient } from '@/lib/utils/atomic'

/**
 * Calculate total cash sales from categories
 */
export function calculateTotalCashSales(
  categories: Array<{ consumerCash: unknown; corporateCash: unknown }>
): number {
  return categories.reduce(
    (sum, cat) => sum + toNum(cat.consumerCash) + toNum(cat.corporateCash),
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
        toNum(cat.consumerCash) +
        toNum(cat.consumerTransfer) +
        toNum(cat.consumerCredit) +
        toNum(cat.corporateCash) +
        toNum(cat.corporateTransfer) +
        toNum(cat.corporateCredit)
      total += stripRetailGst(catTotal)
    }
    // Wholesale: category grid stores cash received, not wallet cost
    // Wallet cost comes from line items
  }
  if (wholesaleReloadFromLineItems != null) {
    total += wholesaleReloadFromLineItems
  }
  return new DecimalLight(total).toDecimalPlaces(2).toNumber()
}

/**
 * Get cash settlements for a date
 */
export async function getCashSettlements(date: Date, db: TxClient | typeof prisma = prisma): Promise<number> {
  const result = await db.creditTransaction.aggregate({
    _sum: { amount: true },
    where: {
      date,
      type: 'SETTLEMENT',
      paymentMethod: 'CASH',
    },
  })
  return toNum(result._sum.amount)
}

/**
 * Get wallet topups from cash for a date
 */
export async function getWalletTopupsFromCash(date: Date, db: TxClient | typeof prisma = prisma): Promise<number> {
  const result = await db.walletTopup.aggregate({
    _sum: { amount: true },
    where: {
      date,
      source: 'CASH',
    },
  })
  return toNum(result._sum.amount)
}

/**
 * Get total wallet topups for a date
 */
export async function getTotalWalletTopups(date: Date, db: TxClient | typeof prisma = prisma): Promise<number> {
  const result = await db.walletTopup.aggregate({
    _sum: { amount: true },
    where: { date },
  })
  return toNum(result._sum.amount)
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
  // C1: Wrap entire recalculation in Serializable transaction to prevent
  // race conditions when deriving wallet opening from previous day's closing.
  await withTransaction(async (tx) => {
    const entry = await tx.dailyEntry.findUnique({
      where: { id: entryId },
      include: { cashDrawer: true, wallet: true, categories: true },
    })

    if (!entry) return

    const entryDate = entry.date

    // Get external data (pass tx for transactional reads)
    const [cashSettlements, walletTopupsFromCash, totalWalletTopups] = await Promise.all([
      getCashSettlements(entryDate, tx),
      getWalletTopupsFromCash(entryDate, tx),
      getTotalWalletTopups(entryDate, tx),
    ])

    // Calculate totals
    const totalCashSales = calculateTotalCashSales(entry.categories)
    // Wholesale wallet cost from line items (category grid stores cash received)
    const wholesaleLineItemAgg = await tx.saleLineItem.aggregate({
      where: { dailyEntryId: entryId, category: 'WHOLESALE_RELOAD' },
      _sum: { amount: true },
    })
    const wholesaleReload = toNum(wholesaleLineItemAgg._sum.amount)
    const totalReloadSales = calculateReloadSales(entry.categories, wholesaleReload)

    // Update cash drawer
    if (entry.cashDrawer) {
      const { expected, variance } = calculateCashDrawerVariance(
        toNum(entry.cashDrawer.opening),
        totalCashSales,
        cashSettlements,
        toNum(entry.cashDrawer.bankDeposits),
        walletTopupsFromCash,
        toNum(entry.cashDrawer.closingActual)
      )

      await tx.dailyEntryCashDrawer.update({
        where: { dailyEntryId: entryId },
        data: {
          closingExpected: expected,
          variance: variance,
        },
      })
    }

    // Update wallet
    if (entry.wallet) {
      let walletOpening = toNum(entry.wallet.opening)

      // When openingSource is PREVIOUS_DAY, always derive opening from the previous day's
      // actual closing balance so the stored value stays accurate even if it was initially
      // saved as 0 due to a race condition on first save.
      if (entry.wallet.openingSource === 'PREVIOUS_DAY') {
        const prevDate = new Date(entryDate)
        prevDate.setDate(prevDate.getDate() - 1)
        const prevEntry = await tx.dailyEntry.findUnique({
          where: { date: prevDate },
          include: { wallet: true },
        })
        if (prevEntry?.wallet) {
          walletOpening = toNum(prevEntry.wallet.closingActual)
        }
      }

      const walletClosingActual = toNum(entry.wallet.closingActual)
      const { expected: walletExpected, variance: walletVariance } = calculateWalletVariance(
        walletOpening,
        totalWalletTopups,
        totalReloadSales,
        walletClosingActual
      )

      await tx.dailyEntryWallet.update({
        where: { dailyEntryId: entryId },
        data: {
          opening: walletOpening,
          closingExpected: walletExpected,
          variance: walletVariance,
        },
      })
    }
  })
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
        opening: data.opening ?? toNum(existing.opening),
        bankDeposits: data.bankDeposits ?? toNum(existing.bankDeposits),
        closingActual: data.closingActual ?? toNum(existing.closingActual),
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
        opening: data.opening ?? toNum(existing.opening),
        openingSource: (data.openingSource ?? existing.openingSource) as 'PREVIOUS_DAY' | 'INITIAL_SETUP',
        closingActual: data.closingActual ?? toNum(existing.closingActual),
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
