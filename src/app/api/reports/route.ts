import { NextRequest } from "next/server"
import { prisma } from "@/lib/db"
import { getAuthenticatedUser } from "@/lib/api-auth"
import { startOfMonth, endOfMonth, format, differenceInDays } from "date-fns"
import { logError } from "@/lib/logger"
import { ApiErrors, successResponse } from "@/lib/api-response"
import { monthParamSchema } from "@/lib/validations/schemas"

// GET /api/reports?month=2026-01 - Get monthly report data
export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedUser()
  if (auth.error) return auth.error

  try {
    const { searchParams } = new URL(request.url)
    const monthParamRaw = searchParams.get("month") // Format: 2026-01

    let monthParam: string | null = null
    if (monthParamRaw !== null) {
      const validation = monthParamSchema.safeParse(monthParamRaw)
      if (!validation.success) {
        return ApiErrors.badRequest("Invalid month format. Expected YYYY-MM")
      }
      monthParam = validation.data
    }

    // Parse month parameter or use current month
    const targetDate = monthParam ? new Date(`${monthParam}-01`) : new Date()
    const monthStart = startOfMonth(targetDate)
    const monthEnd = endOfMonth(targetDate)

    // Get all daily entries for the month
    const dailyEntries = await prisma.dailyEntry.findMany({
      where: {
        date: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      include: {
        categories: true,
        cashDrawer: true,
        wallet: true,
        user: { select: { id: true, name: true, username: true } },
      },
      orderBy: { date: "asc" },
    })

    // Calculate daily breakdown
    const dailyBreakdown = dailyEntries.map((entry) => {
      const totalRevenue = entry.categories.reduce((sum, cat) => {
        return (
          sum +
          Number(cat.consumerCash) +
          Number(cat.consumerTransfer) +
          Number(cat.consumerCredit) +
          Number(cat.corporateCash) +
          Number(cat.corporateTransfer) +
          Number(cat.corporateCredit)
        )
      }, 0)

      const cashRevenue = entry.categories.reduce((sum, cat) => {
        return sum + Number(cat.consumerCash) + Number(cat.corporateCash)
      }, 0)

      const transferRevenue = entry.categories.reduce((sum, cat) => {
        return sum + Number(cat.consumerTransfer) + Number(cat.corporateTransfer)
      }, 0)

      const creditRevenue = entry.categories.reduce((sum, cat) => {
        return sum + Number(cat.consumerCredit) + Number(cat.corporateCredit)
      }, 0)

      // Get SIM and USIM quantities for this day
      const simCategory = entry.categories.find((cat) => cat.category === "SIM")
      const usimCategory = entry.categories.find((cat) => cat.category === "USIM")
      const simQuantity = simCategory?.quantity || 0
      const usimQuantity = usimCategory?.quantity || 0

      return {
        date: format(entry.date, "yyyy-MM-dd"),
        dateFormatted: format(entry.date, "dd MMM"),
        dayOfWeek: format(entry.date, "EEE"),
        status: entry.status,
        totalRevenue,
        cashRevenue,
        transferRevenue,
        creditRevenue,
        simQuantity,
        usimQuantity,
        cashVariance: entry.cashDrawer ? Number(entry.cashDrawer.variance) : 0,
        walletVariance: entry.wallet ? Number(entry.wallet.variance) : 0,
        submittedBy: entry.user?.name || entry.user?.username || "Unknown",
      }
    })

    // Calculate totals by payment method
    const paymentMethodTotals = {
      cash: 0,
      transfer: 0,
      credit: 0,
    }

    // Calculate totals by customer type
    const customerTypeTotals = {
      consumer: 0,
      corporate: 0,
    }

    // Calculate totals by category
    const categoryTotals: Record<
      string,
      { total: number; cash: number; transfer: number; credit: number; quantity: number }
    > = {}

    dailyEntries.forEach((entry) => {
      entry.categories.forEach((cat) => {
        const consumerTotal =
          Number(cat.consumerCash) + Number(cat.consumerTransfer) + Number(cat.consumerCredit)
        const corporateTotal =
          Number(cat.corporateCash) + Number(cat.corporateTransfer) + Number(cat.corporateCredit)
        const cashTotal = Number(cat.consumerCash) + Number(cat.corporateCash)
        const transferTotal = Number(cat.consumerTransfer) + Number(cat.corporateTransfer)
        const creditTotal = Number(cat.consumerCredit) + Number(cat.corporateCredit)

        paymentMethodTotals.cash += cashTotal
        paymentMethodTotals.transfer += transferTotal
        paymentMethodTotals.credit += creditTotal

        customerTypeTotals.consumer += consumerTotal
        customerTypeTotals.corporate += corporateTotal

        if (!categoryTotals[cat.category]) {
          categoryTotals[cat.category] = { total: 0, cash: 0, transfer: 0, credit: 0, quantity: 0 }
        }
        categoryTotals[cat.category].total += consumerTotal + corporateTotal
        categoryTotals[cat.category].cash += cashTotal
        categoryTotals[cat.category].transfer += transferTotal
        categoryTotals[cat.category].credit += creditTotal
        categoryTotals[cat.category].quantity += cat.quantity || 0
      })
    })

    // Calculate total revenue
    const totalRevenue =
      paymentMethodTotals.cash + paymentMethodTotals.transfer + paymentMethodTotals.credit

    // Calculate payment method percentages
    const paymentMethodBreakdown = {
      cash: {
        amount: paymentMethodTotals.cash,
        percentage: totalRevenue > 0 ? (paymentMethodTotals.cash / totalRevenue) * 100 : 0,
      },
      transfer: {
        amount: paymentMethodTotals.transfer,
        percentage: totalRevenue > 0 ? (paymentMethodTotals.transfer / totalRevenue) * 100 : 0,
      },
      credit: {
        amount: paymentMethodTotals.credit,
        percentage: totalRevenue > 0 ? (paymentMethodTotals.credit / totalRevenue) * 100 : 0,
      },
    }

    // Calculate customer type percentages
    const customerTypeBreakdown = {
      consumer: {
        amount: customerTypeTotals.consumer,
        percentage: totalRevenue > 0 ? (customerTypeTotals.consumer / totalRevenue) * 100 : 0,
      },
      corporate: {
        amount: customerTypeTotals.corporate,
        percentage: totalRevenue > 0 ? (customerTypeTotals.corporate / totalRevenue) * 100 : 0,
      },
    }

    // Format category breakdown
    const categoryBreakdown = Object.entries(categoryTotals).map(([category, data]) => ({
      category,
      categoryLabel: formatCategoryLabel(category),
      total: data.total,
      cash: data.cash,
      transfer: data.transfer,
      credit: data.credit,
      quantity: data.quantity,
      percentage: totalRevenue > 0 ? (data.total / totalRevenue) * 100 : 0,
    }))

    // Calculate variance trends
    const varianceTrend = dailyBreakdown.map((day) => ({
      date: day.date,
      dateFormatted: day.dateFormatted,
      cashVariance: day.cashVariance,
      walletVariance: day.walletVariance,
    }))

    const totalCashVariance = dailyBreakdown.reduce((sum, day) => sum + day.cashVariance, 0)
    const totalWalletVariance = dailyBreakdown.reduce((sum, day) => sum + day.walletVariance, 0)

    // Get credit aging report
    const creditCustomers = await prisma.creditCustomer.findMany({
      where: { isActive: true },
      include: {
        transactions: {
          orderBy: { date: "desc" },
        },
      },
    })

    const today = new Date()
    const creditAging = {
      current: { count: 0, amount: 0, customers: [] as { name: string; amount: number }[] },
      days30: { count: 0, amount: 0, customers: [] as { name: string; amount: number; days: number }[] },
      days60: { count: 0, amount: 0, customers: [] as { name: string; amount: number; days: number }[] },
      days90Plus: { count: 0, amount: 0, customers: [] as { name: string; amount: number; days: number }[] },
    }

    creditCustomers.forEach((customer) => {
      const balance = customer.transactions.reduce((sum, tx) => {
        if (tx.type === "CREDIT_SALE") {
          return sum + Number(tx.amount)
        } else {
          return sum - Number(tx.amount)
        }
      }, 0)

      if (balance <= 0) return

      // Find oldest unpaid transaction
      const oldestUnpaidDate = customer.transactions
        .filter((tx) => tx.type === "CREDIT_SALE")
        .reduce((oldest, tx) => {
          const txDate = new Date(tx.date)
          return !oldest || txDate < oldest ? txDate : oldest
        }, null as Date | null)

      const daysOutstanding = oldestUnpaidDate
        ? differenceInDays(today, oldestUnpaidDate)
        : 0

      const customerData = { name: customer.name, amount: balance, days: daysOutstanding }

      if (daysOutstanding >= 90) {
        creditAging.days90Plus.count++
        creditAging.days90Plus.amount += balance
        creditAging.days90Plus.customers.push(customerData)
      } else if (daysOutstanding >= 60) {
        creditAging.days60.count++
        creditAging.days60.amount += balance
        creditAging.days60.customers.push(customerData)
      } else if (daysOutstanding >= 30) {
        creditAging.days30.count++
        creditAging.days30.amount += balance
        creditAging.days30.customers.push(customerData)
      } else {
        creditAging.current.count++
        creditAging.current.amount += balance
        creditAging.current.customers.push({ name: customer.name, amount: balance })
      }
    })

    // Summary stats
    const submittedDays = dailyEntries.filter((e) => e.status === "SUBMITTED").length
    const draftDays = dailyEntries.filter((e) => e.status === "DRAFT").length
    const daysInMonth = differenceInDays(monthEnd, monthStart) + 1
    const workingDays = dailyEntries.length

    return successResponse({
      month: format(targetDate, "yyyy-MM"),
      monthLabel: format(targetDate, "MMMM yyyy"),
      summary: {
        totalRevenue,
        dailyAverage: workingDays > 0 ? totalRevenue / workingDays : 0,
        submittedDays,
        draftDays,
        missingDays: daysInMonth - workingDays,
        totalCashVariance,
        totalWalletVariance,
      },
      dailyBreakdown,
      paymentMethodBreakdown,
      customerTypeBreakdown,
      categoryBreakdown,
      varianceTrend,
      creditAging,
    })
  } catch (error) {
    logError("Error fetching report data", error)
    return ApiErrors.serverError("Failed to fetch report data")
  }
}

function formatCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    DHIRAAGU_BILLS: "Dhiraagu Bills",
    RETAIL_RELOAD: "Retail Reload",
    WHOLESALE_RELOAD: "Wholesale Reload",
    SIM: "SIM",
    USIM: "USIM",
  }
  return labels[category] || category
}
