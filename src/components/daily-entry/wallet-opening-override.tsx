"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Pencil } from "lucide-react"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { CURRENCY_CODE, fmtCurrency } from "@/lib/constants"

const OVERRIDE_REASONS = [
  "Previous day closing was incorrect",
  "System balance doesn't match actual",
  "Balance adjusted by management",
  "Starting fresh after stock count",
  "Correcting data entry error",
] as const

export interface WalletOpeningOverrideProps {
  /** The current wallet opening balance shown in read-only form. */
  opening: number
  /** Source of today's opening; "MANUAL" surfaces an "edited" hint below the field. */
  walletOpeningSource: string
  /** Reason captured the last time MANUAL was set, surfaced as a hint. */
  walletOpeningReason: string | null
  isReadOnly: boolean
  onOverride: (amount: number, reason: string) => Promise<boolean> | void
}

/**
 * Read-only display of the wallet opening balance, with a pencil button
 * (when not read-only) that opens an "Override" dialog.
 *
 * Encapsulates: the override dialog form state, validation, and reason picker.
 */
export function WalletOpeningOverride({
  opening,
  walletOpeningSource,
  walletOpeningReason,
  isReadOnly,
  onOverride,
}: WalletOpeningOverrideProps) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState("")
  const [reason, setReason] = useState("")
  const [customReason, setCustomReason] = useState("")

  const isManual = walletOpeningSource === "MANUAL"
  const finalReason = reason === "Other" ? customReason.trim() : reason

  const openDialog = () => {
    setAmount(opening.toString())
    setReason("")
    setCustomReason("")
    setOpen(true)
  }

  const handleConfirm = async () => {
    const value = parseFloat(amount)
    if (isNaN(value) || value < 0) return
    const result = await onOverride(value, finalReason)
    // Async path returns boolean; sync path returns undefined (treated as success).
    if (result === false) return
    setOpen(false)
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="walletOpening">Opening Balance</Label>
      <div className="flex items-center gap-2">
        <div className="flex-1 flex h-9 items-center rounded-md border bg-muted/40 px-3 font-mono text-sm">
          {fmtCurrency(opening)} {CURRENCY_CODE}
        </div>
        {!isReadOnly && (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={openDialog}
            title="Override opening balance"
            aria-label="Override opening balance"
          >
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </div>
      {isManual && walletOpeningReason && (
        <p className="text-xs text-amber-600">Manually set — {walletOpeningReason}</p>
      )}

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Override Opening Balance"
        description="Updates today's opening and shifts the system-wide wallet balance by the same amount. Provide a reason — this is recorded in the audit log."
        confirmLabel="Override"
        variant="warning"
        onConfirm={handleConfirm}
        disableConfirm={!finalReason || !amount || parseFloat(amount) < 0}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>New Opening Balance (MVR) *</Label>
            <Input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => {
                if (e.target.value === "" || /^\d*\.?\d*$/.test(e.target.value)) {
                  setAmount(e.target.value)
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
              value={reason}
              onValueChange={(v) => {
                setReason(v)
                if (v !== "Other") setCustomReason("")
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a reason..." />
              </SelectTrigger>
              <SelectContent>
                {OVERRIDE_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
            {reason === "Other" && (
              <Input
                placeholder="Enter reason..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
              />
            )}
          </div>
        </div>
      </ConfirmDialog>
    </div>
  )
}
