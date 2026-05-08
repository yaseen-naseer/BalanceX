"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useApiClient } from "./use-api-client"
import type { CreditCustomerWithBalance, CreateCreditCustomerDto, CreateSettlementDto } from "@/types"

interface UseCreditCustomersReturn {
  customers: CreditCustomerWithBalance[]
  isLoading: boolean
  error: string | null
  fetchCustomers: () => Promise<void>
  createCustomer: (data: CreateCreditCustomerDto) => Promise<CreditCustomerWithBalance | null>
  updateCustomer: (id: string, data: Partial<CreateCreditCustomerDto>) => Promise<boolean>
  recordSettlement: (customerId: string, data: CreateSettlementDto) => Promise<boolean>
}

export function useCreditCustomers(): UseCreditCustomersReturn {
  const [customers, setCustomers] = useState<CreditCustomerWithBalance[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const api = useApiClient()

  const fetchCustomers = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    const result = await api.get<CreditCustomerWithBalance[]>("/api/credit-customers")
    if (result.success) {
      setCustomers(result.data || [])
    } else {
      setError(result.error || "Failed to fetch customers")
    }
    setIsLoading(false)
  }, [api])

  const createCustomer = useCallback(async (
    data: CreateCreditCustomerDto
  ): Promise<CreditCustomerWithBalance | null> => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await api.post<CreditCustomerWithBalance>("/api/credit-customers", data)
      if (result.success && result.data) {
        setCustomers((prev) => [...prev, result.data!])
        return result.data
      }
      setError(result.error || "Failed to create customer")
      return null
    } finally {
      // Always reset — without this the table stays in skeleton state and the optimistically
      // added row never becomes visible until the next remount/refresh.
      setIsLoading(false)
    }
  }, [api])

  const updateCustomer = useCallback(async (
    id: string,
    data: Partial<CreateCreditCustomerDto>
  ): Promise<boolean> => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await api.patch<CreditCustomerWithBalance>(`/api/credit-customers/${id}`, data)
      if (result.success && result.data) {
        setCustomers((prev) =>
          prev.map((c) => (c.id === id ? { ...c, ...result.data } : c))
        )
        return true
      }
      setError(result.error || "Failed to update customer")
      return false
    } finally {
      setIsLoading(false)
    }
  }, [api])

  const recordSettlement = useCallback(async (
    customerId: string,
    data: CreateSettlementDto
  ): Promise<boolean> => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await api.post(`/api/credit-customers/${customerId}`, data)
      if (result.success) {
        await fetchCustomers()
        return true
      }
      setError(result.error || "Failed to record settlement")
      return false
    } finally {
      setIsLoading(false)
    }
  }, [api, fetchCustomers])

  // Initial data fetch - using ref to prevent double-fetch in StrictMode
  const didFetchRef = useRef(false)
  useEffect(() => {
    if (!didFetchRef.current) {
      didFetchRef.current = true
      fetchCustomers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return useMemo(
    () => ({
      customers,
      isLoading,
      error,
      fetchCustomers,
      createCustomer,
      updateCustomer,
      recordSettlement,
    }),
    [customers, isLoading, error, fetchCustomers, createCustomer, updateCustomer, recordSettlement]
  )
}
