"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useApiClient } from "./use-api-client"
import type { WalletTopup, WalletSettings, CreateWalletTopupDto } from "@/types"

interface WalletData {
  topups: WalletTopup[]
  settings: WalletSettings | null
  openingBalance: number
  currentBalance: number
  monthlyUsage: number
}

interface PreviousClosingData {
  previousClosing: number
  previousDate: string | null
  source: "PREVIOUS_DAY" | "INITIAL_SETUP"
}

interface UseWalletReturn {
  topups: WalletTopup[]
  settings: WalletSettings | null
  openingBalance: number
  currentBalance: number
  monthlyUsage: number
  isLoading: boolean
  error: string | null
  fetchWallet: () => Promise<void>
  addTopup: (data: CreateWalletTopupDto) => Promise<WalletTopup | null>
  editTopup: (id: string, data: { amount: number; paidAmount?: number; source: string; notes?: string }) => Promise<boolean>
  deleteTopup: (id: string) => Promise<boolean>
  setOpeningBalance: (balance: number, reason: string) => Promise<boolean>
  getTopupsByDate: (date: string) => WalletTopup[]
  getTotalTopupsByDate: (date: string) => number
  getPreviousClosing: (date: string) => Promise<PreviousClosingData | null>
}

export function useWallet(): UseWalletReturn {
  const [topups, setTopups] = useState<WalletTopup[]>([])
  const [settings, setSettings] = useState<WalletSettings | null>(null)
  const [openingBalance, setOpeningBalanceValue] = useState(0)
  const [currentBalance, setCurrentBalance] = useState(0)
  const [monthlyUsage, setMonthlyUsage] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const api = useApiClient()

  const fetchWallet = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    const result = await api.get<WalletData>("/api/wallet", { params: { limit: "500" } })
    if (result.success && result.data) {
      setTopups(result.data.topups)
      setSettings(result.data.settings)
      setOpeningBalanceValue(result.data.openingBalance || 0)
      setCurrentBalance(result.data.currentBalance)
      setMonthlyUsage(result.data.monthlyUsage || 0)
    } else {
      setError(result.error || "Failed to fetch wallet data")
    }
    setIsLoading(false)
  }, [api])

  const addTopup = useCallback(async (
    data: CreateWalletTopupDto
  ): Promise<WalletTopup | null> => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await api.post<WalletTopup>("/api/wallet", data)
      if (result.success) {
        await fetchWallet()
        return result.data!
      }
      setError(result.error || "Failed to add top-up")
      return null
    } finally {
      setIsLoading(false)
    }
  }, [api, fetchWallet])

  const editTopup = useCallback(async (
    id: string,
    data: { amount: number; paidAmount?: number; source: string; notes?: string }
  ): Promise<boolean> => {
    const result = await api.put("/api/wallet", { id, ...data })
    if (result.success) {
      await fetchWallet()
      return true
    }
    return false
  }, [api, fetchWallet])

  const deleteTopup = useCallback(async (id: string): Promise<boolean> => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await api.delete("/api/wallet", { params: { id } })
      if (result.success) {
        await fetchWallet()
        return true
      }
      setError(result.error || "Failed to delete top-up")
      return false
    } finally {
      setIsLoading(false)
    }
  }, [api, fetchWallet])

  const setOpeningBalance = useCallback(async (balance: number, reason: string): Promise<boolean> => {
    const result = await api.patch<WalletSettings>("/api/wallet", { openingBalance: balance, reason })
    if (result.success) {
      await fetchWallet()
      return true
    }
    setError(result.error || "Failed to update opening balance")
    return false
  }, [api, fetchWallet])

  const getTopupsByDate = useCallback((date: string): WalletTopup[] => {
    return topups.filter((t) => {
      const topupDate = new Date(t.date).toISOString().split('T')[0]
      return topupDate === date
    })
  }, [topups])

  const getTotalTopupsByDate = useCallback((date: string): number => {
    return topups
      .filter((t) => {
        const topupDate = new Date(t.date).toISOString().split('T')[0]
        return topupDate === date
      })
      .reduce((sum, t) => sum + Number(t.amount), 0)
  }, [topups])

  const getPreviousClosing = useCallback(async (date: string): Promise<PreviousClosingData | null> => {
    const result = await api.get<PreviousClosingData>("/api/wallet", {
      params: { previousClosingFor: date },
    })
    return result.success ? result.data! : null
  }, [api])

  // Initial data fetch - using ref to prevent double-fetch in StrictMode
  const didFetchRef = useRef(false)
  useEffect(() => {
    if (!didFetchRef.current) {
      didFetchRef.current = true
      fetchWallet()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return useMemo(
    () => ({
      topups,
      settings,
      openingBalance,
      currentBalance,
      monthlyUsage,
      isLoading,
      error,
      fetchWallet,
      addTopup,
      editTopup,
      deleteTopup,
      setOpeningBalance,
      getTopupsByDate,
      getTotalTopupsByDate,
      getPreviousClosing,
    }),
    [
      topups,
      settings,
      openingBalance,
      currentBalance,
      monthlyUsage,
      isLoading,
      error,
      fetchWallet,
      addTopup,
      editTopup,
      deleteTopup,
      setOpeningBalance,
      getTopupsByDate,
      getTotalTopupsByDate,
      getPreviousClosing,
    ]
  )
}
