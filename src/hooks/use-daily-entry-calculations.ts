"use client"

import { useMemo } from "react"
import type { CalculationData } from "./use-daily-entry"
import type { SaleLineItemData } from "@/types"
import type {
  LocalEntryData,
  TotalsData,
  VarianceData,
} from "@/components/daily-entry/types"
import { CATEGORIES } from "@/components/daily-entry/types"
import { stripRetailGst } from "@/lib/utils/balance"
import type { DailyEntryWithRelations } from "@/types"

interface UseDailyEntryCalculationsOptions {
  localData: LocalEntryData
  calculationData: CalculationData
  saleLineItems: SaleLineItemData[]
  totalTopups: number
  entry: DailyEntryWithRelations | null
}

export function useDailyEntryCalculations({
  localData,
  calculationData,
  saleLineItems,
  totalTopups,
  entry,
}: UseDailyEntryCalculationsOptions) {
  // Calculate totals
  const totals = useMemo<TotalsData>(() => {
    let totalCash = 0,
      totalTransfer = 0,
      totalCredit = 0,
      consumerTotal = 0,
      corporateTotal = 0

    CATEGORIES.forEach((cat) => {
      const c = localData.categories[cat.key]
      totalCash += c.consumerCash + c.corporateCash
      totalTransfer += c.consumerTransfer + c.corporateTransfer
      totalCredit += c.consumerCredit + c.corporateCredit
      consumerTotal += c.consumerCash + c.consumerTransfer + c.consumerCredit
      corporateTotal += c.corporateCash + c.corporateTransfer + c.corporateCredit
    })

    return {
      totalCash,
      totalTransfer,
      totalCredit,
      totalRevenue: totalCash + totalTransfer + totalCredit,
      consumerTotal,
      corporateTotal,
    }
  }, [localData])

  // Calculate reload wallet cost
  const reloadSalesTotal = useMemo(() => {
    const retail = localData.categories.RETAIL_RELOAD
    const retailTotal = retail.consumerCash + retail.consumerTransfer
    const wholesaleWalletCost = saleLineItems
      .filter((li) => li.category === 'WHOLESALE_RELOAD')
      .reduce((sum, li) => sum + Number(li.amount), 0)
    return Math.round((stripRetailGst(retailTotal) + wholesaleWalletCost) * 100) / 100
  }, [localData, saleLineItems])

  // Calculate variance data
  const variance = useMemo<VarianceData>(() => {
    const round2 = (n: number) => Math.round(n * 100) / 100

    const walletExpected = round2(localData.wallet.opening + totalTopups - reloadSalesTotal)
    const walletVariance = round2(localData.wallet.closingActual - walletExpected)

    const cashExpected = round2(
      localData.cashDrawer.opening +
      totals.totalCash +
      calculationData.cashSettlements -
      localData.cashDrawer.bankDeposits -
      calculationData.walletTopupsFromCash
    )

    const cashVariance = round2(localData.cashDrawer.closingActual - cashExpected)

    return {
      cashExpected,
      cashVariance,
      walletExpected,
      walletVariance,
    }
  }, [localData, totalTopups, reloadSalesTotal, totals.totalCash, calculationData])

  // Credit data — per type. The React Compiler memoises these automatically,
  // so we just write plain expressions rather than manual `useMemo` calls
  // (which previously couldn't preserve their memoisation because the inferred
  // and manual dep arrays diverged).
  const creditSales = entry?.creditSales

  const linkedConsumerCreditTotal = creditSales
    ? creditSales
        .filter((s) => s.customer.type === "CONSUMER")
        .reduce((sum, s) => sum + Number(s.amount), 0)
    : 0

  const linkedCorporateCreditTotal = creditSales
    ? creditSales
        .filter((s) => s.customer.type === "CORPORATE")
        .reduce((sum, s) => sum + Number(s.amount), 0)
    : 0

  const linkedCreditTotal = linkedConsumerCreditTotal + linkedCorporateCreditTotal

  return {
    totals,
    reloadSalesTotal,
    variance,
    linkedCreditTotal,
    linkedConsumerCreditTotal,
    linkedCorporateCreditTotal,
  }
}
