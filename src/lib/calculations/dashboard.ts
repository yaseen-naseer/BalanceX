import { prisma } from '@/lib/db'
import type { DashboardAlert } from '@/types'
import { calculateReloadWalletCost } from '@/lib/utils/balance'
import { getWholesaleReloadTotal } from '@/lib/utils/wholesale-reload'
import { CASH_VARIANCE_THRESHOLD, WALLET_VARIANCE_THRESHOLD, CURRENCY_CODE } from '@/lib/constants'
import { getBusinessRules } from '@/lib/business-rules'

/**
 * Calculate revenue for a daily entry's categories
 */
export function calculateCategoryRevenue(
  categories: Array<{
    consumerCash: unknown
    consumerTransfer: unknown
    consumerCredit: unknown
    corporateCash: unknown
    corporateTransfer: unknown
    corporateCredit: unknown
  }>
): number {
  return categories.reduce(
    (sum, cat) =>
      sum +
      Number(cat.consumerCash) +
      Number(cat.consumerTransfer) +
      Number(cat.consumerCredit) +
      Number(cat.corporateCash) +
      Number(cat.corporateTransfer) +
      Number(cat.corporateCredit),
    0
  )
}

/**
 * Calculate today's breakdown by customer type and payment method
 */
export interface TodayBreakdown {
  consumer: { cash: number; transfer: number; credit: number; total: number }
  corporate: { cash: number; transfer: number; credit: number; total: number }
  totals: { cash: number; transfer: number; credit: number; grandTotal: number }
}

export function calculateTodayBreakdown(
  categories: Array<{
    consumerCash: unknown
    consumerTransfer: unknown
    consumerCredit: unknown
    corporateCash: unknown
    corporateTransfer: unknown
    corporateCredit: unknown
  }> | undefined
): TodayBreakdown {
  const breakdown: TodayBreakdown = {
    consumer: {
      cash: categories?.reduce((sum, cat) => sum + Number(cat.consumerCash), 0) || 0,
      transfer: categories?.reduce((sum, cat) => sum + Number(cat.consumerTransfer), 0) || 0,
      credit: categories?.reduce((sum, cat) => sum + Number(cat.consumerCredit), 0) || 0,
      total: 0,
    },
    corporate: {
      cash: categories?.reduce((sum, cat) => sum + Number(cat.corporateCash), 0) || 0,
      transfer: categories?.reduce((sum, cat) => sum + Number(cat.corporateTransfer), 0) || 0,
      credit: categories?.reduce((sum, cat) => sum + Number(cat.corporateCredit), 0) || 0,
      total: 0,
    },
    totals: { cash: 0, transfer: 0, credit: 0, grandTotal: 0 },
  }

  // Calculate row totals
  breakdown.consumer.total =
    breakdown.consumer.cash + breakdown.consumer.transfer + breakdown.consumer.credit
  breakdown.corporate.total =
    breakdown.corporate.cash + breakdown.corporate.transfer + breakdown.corporate.credit

  // Calculate column totals
  breakdown.totals.cash = breakdown.consumer.cash + breakdown.corporate.cash
  breakdown.totals.transfer = breakdown.consumer.transfer + breakdown.corporate.transfer
  breakdown.totals.credit = breakdown.consumer.credit + breakdown.corporate.credit
  breakdown.totals.grandTotal = breakdown.consumer.total + breakdown.corporate.total

  return breakdown
}

/**
 * Calculate cash in hand from entry
 */
export function calculateCashInHand(
  entry: {
    status: string
    cashDrawer: { opening: unknown; bankDeposits: unknown; closingActual: unknown } | null
  } | null,
  totalCash: number
): number | null {
  if (!entry?.cashDrawer) return null

  if (entry.status === 'SUBMITTED') {
    return Number(entry.cashDrawer.closingActual)
  }

  const opening = Number(entry.cashDrawer.opening)
  const bankDeposits = Number(entry.cashDrawer.bankDeposits)
  return opening + totalCash - bankDeposits
}

/**
 * Calculate credit outstanding from transactions
 */
export function calculateCreditOutstanding(
  transactions: Array<{ type: string; amount: unknown }>
): number {
  return transactions.reduce((sum, tx) => {
    if (tx.type === 'CREDIT_SALE') {
      return sum + Number(tx.amount)
    } else {
      return sum - Number(tx.amount)
    }
  }, 0)
}

/**
 * Calculate bank balance
 */
export function calculateBankBalance(
  settings: { openingBalance: unknown } | null,
  transactions: Array<{ type: string; amount: unknown }>
): number {
  const opening = settings ? Number(settings.openingBalance) : 0
  return (
    opening +
    transactions.reduce((sum, tx) => {
      if (tx.type === 'DEPOSIT') {
        return sum + Number(tx.amount)
      } else {
        return sum - Number(tx.amount)
      }
    }, 0)
  )
}

/**
 * Calculate wallet balance
 */
export async function calculateWalletBalance(
  settings: { openingBalance: unknown } | null,
  topups: Array<{ amount: unknown }>,
  reloadCategories: Array<{
    category: string
    consumerCash: unknown
    consumerTransfer: unknown
    consumerCredit: unknown
    corporateCash: unknown
    corporateTransfer: unknown
    corporateCredit: unknown
  }>
): Promise<number> {
  const opening = settings ? Number(settings.openingBalance) : 0
  const totalTopups = topups.reduce((sum, t) => sum + Number(t.amount), 0)
  const wholesaleReload = await getWholesaleReloadTotal()
  const totalReloadSales = calculateReloadWalletCost(reloadCategories, wholesaleReload)
  return opening + totalTopups - totalReloadSales
}

/**
 * Calculate percentage change between two values
 */
export function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) return 0
  return ((current - previous) / previous) * 100
}

/**
 * Generate dashboard alerts
 */
export async function generateAlerts(
  today: Date,
  isSalesUser: boolean = false
): Promise<DashboardAlert[]> {
  const alerts: DashboardAlert[] = []

  const daysToCheck = isSalesUser ? 1 : 7
  const datesToCheck: Date[] = []

  // Don't alert for dates before the setup opening date
  const bankSettings = await prisma.bankSettings.findFirst({ where: { id: 'default' }, select: { openingDate: true } })
  const setupDate = bankSettings?.openingDate ?? null

  for (let i = 0; i < daysToCheck; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    if (setupDate && date < setupDate) break
    datesToCheck.push(date)
  }

  const unsubmittedDays: string[] = []
  const missingScreenshotDays: string[] = []
  const unverifiedDays: string[] = []

  // Skip unsubmitted/screenshot checks on fresh setup with no entries yet
  const anyEntryExists = await prisma.dailyEntry.findFirst({ select: { id: true } })

  if (anyEntryExists && datesToCheck.length > 0) {
    // B2: Batch query — fetch all entries for datesToCheck in a single findMany
    const entries = await prisma.dailyEntry.findMany({
      where: { date: { in: datesToCheck } },
      include: { screenshot: true },
    })

    const entryByDate = new Map(
      entries.map((e) => [e.date.toISOString().split('T')[0], e])
    )

    for (const date of datesToCheck) {
      const dateStr = date.toISOString().split('T')[0]
      const entry = entryByDate.get(dateStr)

      if (!entry || entry.status !== 'SUBMITTED') {
        unsubmittedDays.push(dateStr)
      } else {
        if (!isSalesUser) {
          if (!entry.screenshot) {
            missingScreenshotDays.push(dateStr)
          } else if (!entry.screenshot.isVerified) {
            unverifiedDays.push(dateStr)
          }
        }
      }
    }
  }

  if (unsubmittedDays.length > 0) {
    alerts.push({
      id: 'not_submitted',
      type: 'not_submitted',
      priority: 'high',
      message: `${unsubmittedDays.length} day(s) not submitted`,
      count: unsubmittedDays.length,
      dates: unsubmittedDays,
      link: '/daily-entry',
    })
  }

  if (missingScreenshotDays.length > 0) {
    alerts.push({
      id: 'missing_screenshot',
      type: 'missing_screenshot',
      priority: 'high',
      message: `${missingScreenshotDays.length} day(s) missing screenshot`,
      count: missingScreenshotDays.length,
      dates: missingScreenshotDays,
      link: '/day-detail',
    })
  }

  if (unverifiedDays.length > 0) {
    alerts.push({
      id: 'not_verified',
      type: 'not_verified',
      priority: 'medium',
      message: `${unverifiedDays.length} day(s) not verified`,
      count: unverifiedDays.length,
      dates: unverifiedDays,
      link: '/day-detail',
    })
  }

  // Check for variance issues
  const oldestDate = datesToCheck[datesToCheck.length - 1] || today
  const varianceEntries = await prisma.dailyEntry.findMany({
    where: {
      date: { gte: oldestDate, lte: today },
      status: 'SUBMITTED',
    },
    include: { cashDrawer: true, wallet: true },
  })

  for (const entry of varianceEntries) {
    const dateStr = entry.date.toISOString().split('T')[0]

    if (entry.cashDrawer && Math.abs(Number(entry.cashDrawer.variance)) > CASH_VARIANCE_THRESHOLD) {
      alerts.push({
        id: `cash_variance_${dateStr}`,
        type: 'cash_variance',
        priority: 'high',
        message: `Cash variance > ${CURRENCY_CODE} ${CASH_VARIANCE_THRESHOLD} on ${dateStr}`,
        link: `/daily-entry?date=${dateStr}`,
      })
    }

    if (entry.wallet && Math.abs(Number(entry.wallet.variance)) > WALLET_VARIANCE_THRESHOLD) {
      alerts.push({
        id: `wallet_variance_${dateStr}`,
        type: 'wallet_variance',
        priority: 'high',
        message: `Wallet variance > ${CURRENCY_CODE} ${WALLET_VARIANCE_THRESHOLD} on ${dateStr}`,
        link: `/daily-entry?date=${dateStr}`,
      })
    }
  }

  // Check for overdue credit customers (threshold from owner-tunable BusinessRulesSettings).
  if (!isSalesUser) {
    const rules = await getBusinessRules()
    const overdueThreshold = new Date(today)
    overdueThreshold.setDate(overdueThreshold.getDate() - rules.overdueCreditDays)

    // D1: Include transactions in initial query to eliminate N+1
    const customers = await prisma.creditCustomer.findMany({
      where: { isActive: true },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    let overdueCount = 0
    for (const customer of customers) {
      const outstanding = calculateCreditOutstanding(customer.transactions)

      if (outstanding > 0) {
        const lastActivity = customer.transactions[0]?.date
        if (lastActivity && lastActivity < overdueThreshold) {
          overdueCount++
        }
      }
    }

    if (overdueCount > 0) {
      alerts.push({
        id: 'overdue_credit',
        type: 'overdue_credit',
        priority: 'medium',
        message: `${overdueCount} credit customer(s) overdue (>${rules.overdueCreditDays} days)`,
        count: overdueCount,
        link: '/credit',
      })
    }
  }

  return alerts
}

/**
 * Activity item type
 */
export interface ActivityItem {
  id: string
  type: string
  description: string
  amount: number
  date: Date
  user: string
}

/**
 * Get recent activity for dashboard
 */
export async function getRecentActivity(isSalesUser: boolean = false): Promise<ActivityItem[]> {
  const activities: ActivityItem[] = []

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const dateFilter = isSalesUser ? { updatedAt: { gte: today, lt: tomorrow } } : {}

  // Recent daily entries
  const recentEntries = await prisma.dailyEntry.findMany({
    take: isSalesUser ? 3 : 5,
    orderBy: { updatedAt: 'desc' },
    where: dateFilter,
    include: {
      user: { select: { name: true } },
      categories: true,
    },
  })

  for (const entry of recentEntries) {
    const revenue = calculateCategoryRevenue(entry.categories)

    activities.push({
      id: entry.id,
      type: 'daily_entry',
      description: `Daily entry ${entry.status === 'SUBMITTED' ? 'submitted' : 'updated'}`,
      amount: revenue,
      date: entry.updatedAt,
      user: entry.user.name,
    })
  }

  // Recent credit transactions
  const creditDateFilter = isSalesUser
    ? { createdAt: { gte: today, lt: tomorrow }, type: 'CREDIT_SALE' as const }
    : {}

  const recentCreditTx = await prisma.creditTransaction.findMany({
    take: isSalesUser ? 3 : 5,
    orderBy: { createdAt: 'desc' },
    where: creditDateFilter,
    include: {
      user: { select: { name: true } },
      customer: { select: { name: true } },
    },
  })

  for (const tx of recentCreditTx) {
    activities.push({
      id: tx.id,
      type: tx.type === 'CREDIT_SALE' ? 'credit_sale' : 'settlement',
      description: `${tx.type === 'CREDIT_SALE' ? 'Credit sale to' : 'Settlement from'} ${tx.customer.name}`,
      amount: tx.amount.toNumber(),
      date: tx.createdAt,
      user: tx.user.name,
    })
  }

  const limit = isSalesUser ? 5 : 10
  return activities.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, limit)
}
