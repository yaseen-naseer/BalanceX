"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useApiClient } from "./use-api-client"
import type { DailyEntryWithRelations, CreateDailyEntryDto, UpdateDailyEntryDto } from "@/types"

interface UseDailyEntryOptions {
  date?: string
  autoFetch?: boolean
}

export interface ValidationResult {
  canSubmit: boolean
  hasBlocks: boolean
  hasWarnings: boolean
  creditBalanced: boolean
  cashVariance: number
  walletVariance: number
  messages: Array<{ type: "block" | "warning"; message: string }>
}

export interface SubmitResult {
  success: boolean
  error?: string
  requiresConfirmation?: boolean
  validation?: ValidationResult
}

export interface CalculationData {
  cashSettlements: number
  walletTopupsFromCash: number
}

interface UseDailyEntryReturn {
  entry: DailyEntryWithRelations | null
  calculationData: CalculationData
  isLoading: boolean
  error: string | null
  fetchEntry: (date: string) => Promise<void>
  createEntry: (data: CreateDailyEntryDto) => Promise<DailyEntryWithRelations | null>
  updateEntry: (date: string, data: UpdateDailyEntryDto) => Promise<DailyEntryWithRelations | null>
  submitEntry: (date: string, acknowledgeWarnings?: boolean) => Promise<SubmitResult>
  reopenEntry: (date: string, reason: string) => Promise<boolean>
}

const defaultCalculationData: CalculationData = {
  cashSettlements: 0,
  walletTopupsFromCash: 0,
}

export function useDailyEntry(options: UseDailyEntryOptions = {}): UseDailyEntryReturn {
  const { date, autoFetch = true } = options
  const [entry, setEntry] = useState<DailyEntryWithRelations | null>(null)
  const [calculationData, setCalculationData] = useState<CalculationData>(defaultCalculationData)
  const [isLoading, setIsLoading] = useState(!!date && autoFetch)
  const [error, setError] = useState<string | null>(null)
  const api = useApiClient()

  const fetchEntry = useCallback(async (fetchDate: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/daily-entries/${fetchDate}`)
      const result = await response.json()

      if (result.success && result.data) {
        const { calculationData: calcData, ...entryData } = result.data
        setEntry(entryData)
        setCalculationData(calcData || defaultCalculationData)
      } else if (response.status === 404) {
        setEntry(null)
        setCalculationData(defaultCalculationData)
      } else {
        setError(result.error || "Failed to fetch entry")
      }
    } catch {
      setError("Network error")
    }
    setIsLoading(false)
  }, [])

  const createEntry = useCallback(async (
    data: CreateDailyEntryDto
  ): Promise<DailyEntryWithRelations | null> => {
    setIsLoading(true)
    setError(null)
    const result = await api.post<DailyEntryWithRelations>("/api/daily-entries", data)
    if (result.success && result.data) {
      setEntry(result.data)
      setIsLoading(false)
      return result.data
    }
    setError(result.error || "Failed to create entry")
    setIsLoading(false)
    return null
  }, [api])

  const updateEntry = useCallback(async (
    updateDate: string,
    data: UpdateDailyEntryDto
  ): Promise<DailyEntryWithRelations | null> => {
    setIsLoading(true)
    setError(null)
    const result = await api.put<DailyEntryWithRelations>(`/api/daily-entries/${updateDate}`, data)
    if (result.success && result.data) {
      setEntry(result.data)
      setIsLoading(false)
      return result.data
    }
    setError(result.error || "Failed to update entry")
    setIsLoading(false)
    return null
  }, [api])

  const submitEntry = useCallback(async (
    submitDate: string,
    acknowledgeWarnings: boolean = false
  ): Promise<SubmitResult> => {
    setIsLoading(true)
    setError(null)
    const result = await api.put<DailyEntryWithRelations>(
      `/api/daily-entries/${submitDate}`,
      { status: "SUBMITTED", acknowledgeWarnings }
    )

    if (result.success && result.data) {
      setEntry(result.data)
      setIsLoading(false)
      return { success: true }
    }

    // Check if this is a validation failure
    if (result.validation) {
      setIsLoading(false)
      return {
        success: false,
        error: result.error,
        requiresConfirmation: result.requiresConfirmation,
        validation: result.validation as ValidationResult,
      }
    }

    setError(result.error || "Failed to submit entry")
    setIsLoading(false)
    return { success: false, error: result.error }
  }, [api])

  const reopenEntry = useCallback(async (
    reopenDate: string,
    reason: string
  ): Promise<boolean> => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/daily-entries/${reopenDate}/reopen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      const result = await response.json()
      if (result.success && result.data) {
        setEntry(result.data)
        setIsLoading(false)
        return true
      }
      setError(result.error || 'Failed to reopen entry')
      setIsLoading(false)
      return false
    } catch {
      setError('Network error')
      setIsLoading(false)
      return false
    }
  }, [])

  // Fetch on mount and when date changes - ref tracks last fetched date to prevent StrictMode double-fetch
  const lastFetchedDateRef = useRef<string | null>(null)
  useEffect(() => {
    if (date && autoFetch && lastFetchedDateRef.current !== date) {
      lastFetchedDateRef.current = date
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchEntry(date)
    }
  }, [date, autoFetch, fetchEntry])

  return useMemo(
    () => ({
      entry,
      calculationData,
      isLoading,
      error,
      fetchEntry,
      createEntry,
      updateEntry,
      submitEntry,
      reopenEntry,
    }),
    [entry, calculationData, isLoading, error, fetchEntry, createEntry, updateEntry, submitEntry, reopenEntry]
  )
}
