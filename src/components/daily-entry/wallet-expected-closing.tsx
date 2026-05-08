"use client"

import { AlertTriangle, Info } from "lucide-react"
import { cn } from "@/lib/utils"
import { CURRENCY_CODE, fmtCurrency } from "@/lib/constants"

export interface WalletExpectedClosingProps {
  opening: number
  topups: number
  reloadSales: number
  expected: number
}

/**
 * Wallet expected-closing calculation panel: opening + top-ups - reload sales = balance.
 * Switches to a destructive-tone variant when reload sales exceed available wallet funds.
 */
export function WalletExpectedClosing({
  opening,
  topups,
  reloadSales,
  expected,
}: WalletExpectedClosingProps) {
  const overBalance = expected < 0

  return (
    <div
      className={cn(
        "rounded-lg border-2 p-4 space-y-3",
        overBalance ? "border-rose-300 bg-rose-50" : "border-blue-200 bg-blue-50",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 font-medium",
          overBalance ? "text-rose-700" : "text-blue-700",
        )}
      >
        {overBalance ? <AlertTriangle className="h-4 w-4" /> : <Info className="h-4 w-4" />}
        {overBalance ? "Reload sales exceed wallet balance!" : "Expected Closing Calculation"}
      </div>
      <div className="grid grid-cols-4 gap-2 text-sm">
        <div className="text-center">
          <p className="text-muted-foreground text-xs">Opening</p>
          <p className="font-mono font-medium">{fmtCurrency(opening)}</p>
        </div>
        <div className="text-center">
          <p className="text-muted-foreground text-xs">+ Top-ups</p>
          <p className="font-mono font-medium text-emerald-600">+{fmtCurrency(topups)}</p>
        </div>
        <div className="text-center">
          <p className="text-muted-foreground text-xs">- Reload Sales</p>
          <p
            className={cn(
              "font-mono font-medium",
              overBalance ? "text-rose-700 font-bold" : "text-rose-600",
            )}
          >
            -{fmtCurrency(reloadSales)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-muted-foreground text-xs">= Balance</p>
          <p
            className={cn(
              "font-mono font-bold",
              overBalance ? "text-rose-700" : "text-blue-700",
            )}
          >
            {fmtCurrency(expected)}
          </p>
        </div>
      </div>
      {overBalance && (
        <p className="text-xs text-rose-700">
          Add a top-up of at least{" "}
          <span className="font-semibold">
            {fmtCurrency(Math.abs(expected))} {CURRENCY_CODE}
          </span>{" "}
          or reduce reload sales before submitting.
        </p>
      )}
    </div>
  )
}
