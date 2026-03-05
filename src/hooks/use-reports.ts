"use client"

import { useEffect, useCallback, useMemo } from "react"
import { useAsyncOperation } from "./use-async-operation"
import { useApiClient } from "./use-api-client"

export interface DailyBreakdown {
  date: string
  dateFormatted: string
  dayOfWeek: string
  status: string
  totalRevenue: number
  cashRevenue: number
  transferRevenue: number
  creditRevenue: number
  simQuantity: number
  usimQuantity: number
  cashVariance: number
  walletVariance: number
  submittedBy: string
}

export interface PaymentMethodBreakdown {
  cash: { amount: number; percentage: number }
  transfer: { amount: number; percentage: number }
  credit: { amount: number; percentage: number }
}

export interface CustomerTypeBreakdown {
  consumer: { amount: number; percentage: number }
  corporate: { amount: number; percentage: number }
}

export interface CategoryBreakdown {
  category: string
  categoryLabel: string
  total: number
  cash: number
  transfer: number
  credit: number
  quantity: number
  percentage: number
}

export interface VarianceTrend {
  date: string
  dateFormatted: string
  cashVariance: number
  walletVariance: number
}

export interface AgingBucket {
  count: number
  amount: number
  customers: Array<{ name: string; amount: number; days?: number }>
}

export interface CreditAging {
  current: AgingBucket
  days30: AgingBucket
  days60: AgingBucket
  days90Plus: AgingBucket
}

export interface ReportSummary {
  totalRevenue: number
  dailyAverage: number
  submittedDays: number
  draftDays: number
  missingDays: number
  totalCashVariance: number
  totalWalletVariance: number
}

export interface MonthlyReportData {
  month: string
  monthLabel: string
  summary: ReportSummary
  dailyBreakdown: DailyBreakdown[]
  paymentMethodBreakdown: PaymentMethodBreakdown
  customerTypeBreakdown: CustomerTypeBreakdown
  categoryBreakdown: CategoryBreakdown[]
  varianceTrend: VarianceTrend[]
  creditAging: CreditAging
}

interface UseReportsReturn {
  data: MonthlyReportData | null
  isLoading: boolean
  error: string | null
  fetchReport: (month: string) => Promise<void>
}

export function useReports(initialMonth?: string): UseReportsReturn {
  const { isLoading, error, data, execute } = useAsyncOperation<MonthlyReportData>()
  const api = useApiClient()

  const fetchReport = useCallback(async (month: string) => {
    await execute(async () => {
      const result = await api.get<MonthlyReportData>("/api/reports", {
        params: { month },
      })
      if (!result.success) {
        throw new Error(result.error || "Failed to fetch report")
      }
      return result.data!
    })
  }, [execute, api])

  useEffect(() => {
    if (initialMonth) {
      fetchReport(initialMonth)
    }
  }, [initialMonth, fetchReport])

  return useMemo(
    () => ({ data, isLoading, error, fetchReport }),
    [data, isLoading, error, fetchReport]
  )
}
