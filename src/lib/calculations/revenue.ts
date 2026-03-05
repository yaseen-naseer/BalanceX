import { prisma } from "@/lib/db"
import type { DailyEntryCategory } from "@prisma/client"

export interface DailyRevenue {
  total: number
  byCategory: {
    dhiraaguBills: number
    retailReload: number
    wholesaleReload: number
    sim: number
    usim: number
  }
  byPaymentMethod: {
    cash: number
    transfer: number
    credit: number
  }
  byCustomerType: {
    consumer: number
    corporate: number
  }
  simQuantity: number
  usimQuantity: number
}

export interface MonthlyRevenue {
  total: number
  averageDaily: number
  daysWithEntries: number
  byCategory: {
    category: string
    total: number
    percentage: number
  }[]
  byPaymentMethod: {
    method: string
    total: number
    percentage: number
  }[]
  byCustomerType: {
    type: string
    total: number
    percentage: number
  }[]
  totalSim: number
  totalUsim: number
}

export function calculateDailyRevenue(categories: DailyEntryCategory[]): DailyRevenue {
  const result: DailyRevenue = {
    total: 0,
    byCategory: {
      dhiraaguBills: 0,
      retailReload: 0,
      wholesaleReload: 0,
      sim: 0,
      usim: 0,
    },
    byPaymentMethod: {
      cash: 0,
      transfer: 0,
      credit: 0,
    },
    byCustomerType: {
      consumer: 0,
      corporate: 0,
    },
    simQuantity: 0,
    usimQuantity: 0,
  }

  for (const cat of categories) {
    const consumerCash = Number(cat.consumerCash)
    const consumerTransfer = Number(cat.consumerTransfer)
    const consumerCredit = Number(cat.consumerCredit)
    const corporateCash = Number(cat.corporateCash)
    const corporateTransfer = Number(cat.corporateTransfer)
    const corporateCredit = Number(cat.corporateCredit)

    const categoryTotal =
      consumerCash +
      consumerTransfer +
      consumerCredit +
      corporateCash +
      corporateTransfer +
      corporateCredit

    // By category
    switch (cat.category) {
      case "DHIRAAGU_BILLS":
        result.byCategory.dhiraaguBills = categoryTotal
        break
      case "RETAIL_RELOAD":
        result.byCategory.retailReload = categoryTotal
        break
      case "WHOLESALE_RELOAD":
        result.byCategory.wholesaleReload = categoryTotal
        break
      case "SIM":
        result.byCategory.sim = categoryTotal
        result.simQuantity = cat.quantity
        break
      case "USIM":
        result.byCategory.usim = categoryTotal
        result.usimQuantity = cat.quantity
        break
    }

    // By payment method
    result.byPaymentMethod.cash += consumerCash + corporateCash
    result.byPaymentMethod.transfer += consumerTransfer + corporateTransfer
    result.byPaymentMethod.credit += consumerCredit + corporateCredit

    // By customer type
    result.byCustomerType.consumer += consumerCash + consumerTransfer + consumerCredit
    result.byCustomerType.corporate += corporateCash + corporateTransfer + corporateCredit

    result.total += categoryTotal
  }

  return result
}

export async function calculateMonthlyRevenue(
  year: number,
  month: number
): Promise<MonthlyRevenue> {
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0)

  const entries = await prisma.dailyEntry.findMany({
    where: {
      date: { gte: startDate, lte: endDate },
      status: "SUBMITTED",
    },
    include: { categories: true },
  })

  const result: MonthlyRevenue = {
    total: 0,
    averageDaily: 0,
    daysWithEntries: entries.length,
    byCategory: [],
    byPaymentMethod: [],
    byCustomerType: [],
    totalSim: 0,
    totalUsim: 0,
  }

  const categoryTotals = {
    dhiraaguBills: 0,
    retailReload: 0,
    wholesaleReload: 0,
    sim: 0,
    usim: 0,
  }

  const paymentTotals = {
    cash: 0,
    transfer: 0,
    credit: 0,
  }

  const customerTotals = {
    consumer: 0,
    corporate: 0,
  }

  for (const entry of entries) {
    const daily = calculateDailyRevenue(entry.categories)

    result.total += daily.total
    result.totalSim += daily.simQuantity
    result.totalUsim += daily.usimQuantity

    categoryTotals.dhiraaguBills += daily.byCategory.dhiraaguBills
    categoryTotals.retailReload += daily.byCategory.retailReload
    categoryTotals.wholesaleReload += daily.byCategory.wholesaleReload
    categoryTotals.sim += daily.byCategory.sim
    categoryTotals.usim += daily.byCategory.usim

    paymentTotals.cash += daily.byPaymentMethod.cash
    paymentTotals.transfer += daily.byPaymentMethod.transfer
    paymentTotals.credit += daily.byPaymentMethod.credit

    customerTotals.consumer += daily.byCustomerType.consumer
    customerTotals.corporate += daily.byCustomerType.corporate
  }

  // Calculate averages and percentages
  result.averageDaily = entries.length > 0 ? result.total / entries.length : 0

  result.byCategory = [
    {
      category: "Dhiraagu Bills",
      total: categoryTotals.dhiraaguBills,
      percentage: result.total > 0 ? (categoryTotals.dhiraaguBills / result.total) * 100 : 0,
    },
    {
      category: "Retail Reload",
      total: categoryTotals.retailReload,
      percentage: result.total > 0 ? (categoryTotals.retailReload / result.total) * 100 : 0,
    },
    {
      category: "Wholesale Reload",
      total: categoryTotals.wholesaleReload,
      percentage: result.total > 0 ? (categoryTotals.wholesaleReload / result.total) * 100 : 0,
    },
    {
      category: "SIM",
      total: categoryTotals.sim,
      percentage: result.total > 0 ? (categoryTotals.sim / result.total) * 100 : 0,
    },
    {
      category: "USIM",
      total: categoryTotals.usim,
      percentage: result.total > 0 ? (categoryTotals.usim / result.total) * 100 : 0,
    },
  ]

  result.byPaymentMethod = [
    {
      method: "Cash",
      total: paymentTotals.cash,
      percentage: result.total > 0 ? (paymentTotals.cash / result.total) * 100 : 0,
    },
    {
      method: "Transfer",
      total: paymentTotals.transfer,
      percentage: result.total > 0 ? (paymentTotals.transfer / result.total) * 100 : 0,
    },
    {
      method: "Credit",
      total: paymentTotals.credit,
      percentage: result.total > 0 ? (paymentTotals.credit / result.total) * 100 : 0,
    },
  ]

  result.byCustomerType = [
    {
      type: "Consumer",
      total: customerTotals.consumer,
      percentage: result.total > 0 ? (customerTotals.consumer / result.total) * 100 : 0,
    },
    {
      type: "Corporate",
      total: customerTotals.corporate,
      percentage: result.total > 0 ? (customerTotals.corporate / result.total) * 100 : 0,
    },
  ]

  return result
}
