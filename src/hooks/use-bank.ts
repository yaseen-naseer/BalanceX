"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useApiClient } from "./use-api-client"
import type { BankTransaction, BankSettings, CreateBankTransactionDto } from "@/types"

interface UpdateBankTransactionDto {
  id: string
  reference?: string
  notes?: string
}

interface BankData {
  transactions: BankTransaction[]
  settings: BankSettings | null
  currentBalance: number
}

interface UseBankReturn {
  transactions: BankTransaction[]
  settings: BankSettings | null
  currentBalance: number
  isLoading: boolean
  error: string | null
  fetchTransactions: () => Promise<void>
  addTransaction: (data: CreateBankTransactionDto) => Promise<BankTransaction | null>
  updateTransaction: (data: UpdateBankTransactionDto) => Promise<BankTransaction | null>
  deleteTransaction: (id: string) => Promise<{ success: boolean; error?: string }>
  setOpeningBalance: (balance: number) => Promise<boolean>
}

export function useBank(): UseBankReturn {
  const [transactions, setTransactions] = useState<BankTransaction[]>([])
  const [settings, setSettings] = useState<BankSettings | null>(null)
  const [currentBalance, setCurrentBalance] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const api = useApiClient()

  const fetchTransactions = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    const result = await api.get<BankData>("/api/bank", { params: { limit: 0 } })
    if (result.success && result.data) {
      setTransactions(result.data.transactions)
      setSettings(result.data.settings)
      setCurrentBalance(result.data.currentBalance)
    } else {
      setError(result.error || "Failed to fetch bank data")
    }
    setIsLoading(false)
  }, [api])

  const addTransaction = useCallback(async (
    data: CreateBankTransactionDto
  ): Promise<BankTransaction | null> => {
    setIsLoading(true)
    setError(null)
    const result = await api.post<BankTransaction>("/api/bank", data)
    if (result.success) {
      await fetchTransactions()
      return result.data!
    }
    setError(result.error || "Failed to add transaction")
    setIsLoading(false)
    return null
  }, [api, fetchTransactions])

  const updateTransaction = useCallback(async (
    data: UpdateBankTransactionDto
  ): Promise<BankTransaction | null> => {
    setIsLoading(true)
    setError(null)
    const result = await api.put<BankTransaction>("/api/bank", data)
    if (result.success) {
      await fetchTransactions()
      return result.data!
    }
    setError(result.error || "Failed to update transaction")
    setIsLoading(false)
    return null
  }, [api, fetchTransactions])

  const deleteTransaction = useCallback(async (id: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true)
    setError(null)
    const result = await api.delete("/api/bank", { params: { id } })
    if (result.success) {
      await fetchTransactions()
      return { success: true }
    }
    const errorMsg = result.error || "Failed to delete transaction"
    setError(errorMsg)
    setIsLoading(false)
    return { success: false, error: errorMsg }
  }, [api, fetchTransactions])

  const setOpeningBalance = useCallback(async (balance: number): Promise<boolean> => {
    setIsLoading(true)
    setError(null)
    const result = await api.patch("/api/bank", { openingBalance: balance })
    if (result.success) {
      await fetchTransactions()
      return true
    }
    setError(result.error || "Failed to update settings")
    setIsLoading(false)
    return false
  }, [api, fetchTransactions])

  // Initial data fetch - using ref to prevent double-fetch in StrictMode
  const didFetchRef = useRef(false)
  useEffect(() => {
    if (!didFetchRef.current) {
      didFetchRef.current = true
      fetchTransactions()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return useMemo(
    () => ({
      transactions,
      settings,
      currentBalance,
      isLoading,
      error,
      fetchTransactions,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      setOpeningBalance,
    }),
    [
      transactions,
      settings,
      currentBalance,
      isLoading,
      error,
      fetchTransactions,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      setOpeningBalance,
    ]
  )
}
