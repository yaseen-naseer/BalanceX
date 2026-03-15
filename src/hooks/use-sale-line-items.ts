"use client"

import { useState, useCallback, useMemo, useRef, useEffect } from "react"
import { useApiClient } from "./use-api-client"
import type { SaleLineItemData, CreateSaleLineItemDto } from "@/types"

export interface EditSaleLineItemDto {
  amount?: number
  serviceNumber?: string | null
  note?: string | null
  reason: string
}

interface UseSaleLineItemsReturn {
  lineItems: SaleLineItemData[]
  isLoading: boolean
  getLineItemsForCell: (
    category: string,
    customerType: string,
    paymentMethod: string
  ) => SaleLineItemData[]
  getLineItemCount: (
    category: string,
    customerType: string,
    paymentMethod: string
  ) => number
  hasLineItems: (
    category: string,
    customerType: string,
    paymentMethod: string
  ) => boolean
  addLineItem: (
    data: CreateSaleLineItemDto
  ) => Promise<{ success: boolean; cellTotal?: number; cellCount?: number; error?: string }>
  editLineItem: (
    id: string,
    data: EditSaleLineItemDto
  ) => Promise<{ success: boolean; cellTotal?: number; cellCount?: number }>
  deleteLineItem: (
    id: string,
    reason?: string
  ) => Promise<{ success: boolean; cellTotal?: number; cellCount?: number }>
  refreshLineItems: () => Promise<void>
}

export function useSaleLineItems(dailyEntryId: string | null): UseSaleLineItemsReturn {
  const api = useApiClient()
  const [lineItems, setLineItems] = useState<SaleLineItemData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const fetchedRef = useRef<string | null>(null)

  const fetchLineItems = useCallback(async () => {
    if (!dailyEntryId) {
      setLineItems([])
      return
    }
    setIsLoading(true)
    try {
      const result = await api.get<SaleLineItemData[]>("/api/sale-line-items", {
        params: { dailyEntryId },
      })
      if (result.success && result.data) {
        setLineItems(result.data)
      }
    } finally {
      setIsLoading(false)
    }
  }, [api, dailyEntryId])

  // Fetch when dailyEntryId changes
  useEffect(() => {
    if (dailyEntryId && fetchedRef.current !== dailyEntryId) {
      fetchedRef.current = dailyEntryId
      fetchLineItems()
    } else if (!dailyEntryId) {
      fetchedRef.current = null
      setLineItems([])
    }
  }, [dailyEntryId, fetchLineItems])

  // Cell key helper
  const cellKey = useCallback(
    (category: string, customerType: string, paymentMethod: string) =>
      `${category}|${customerType}|${paymentMethod}`,
    []
  )

  // Group items by cell
  const cellMap = useMemo(() => {
    const map = new Map<string, SaleLineItemData[]>()
    for (const item of lineItems) {
      const key = cellKey(item.category, item.customerType, item.paymentMethod)
      const existing = map.get(key) || []
      existing.push(item)
      map.set(key, existing)
    }
    return map
  }, [lineItems, cellKey])

  const getLineItemsForCell = useCallback(
    (category: string, customerType: string, paymentMethod: string) =>
      cellMap.get(cellKey(category, customerType, paymentMethod)) || [],
    [cellMap, cellKey]
  )

  const getLineItemCount = useCallback(
    (category: string, customerType: string, paymentMethod: string) =>
      (cellMap.get(cellKey(category, customerType, paymentMethod)) || []).length,
    [cellMap, cellKey]
  )

  const hasLineItems = useCallback(
    (category: string, customerType: string, paymentMethod: string) =>
      (cellMap.get(cellKey(category, customerType, paymentMethod)) || []).length > 0,
    [cellMap, cellKey]
  )

  const addLineItem = useCallback(
    async (data: CreateSaleLineItemDto) => {
      const result = await api.post<{
        lineItem: SaleLineItemData
        cellTotal: number
        cellCount: number
      }>("/api/sale-line-items", data)

      if (result.success && result.data) {
        setLineItems((prev) => [...prev, result.data!.lineItem])
        return {
          success: true,
          cellTotal: result.data.cellTotal,
          cellCount: result.data.cellCount,
        }
      }
      return { success: false, error: result.error }
    },
    [api]
  )

  const editLineItem = useCallback(
    async (id: string, data: EditSaleLineItemDto) => {
      const result = await api.patch<{
        lineItem: SaleLineItemData
        cellTotal: number
        cellCount: number
      }>(`/api/sale-line-items/${id}`, data)

      if (result.success && result.data) {
        setLineItems((prev) =>
          prev.map((item) => (item.id === id ? result.data!.lineItem : item))
        )
        return {
          success: true,
          cellTotal: result.data.cellTotal,
          cellCount: result.data.cellCount,
        }
      }
      return { success: false }
    },
    [api]
  )

  const deleteLineItem = useCallback(
    async (id: string, reason?: string) => {
      const result = await api.delete<{ cellTotal: number; cellCount: number }>(
        `/api/sale-line-items/${id}`,
        { body: reason ? { reason } : undefined }
      )

      if (result.success && result.data) {
        setLineItems((prev) => prev.filter((item) => item.id !== id))
        return {
          success: true,
          cellTotal: result.data.cellTotal,
          cellCount: result.data.cellCount,
        }
      }
      return { success: false }
    },
    [api]
  )

  const refreshLineItems = useCallback(async () => {
    fetchedRef.current = null
    await fetchLineItems()
  }, [fetchLineItems])

  return {
    lineItems,
    isLoading,
    getLineItemsForCell,
    getLineItemCount,
    hasLineItems,
    addLineItem,
    editLineItem,
    deleteLineItem,
    refreshLineItems,
  }
}
