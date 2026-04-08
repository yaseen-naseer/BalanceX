"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { CheckCircle2, AlertTriangle, Wallet } from "lucide-react"
import { cn } from "@/lib/utils"
import { CurrencyInput } from "@/components/shared"
import type { CashDrawerData, TotalsData, VarianceData } from "./types"
import { fmtCurrency } from "@/lib/constants"

export interface CashDrawerSectionProps {
  cashDrawer: CashDrawerData
  totals: TotalsData
  variance: VarianceData
  isReadOnly: boolean
  onFieldChange: (field: string, value: number) => void
  cashFloat?: {
    openingTotal?: number
    closingTotal?: number
    variance?: number
    selectedFloatAmount?: number
  } | null
}

/**
 * Cash Reconciliation section component.
 * Displays cash drawer inputs and variance calculation.
 */
export function CashDrawerSection({
  cashDrawer,
  totals,
  variance,
  isReadOnly,
  onFieldChange,
  cashFloat,
}: CashDrawerSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cash Reconciliation</CardTitle>
        <CardDescription>Verify cash drawer balance</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="cashOpening">Opening Cash</Label>
            <CurrencyInput
              id="cashOpening"
              value={cashDrawer.opening}
              onChange={(v) => onFieldChange("cashDrawer.opening", v)}
              disabled={isReadOnly}
            />
          </div>
          <div className="space-y-2">
            <Label>Total Cash Sales</Label>
            <Input
              value={`${fmtCurrency(totals.totalCash)} MVR`}
              disabled
              className="font-mono bg-muted"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="bankDeposits">Bank Deposits (Out)</Label>
          <CurrencyInput
            id="bankDeposits"
            value={cashDrawer.bankDeposits}
            onChange={(v) => onFieldChange("cashDrawer.bankDeposits", v)}
            disabled={isReadOnly}
          />
          <p className="text-xs text-muted-foreground">
            Cash taken to the bank during the day
          </p>
        </div>

        <Separator />

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Expected Closing</Label>
            <Input
              value={`${fmtCurrency(variance.cashExpected)} MVR`}
              disabled
              className="font-mono bg-muted"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cashClosing">Actual Closing</Label>
            <CurrencyInput
              id="cashClosing"
              value={cashDrawer.closingActual}
              onChange={(v) => onFieldChange("cashDrawer.closingActual", v)}
              disabled={isReadOnly}
            />
          </div>
        </div>

        {/* Cash Float Summary */}
        {cashFloat && (
          <>
            <Separator />
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Cash Float
              </Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Opening Float</span>
                  <div className="font-mono text-sm">
                    {fmtCurrency(cashFloat.openingTotal || 0)} MVR
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Closing Float</span>
                  <div className="font-mono text-sm">
                    {fmtCurrency(cashFloat.closingTotal || 0)} MVR
                  </div>
                </div>
              </div>
              {(cashFloat.variance || 0) !== 0 && (
                <div className="text-xs">
                  <span className="text-muted-foreground">Float Variance: </span>
                  <span
                    className={cn(
                      "font-semibold",
                      (cashFloat.variance || 0) === 0
                        ? "text-emerald-600"
                        : "text-amber-600"
                    )}
                  >
                    {(cashFloat.variance || 0) > 0 ? "+" : ""}
                    {fmtCurrency(cashFloat.variance || 0)} MVR
                  </span>
                </div>
              )}
            </div>
          </>
        )}

        <div className="space-y-2">
          <Label>Cash Variance (Excluding Float)</Label>
          <div
            className={cn(
              "flex h-12 items-center justify-center rounded-lg border-2 font-mono text-lg font-semibold",
              variance.cashVariance === 0
                ? "bg-muted border-muted"
                : variance.cashVariance > 0
                  ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                  : "bg-rose-50 border-rose-300 text-rose-700"
            )}
          >
            {variance.cashVariance === 0 ? (
              <>
                <CheckCircle2 className="mr-2 h-5 w-5" /> Balanced
              </>
            ) : (
              <>
                <AlertTriangle className="mr-2 h-5 w-5" />
                {variance.cashVariance > 0 ? "+" : ""}
                {fmtCurrency(variance.cashVariance)} MVR
              </>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Cash variance excludes the float amount which is tracked separately
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
