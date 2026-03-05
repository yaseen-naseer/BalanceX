"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Info } from "lucide-react"
import type { TotalsData } from "./types"

export interface DailySummaryBarProps {
  totals: TotalsData
}

/**
 * Daily Summary bar component.
 * Displays a summary of the day's totals at the bottom of the page.
 */
export function DailySummaryBar({ totals }: DailySummaryBarProps) {
  return (
    <Card className="bg-primary text-primary-foreground">
      <CardContent className="py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-xs opacity-80">Total Revenue</p>
              <p className="text-2xl font-bold">{totals.totalRevenue.toLocaleString()} MVR</p>
            </div>
            <Separator orientation="vertical" className="h-10 bg-primary-foreground/20" />
            <div className="flex gap-4">
              <div>
                <p className="text-xs opacity-80">Cash</p>
                <p className="font-semibold">{totals.totalCash.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs opacity-80">Transfer</p>
                <p className="font-semibold">{totals.totalTransfer.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs opacity-80">Credit</p>
                <p className="font-semibold">{totals.totalCredit.toLocaleString()}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 opacity-60" />
            <span className="text-sm opacity-80">
              Consumer: {totals.consumerTotal.toLocaleString()} | Corporate:{" "}
              {totals.corporateTotal.toLocaleString()}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
