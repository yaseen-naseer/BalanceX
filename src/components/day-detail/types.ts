'use client'

import type { DailyEntryWithRelations } from '@/types'

export interface ScreenshotData {
  id: string
  filename: string
  filepath: string
  isVerified: boolean
  verifiedBy: string | null
  verifiedAt: Date | null
  verifyNotes: string | null
  uploader?: {
    id: string
    name: string
  }
}

export interface EntryTotals {
  totalCash: number
  totalTransfer: number
  totalCredit: number
  totalRevenue: number
  consumerTotal: number
  corporateTotal: number
  categoryTotals: Record<string, number>
  reloadSales: number
}

export function calculateEntryTotals(entry: DailyEntryWithRelations): EntryTotals {
  let totalCash = 0,
    totalTransfer = 0,
    totalCredit = 0
  let consumerTotal = 0,
    corporateTotal = 0
  let reloadSales = 0
  const categoryTotals: Record<string, number> = {}

  entry.categories?.forEach((cat) => {
    const catTotal =
      cat.consumerCash +
      cat.consumerTransfer +
      cat.consumerCredit +
      cat.corporateCash +
      cat.corporateTransfer +
      cat.corporateCredit
    categoryTotals[cat.category] = catTotal
    totalCash += cat.consumerCash + cat.corporateCash
    totalTransfer += cat.consumerTransfer + cat.corporateTransfer
    totalCredit += cat.consumerCredit + cat.corporateCredit
    consumerTotal += cat.consumerCash + cat.consumerTransfer + cat.consumerCredit
    corporateTotal += cat.corporateCash + cat.corporateTransfer + cat.corporateCredit

    if (cat.category === 'RETAIL_RELOAD' || cat.category === 'WHOLESALE_RELOAD') {
      reloadSales += catTotal
    }
  })

  return {
    totalCash,
    totalTransfer,
    totalCredit,
    totalRevenue: totalCash + totalTransfer + totalCredit,
    consumerTotal,
    corporateTotal,
    categoryTotals,
    reloadSales,
  }
}
