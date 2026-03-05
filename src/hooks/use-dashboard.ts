"use client"

import { useEffect, useCallback, useMemo } from "react"
import { useAsyncOperation } from "./use-async-operation"
import { useApiClient } from "./use-api-client"
import type { DashboardSummary } from "@/types"

interface UseDashboardReturn {
  data: DashboardSummary | null
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useDashboard(): UseDashboardReturn {
  const { isLoading, error, data, execute } = useAsyncOperation<DashboardSummary>()
  const api = useApiClient()

  const fetchDashboard = useCallback(async () => {
    await execute(async () => {
      const result = await api.get<DashboardSummary>("/api/dashboard")
      if (!result.success) {
        throw new Error(result.error || "Failed to fetch dashboard data")
      }
      return result.data!
    })
  }, [execute, api])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  return useMemo(
    () => ({
      data,
      isLoading,
      error,
      refresh: fetchDashboard,
    }),
    [data, isLoading, error, fetchDashboard]
  )
}
