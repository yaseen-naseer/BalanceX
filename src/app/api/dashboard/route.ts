import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthenticatedUser } from '@/lib/api-auth'
import { successResponse, ApiErrors } from '@/lib/api-response'
import { logError } from '@/lib/logger'
import {
  calculateCategoryRevenue,
  calculateTodayBreakdown,
  calculateCashInHand,
  calculateCreditOutstanding,
  calculateBankBalance,
  calculateWalletBalance,
  calculatePercentageChange,
  generateAlerts,
  getRecentActivity,
} from '@/lib/calculations/dashboard'

// GET /api/dashboard - Get dashboard summary and alerts
export async function GET(_request: NextRequest) {
  const auth = await getAuthenticatedUser()
  if (auth.error) return auth.error

  const userRole = auth.user!.role
  const isSalesUser = userRole === 'SALES'

  try {
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    // Get month boundaries
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)

    // Fetch all required data in parallel
    const [
      todayEntry,
      monthEntries,
      lastMonthEntries,
      creditTransactions,
      lastMonthCreditTransactions,
      bankSettings,
      bankTransactions,
      walletSettings,
      walletTopups,
      reloadCategories,
    ] = await Promise.all([
      prisma.dailyEntry.findUnique({
        where: { date: today },
        include: { categories: true, cashDrawer: true, wallet: true },
      }),
      prisma.dailyEntry.findMany({
        where: { date: { gte: monthStart, lte: monthEnd } },
        include: { categories: true },
      }),
      prisma.dailyEntry.findMany({
        where: { date: { gte: lastMonthStart, lte: lastMonthEnd } },
        include: { categories: true },
      }),
      prisma.creditTransaction.findMany(),
      prisma.creditTransaction.findMany({
        where: { date: { lte: lastMonthEnd } },
      }),
      prisma.bankSettings.findFirst({ orderBy: { openingDate: 'desc' } }),
      prisma.bankTransaction.findMany(),
      prisma.walletSettings.findFirst({ orderBy: { openingDate: 'desc' } }),
      prisma.walletTopup.findMany(),
      prisma.dailyEntryCategory.findMany({
        where: { category: { in: ['RETAIL_RELOAD', 'WHOLESALE_RELOAD'] } },
      }),
    ])

    // Calculate metrics
    const todayRevenue = todayEntry ? calculateCategoryRevenue(todayEntry.categories) : 0
    const todayBreakdown = calculateTodayBreakdown(todayEntry?.categories)
    const cashInHand = calculateCashInHand(todayEntry, todayBreakdown.totals.cash)

    const monthRevenue = monthEntries.reduce(
      (sum, entry) => sum + calculateCategoryRevenue(entry.categories),
      0
    )
    const lastMonthRevenue = lastMonthEntries.reduce(
      (sum, entry) => sum + calculateCategoryRevenue(entry.categories),
      0
    )
    const monthRevenueChange = calculatePercentageChange(monthRevenue, lastMonthRevenue)

    const creditOutstanding = calculateCreditOutstanding(creditTransactions)
    const lastMonthCreditOutstanding = calculateCreditOutstanding(lastMonthCreditTransactions)
    const creditOutstandingChange = calculatePercentageChange(
      creditOutstanding,
      lastMonthCreditOutstanding
    )

    const bankBalance = calculateBankBalance(bankSettings, bankTransactions)
    const walletBalance = await calculateWalletBalance(walletSettings, walletTopups, reloadCategories)

    // Generate alerts and activity
    const [alerts, recentActivity] = await Promise.all([
      generateAlerts(today, isSalesUser),
      getRecentActivity(isSalesUser),
    ])

    // Return limited data for Sales users
    if (isSalesUser) {
      return successResponse({
        todayRevenue,
        todayBreakdown,
        cashInHand: null,
        monthRevenue: null,
        monthRevenueChange: null,
        creditOutstanding: null,
        creditOutstandingChange: null,
        bankBalance: null,
        walletBalance,
        alerts,
        recentActivity,
        limitedView: true,
      })
    }

    return successResponse({
      todayRevenue,
      todayBreakdown,
      cashInHand,
      monthRevenue,
      monthRevenueChange,
      creditOutstanding,
      creditOutstandingChange,
      bankBalance,
      walletBalance,
      alerts,
      recentActivity,
      limitedView: false,
    })
  } catch (error) {
    logError('Error fetching dashboard data', error)
    return ApiErrors.serverError('Failed to fetch dashboard data')
  }
}
