"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useApiClient } from "./use-api-client"
import type { WalletTopup, WalletSettings, CreateWalletTopupDto } from "@/types"

interface WalletData {
  topups: WalletTopup[]
  settings: WalletSettings | null
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
  currentBalance: number
  monthlyUsage: number
  isLoading: boolean
  error: string | null
  fetchWallet: () => Promise<void>
  addTopup: (data: CreateWalletTopupDto) => Promise<WalletTopup | null>
  deleteTopup: (id: string) => Promise<boolean>
  setOpeningBalance: (balance: number) => Promise<boolean>
  getTopupsByDate: (date: string) => WalletTopup[]
  getTotalTopupsByDate: (date: string) => number
  getPreviousClosing: (date: string) => Promise<PreviousClosingData | null>
}

export function useWallet(): UseWalletReturn {
  const [topups, setTopups] = useState<WalletTopup[]>([])
  const [settings, setSettings] = useState<WalletSettings | null>(null)
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
    const result = await api.post<WalletTopup>("/api/wallet", data)
    if (result.success) {
      await fetchWallet()
      return result.data!
    }
    setError(result.error || "Failed to add top-up")
    setIsLoading(false)
    return null
  }, [api, fetchWallet])

  const deleteTopup = useCallback(async (id: string): Promise<boolean> => {
    setIsLoading(true)
    setError(null)
    const result = await api.delete("/api/wallet", { params: { id } })
    if (result.success) {
      await fetchWallet()
      return true
    }
    setError(result.error || "Failed to delete top-up")
    setIsLoading(false)
    return false
  }, [api, fetchWallet])

  const setOpeningBalance = useCallback(async (balance: number): Promise<boolean> => {
    const result = await api.patch<WalletSettings>("/api/wallet", { openingBalance: balance })
    if (result.success) {
      await fetchWallet()
      return true
    }
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
      currentBalance,
      monthlyUsage,
      isLoading,
      error,
      fetchWallet,
      addTopup,
      deleteTopup,
      setOpeningBalance,
      getTopupsByDate,
      getTotalTopupsByDate,
      getPreviousClosing,
    }),
    [
      topups,
      settings,
      currentBalance,
      monthlyUsage,
      isLoading,
      error,
      fetchWallet,
      addTopup,
      deleteTopup,
      setOpeningBalance,
      getTopupsByDate,
      getTotalTopupsByDate,
      getPreviousClosing,
    ]
  )
}
