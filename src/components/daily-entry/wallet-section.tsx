"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { CheckCircle2, AlertTriangle, Info, Pencil } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { CurrencyInput } from "@/components/shared"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { AddTopupDialog } from "@/components/wallet"
import type { WalletData, VarianceData } from "./types"

const OVERRIDE_REASONS = [
  "Previous day closing was incorrect",
  "System balance doesn't match actual",
  "Balance adjusted by management",
  "Starting fresh after stock count",
  "Correcting data entry error",
] as const

export interface WalletSectionProps {
  wallet: WalletData
  reloadSalesTotal: number
  variance: VarianceData
  dayTopups: Array<{ id: string; amount: number; source: string; notes?: string | null }>
  totalTopups: number
  currentDate: string
  isReadOnly: boolean
  walletOpeningSource: string
  walletOpeningReason: string | null
  onFieldChange: (field: string, value: number | string) => void
  onOverrideWalletOpening: (amount: number, reason: string) => void
  onRefreshWallet: () => void
}

/**
 * Reload Wallet section component.
 * Displays wallet balance tracking and top-up management.
 */
export function WalletSection({
  wallet,
  reloadSalesTotal,
  variance,
  dayTopups,
  totalTopups,
  currentDate,
  isReadOnly,
  walletOpeningSource,
  walletOpeningReason,
  onFieldChange,
  onOverrideWalletOpening,
  onRefreshWallet,
}: WalletSectionProps) {
  const [showOverride, setShowOverride] = useState(false)
  const [overrideAmount, setOverrideAmount] = useState("")
  const [overrideReason, setOverrideReason] = useState("")
  const [overrideCustomReason, setOverrideCustomReason] = useState("")

  const isManual = walletOpeningSource === "MANUAL"
  const finalReason = overrideReason === "Other" ? overrideCustomReason.trim() : overrideReason

  const openOverrideDialog = () => {
    setOverrideAmount(wallet.opening.toString())
    setOverrideReason("")
    setOverrideCustomReason("")
    setShowOverride(true)
  }

  const handleConfirmOverride = () => {
    const amount = parseFloat(overrideAmount)
    if (isNaN(amount) || amount < 0) return
    onOverrideWalletOpening(amount, finalReason)
    setShowOverride(false)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Reload Wallet</CardTitle>
          <CardDescription>Track wallet balance and top-ups</CardDescription>
        </div>
        <AddTopupDialog defaultDate={currentDate} onAdd={onRefreshWallet} />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="walletOpening">Opening Balance</Label>
            <div className="flex items-center gap-2">
              <div className="flex-1 flex h-9 items-center rounded-md border bg-muted/40 px-3 font-mono text-sm">
                {wallet.opening.toLocaleString()} MVR
              </div>
              {!isReadOnly && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={openOverrideDialog}
                  title="Override opening balance"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
            </div>
            {isManual && walletOpeningReason && (
              <p className="text-xs text-amber-600">
                Manually set — {walletOpeningReason}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Today&apos;s Top-ups</Label>
            <div className="flex items-center gap-2">
              <Input
                value={`${totalTopups.toLocaleString()} MVR`}
                disabled
                className="font-mono"
              />
              {dayTopups.length > 0 && (
                <Badge variant="secondary">{dayTopups.length}</Badge>
              )}
            </div>
          </div>
        </div>

        {dayTopups.length > 0 && (
          <div className="rounded-lg border p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Top-up History</p>
            {dayTopups.map((t) => (
              <div key={t.id} className="flex items-center justify-between text-sm">
                <div>
                  <span className="font-mono font-medium">{Number(t.amount).toLocaleString()} MVR</span>
                  {t.notes && (
                    <p className="text-xs text-muted-foreground mt-0.5">{t.notes}</p>
                  )}
                </div>
                <Badge variant="outline" className="text-xs">
                  {t.source}
                </Badge>
              </div>
            ))}
          </div>
        )}

        <Separator />

        {/* Calculation Breakdown */}
        {(() => {
          const overBalance = variance.walletExpected < 0
          return (
            <div className={cn(
              "rounded-lg border-2 p-4 space-y-3",
              overBalance ? "border-rose-300 bg-rose-50" : "border-blue-200 bg-blue-50"
            )}>
              <div className={cn(
                "flex items-center gap-2 font-medium",
                overBalance ? "text-rose-700" : "text-blue-700"
              )}>
                {overBalance ? (
                  <AlertTriangle className="h-4 w-4" />
                ) : (
                  <Info className="h-4 w-4" />
                )}
                {overBalance
                  ? "Reload sales exceed wallet balance!"
                  : "Expected Closing Calculation"}
              </div>
              <div className="grid grid-cols-4 gap-2 text-sm">
                <div className="text-center">
                  <p className="text-muted-foreground text-xs">Opening</p>
                  <p className="font-mono font-medium">{wallet.opening.toLocaleString()}</p>
                </div>
                <div className="text-center">
                  <p className="text-muted-foreground text-xs">+ Top-ups</p>
                  <p className="font-mono font-medium text-emerald-600">
                    +{totalTopups.toLocaleString()}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-muted-foreground text-xs">- Reload Sales</p>
                  <p className={cn("font-mono font-medium", overBalance ? "text-rose-700 font-bold" : "text-rose-600")}>
                    -{reloadSalesTotal.toLocaleString()}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-muted-foreground text-xs">= Balance</p>
                  <p className={cn("font-mono font-bold", overBalance ? "text-rose-700" : "text-blue-700")}>
                    {variance.walletExpected.toLocaleString()}
                  </p>
                </div>
              </div>
              {overBalance && (
                <p className="text-xs text-rose-700">
                  Add a top-up of at least{" "}
                  <span className="font-semibold">
                    {Math.abs(variance.walletExpected).toLocaleString()} MVR
                  </span>{" "}
                  or reduce reload sales before submitting.
                </p>
              )}
            </div>
          )
        })()}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="walletClosing">Actual Closing</Label>
            <CurrencyInput
              id="walletClosing"
              value={wallet.closingActual}
              onChange={(v) => onFieldChange("wallet.closingActual", v)}
              disabled={isReadOnly}
            />
            <p className="text-xs text-muted-foreground">Enter your actual wallet balance</p>
          </div>
          <div className="space-y-2">
            <Label>Variance</Label>
            <div
              className={cn(
                "flex h-9 items-center rounded-md border px-3 font-mono",
                variance.walletVariance === 0
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                  : variance.walletVariance > 0
                    ? "bg-amber-50 border-amber-200 text-amber-700"
                    : "bg-rose-50 border-rose-200 text-rose-700"
              )}
            >
              {variance.walletVariance === 0 ? (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Balanced
                </>
              ) : (
                <>
                  {variance.walletVariance > 0 ? "+" : ""}
                  {variance.walletVariance.toLocaleString()} MVR
                  <AlertTriangle className="ml-auto h-4 w-4" />
                </>
              )}
            </div>
          </div>
        </div>
      </CardContent>

      {/* Override Opening Balance Dialog */}
      <ConfirmDialog
        open={showOverride}
        onOpenChange={setShowOverride}
        title="Override Opening Balance"
        description="The opening balance is automatically set from the previous day's closing. Provide a reason to override it."
        confirmLabel="Override"
        variant="warning"
        onConfirm={handleConfirmOverride}
        disableConfirm={!finalReason || !overrideAmount || parseFloat(overrideAmount) < 0}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>New Opening Balance (MVR) *</Label>
            <Input
              type="text"
              inputMode="decimal"
              value={overrideAmount}
              onChange={(e) => {
                if (e.target.value === "" || /^\d*\.?\d*$/.test(e.target.value)) {
                  setOverrideAmount(e.target.value)
                }
              }}
              placeholder="0.00"
              className="font-mono"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label>Reason for override *</Label>
            <Select
              value={overrideReason}
              onValueChange={(v) => {
                setOverrideReason(v)
                if (v !== "Other") setOverrideCustomReason("")
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a reason..." />
              </SelectTrigger>
              <SelectContent>
                {OVERRIDE_REASONS.map((reason) => (
                  <SelectItem key={reason} value={reason}>{reason}</SelectItem>
                ))}
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
            {overrideReason === "Other" && (
              <Input
                placeholder="Enter reason..."
                value={overrideCustomReason}
                onChange={(e) => setOverrideCustomReason(e.target.value)}
              />
            )}
          </div>
        </div>
      </ConfirmDialog>
    </Card>
  )
}
