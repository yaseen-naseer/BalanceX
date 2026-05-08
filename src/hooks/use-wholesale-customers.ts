"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { useApiClient } from "./use-api-client"
import type { WholesaleCustomerData, CreateWholesaleCustomerDto, WholesaleDiscountTierData } from "@/types"
import { GST_MULTIPLIER, WHOLESALE_BASE_MIN_CASH } from "@/lib/constants"

export interface UseWholesaleCustomersReturn {
  customers: WholesaleCustomerData[]
  discountTiers: WholesaleDiscountTierData[]
  isLoading: boolean
  search: string
  setSearch: (value: string) => void
  createCustomer: (data: CreateWholesaleCustomerDto) => Promise<WholesaleCustomerData | null>
  refreshCustomers: () => Promise<void>
  /** Get the best discount % for a cash amount using global tiers or customer override */
  getDiscount: (cashAmount: number, customer: WholesaleCustomerData | null) => number | null
  /** Calculate reload amount from cash and discount */
  calculateReload: (cashAmount: number, discountPercent: number) => number
  /** Get the minimum cash amount (lowest active tier) */
  minCashAmount: number
}

export function useWholesaleCustomers(): UseWholesaleCustomersReturn {
  const api = useApiClient()
  const [customers, setCustomers] = useState<WholesaleCustomerData[]>([])
  const [discountTiers, setDiscountTiers] = useState<WholesaleDiscountTierData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [search, setSearch] = useState("")
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)
  const tiersFetchedRef = useRef(false)

  // Fetch discount tiers once
  useEffect(() => {
    if (tiersFetchedRef.current) return
    tiersFetchedRef.current = true
    api
      .get<WholesaleDiscountTierData[]>("/api/wholesale-discount-tiers")
      .then((result) => {
        if (result.success && result.data) {
          setDiscountTiers(result.data)
        }
      })
      .catch((error) => {
        console.error("Failed to fetch wholesale discount tiers:", error)
      })
  }, [api])

  const fetchCustomers = useCallback(
    async (searchQuery = "") => {
      setIsLoading(true)
      try {
        const result = await api.get<WholesaleCustomerData[]>(
          "/api/wholesale-customers",
          {
            params: {
              search: searchQuery,
              activeOnly: "true",
              limit: "50",
            },
          }
        )
        if (result.success && result.data) {
          setCustomers(result.data)
        }
      } finally {
        setIsLoading(false)
      }
    },
    [api]
  )

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchCustomers(search)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search, fetchCustomers])

  const createCustomer = useCallback(
    async (data: CreateWholesaleCustomerDto): Promise<WholesaleCustomerData | null> => {
      const result = await api.post<WholesaleCustomerData>(
        "/api/wholesale-customers",
        data
      )
      if (result.success && result.data) {
        setCustomers((prev) => [result.data!, ...prev])
        return result.data
      }
      return null
    },
    [api]
  )

  const refreshCustomers = useCallback(async () => {
    await fetchCustomers(search)
  }, [fetchCustomers, search])

  // Get the best discount for a cash amount
  const getDiscount = useCallback(
    (cashAmount: number, customer: WholesaleCustomerData | null): number | null => {
      // If customer has a fixed override, use it
      if (customer?.discountOverride != null) {
        return customer.discountOverride
      }

      // Auto: find highest active tier where cash >= minCashAmount
      const activeTiers = discountTiers
        .filter((t) => t.isActive)
        .sort((a, b) => b.minCashAmount - a.minCashAmount) // highest first

      for (const tier of activeTiers) {
        if (cashAmount >= tier.minCashAmount) {
          return tier.discountPercent
        }
      }

      return null // below all tiers
    },
    [discountTiers]
  )

  // Calculate reload from cash and discount
  const calculateReload = useCallback(
    (cashAmount: number, discountPercent: number): number => {
      const denominator = (1 - discountPercent / 100) * GST_MULTIPLIER
      return Math.round((cashAmount / denominator) * 100) / 100
    },
    []
  )

  // Min cash amount from lowest active tier
  const minCashAmount = discountTiers
    .filter((t) => t.isActive)
    .reduce((min, t) => Math.min(min, t.minCashAmount), Infinity)

  return {
    customers,
    discountTiers,
    isLoading,
    search,
    setSearch,
    createCustomer,
    refreshCustomers,
    getDiscount,
    calculateReload,
    minCashAmount: minCashAmount === Infinity ? WHOLESALE_BASE_MIN_CASH : minCashAmount,
  }
}
