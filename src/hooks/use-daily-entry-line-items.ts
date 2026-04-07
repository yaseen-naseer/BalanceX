"use client"

import { useCallback, useEffect, useRef } from "react"
import { useSaleLineItems } from "./use-sale-line-items"
import type { SaleLineItemData, CreateSaleLineItemDto } from "@/types"
import type {
  Category,
  LocalEntryData,
} from "@/components/daily-entry/types"

interface UseDailyEntryLineItemsOptions {
  entryId: string | null
  setLocalData: React.Dispatch<React.SetStateAction<LocalEntryData>>
}

export function useDailyEntryLineItems({
  entryId,
  setLocalData,
}: UseDailyEntryLineItemsOptions) {
  const {
    lineItems: saleLineItems,
    isLoading: saleLineItemsLoading,
    hasLineItems,
    getLineItemsForCell,
    getLineItemCount,
    addLineItem: addLineItemApi,
    editLineItem: editLineItemApi,
    deleteLineItem: deleteLineItemApi,
    refreshLineItems,
  } = useSaleLineItems(entryId)

  // When line items change, patch grid cells that are backed by line items
  const prevLineItemsRef = useRef<SaleLineItemData[]>([])
  useEffect(() => {
    if (saleLineItems === prevLineItemsRef.current) return
    prevLineItemsRef.current = saleLineItems
    if (saleLineItems.length === 0) return

    // Group line items by cell and compute totals
    const cellTotals = new Map<string, number>()
    for (const li of saleLineItems) {
      const ct = li.customerType.toLowerCase()
      const pm = li.paymentMethod.toLowerCase()
      const fieldKey = `${ct}${pm.charAt(0).toUpperCase() + pm.slice(1)}`
      const cellKey = `${li.category}:${fieldKey}`
      const value = li.category === "WHOLESALE_RELOAD" ? Number(li.cashAmount ?? li.amount) : Number(li.amount)
      cellTotals.set(cellKey, (cellTotals.get(cellKey) || 0) + value)
    }

    if (cellTotals.size === 0) return

    setLocalData((prev) => {
      const next = { ...prev, categories: { ...prev.categories } }
      let changed = false
      for (const [cellKey, total] of cellTotals) {
        const [category, fieldKey] = cellKey.split(":")
        const cat = prev.categories[category as Category]
        if (cat && cat[fieldKey as keyof typeof cat] !== total) {
          next.categories[category as Category] = { ...cat, [fieldKey]: total }
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [saleLineItems, setLocalData])

  // Helper to update local data after line item operations
  const updateCellTotal = useCallback(
    (category: string, customerType: string, paymentMethod: string, cellTotal: number) => {
      const ctKey = customerType.toLowerCase()
      const pmKey = paymentMethod.toLowerCase()
      const fieldKey = `${ctKey}${pmKey.charAt(0).toUpperCase() + pmKey.slice(1)}` as keyof LocalEntryData["categories"][Category]
      setLocalData((prev) => ({
        ...prev,
        categories: {
          ...prev.categories,
          [category]: {
            ...prev.categories[category as Category],
            [fieldKey]: cellTotal,
          },
        },
      }))
    },
    [setLocalData]
  )

  // Add line item and update local form data
  const addLineItem = useCallback(
    async (data: CreateSaleLineItemDto) => {
      const result = await addLineItemApi(data)
      if (result.success && result.cellTotal !== undefined) {
        updateCellTotal(data.category, data.customerType, data.paymentMethod, result.cellTotal)
      }
      return result
    },
    [addLineItemApi, updateCellTotal]
  )

  // Edit line item and update local form data
  const editLineItem = useCallback(
    async (id: string, data: { amount?: number; serviceNumber?: string | null; note?: string | null; reason: string }) => {
      const item = saleLineItems.find((li) => li.id === id)
      const result = await editLineItemApi(id, data)
      if (result.success && result.cellTotal !== undefined && item) {
        updateCellTotal(item.category, item.customerType, item.paymentMethod, result.cellTotal)
      }
      return result
    },
    [editLineItemApi, saleLineItems, updateCellTotal]
  )

  // Delete line item and update local form data
  const deleteLineItem = useCallback(
    async (id: string, reason?: string) => {
      const item = saleLineItems.find((li) => li.id === id)
      const result = await deleteLineItemApi(id, reason)
      if (result.success && result.cellTotal !== undefined && item) {
        updateCellTotal(item.category, item.customerType, item.paymentMethod, result.cellTotal)
      }
      return result
    },
    [deleteLineItemApi, saleLineItems, updateCellTotal]
  )

  return {
    saleLineItems,
    saleLineItemsLoading,
    hasLineItems,
    getLineItemsForCell,
    getLineItemCount,
    addLineItem,
    editLineItem,
    deleteLineItem,
    refreshLineItems,
  }
}
