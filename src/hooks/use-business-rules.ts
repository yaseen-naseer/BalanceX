"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useApiClient } from "./use-api-client"
import { BUSINESS_RULES_DEFAULTS, type BusinessRules } from "@/lib/business-rules-shared"

export interface UseBusinessRulesReturn {
  rules: BusinessRules
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

/**
 * Client-side reader for owner-tunable `BusinessRulesSettings`. Fetches once on
 * mount, returns the defaults until the network call resolves so callers never
 * see `undefined` — that way `canEditDailyEntry` can be called synchronously.
 *
 * If the request fails, `rules` stays at the defaults (the same values the
 * server's `getBusinessRules()` falls back to).
 */
export function useBusinessRules(): UseBusinessRulesReturn {
  const api = useApiClient()
  const [rules, setRules] = useState<BusinessRules>(BUSINESS_RULES_DEFAULTS)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await api.get<BusinessRules>("/api/settings/business-rules")
      if (result.success && result.data) {
        setRules(result.data)
      } else {
        setError(result.error ?? "Failed to fetch business rules")
      }
    } finally {
      setIsLoading(false)
    }
  }, [api])

  // One-shot fetch on mount; ref guard prevents the StrictMode double-fetch.
  const didFetchRef = useRef(false)
  useEffect(() => {
    if (didFetchRef.current) return
    didFetchRef.current = true
    refresh()
  }, [refresh])

  return { rules, isLoading, error, refresh }
}
