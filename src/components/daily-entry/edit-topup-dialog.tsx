"use client"

import { useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { PaymentMethodButtons } from "@/components/shared"
import {
  PAYMENT_METHOD_LABEL,
  paymentMethodToWalletSource,
  type PaymentMethod,
} from "@/hooks/use-split-payment"
import { CURRENCY_CODE, TOPUP_FACTOR, fmtCurrency } from "@/lib/constants"
import type { TopupItem } from "./types"

/**
 * Recover a 3-method (CASH/TRANSFER/CHEQUE) payment label from a stored top-up.
 * The DB only persists the binary `source` (CASH/BANK), so the original method is
 * read out of the leading word in `notes` ("Cash payment ...", "Cheque payment ...").
 * Falls back to TRANSFER for any BANK row that doesn't have a recognisable note.
 */
function parseMethodFromTopup(item: TopupItem): PaymentMethod {
  if (item.source === "CASH") return "CASH"
  const notes = (item.notes ?? "").trim().toLowerCase()
  if (notes.startsWith("cheque")) return "CHEQUE"
  return "TRANSFER"
}

/** Strip the auto-generated "<method> payment ..." prefix from notes; keep the user-supplied tail. */
function parseUserNotes(notes: string | null | undefined): string {
  if (!notes) return ""
  const sep = notes.indexOf(" — ")
  return sep === -1 ? "" : notes.slice(sep + 3)
}

export interface EditTopupDialogProps {
  topup: TopupItem | null
  onClose: () => void
  onSubmit: (
    id: string,
    data: { amount: number; paidAmount?: number; source: string; notes?: string },
  ) => Promise<boolean>
  onSuccess: () => void
}

/**
 * Edit dialog for a single (non-split) wallet top-up.
 * - Reload Amount is **derived** from Paid Amount (paid ÷ TOPUP_FACTOR) and shown read-only.
 * - Payment method is the same 3-option choice as Add (Cash / Transfer / Cheque).
 * - Notes are split into [auto method label] + [user note]; only the user note is editable.
 *
 * The caller should remount this component when the target topup changes by passing
 * `key={topup?.id ?? "closed"}` — that's how the form is reset cleanly without a
 * setState-in-useEffect pattern.
 */
export function EditTopupDialog({ topup, onClose, onSubmit, onSuccess }: EditTopupDialogProps) {
  const [paidAmount, setPaidAmount] = useState(() =>
    topup ? (topup.paidAmount ?? topup.amount).toString() : "",
  )
  const [method, setMethod] = useState<PaymentMethod>(() =>
    topup ? parseMethodFromTopup(topup) : "CASH",
  )
  const [reference, setReference] = useState("")
  const [userNotes, setUserNotes] = useState(() => parseUserNotes(topup?.notes))
  const [isSubmitting, setIsSubmitting] = useState(false)

  const numPaid = parseFloat(paidAmount) || 0
  const computedReload = useMemo(
    () => (numPaid > 0 ? Math.round((numPaid / TOPUP_FACTOR) * 100) / 100 : 0),
    [numPaid],
  )

  const handleConfirm = async () => {
    if (!topup) return
    if (numPaid <= 0) return
    setIsSubmitting(true)
    const refPart = reference.trim()
      ? ` (${method === "CHEQUE" ? "CHQ" : "REF"}: ${reference.trim()})`
      : ""
    const methodNote = `${PAYMENT_METHOD_LABEL[method]} payment${refPart}`
    const fullNotes = userNotes ? `${methodNote} — ${userNotes}` : methodNote

    const ok = await onSubmit(topup.id, {
      amount: computedReload,
      paidAmount: numPaid,
      source: paymentMethodToWalletSource(method),
      notes: fullNotes,
    })
    setIsSubmitting(false)
    if (ok) {
      onClose()
      onSuccess()
    }
  }

  return (
    <ConfirmDialog
      open={!!topup}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
      title="Edit Top-up"
      description="Adjust the amount paid to Dhiraagu. The reload value is recomputed automatically."
      confirmLabel="Save"
      variant="default"
      onConfirm={handleConfirm}
      isLoading={isSubmitting}
      loadingText="Saving..."
      disableConfirm={numPaid <= 0}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="editPaidAmount">Amount Paid to Dhiraagu (MVR) *</Label>
          <Input
            id="editPaidAmount"
            type="text"
            inputMode="decimal"
            value={paidAmount}
            onChange={(e) => {
              if (e.target.value === "" || /^\d*\.?\d*$/.test(e.target.value)) {
                setPaidAmount(e.target.value)
              }
            }}
            placeholder="0.00"
            className="font-mono"
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <Label>Reload Value (auto-calculated)</Label>
          <div className="flex h-9 items-center rounded-md border bg-muted/40 px-3 font-mono text-sm">
            {fmtCurrency(computedReload)} {CURRENCY_CODE}
          </div>
          <p className="text-xs text-muted-foreground">
            Derived from paid amount via Dhiraagu&apos;s discount/GST factors.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Payment Method</Label>
          <PaymentMethodButtons value={method} onChange={setMethod} size="sm" />
        </div>

        {method !== "CASH" && (
          <div className="space-y-2">
            <Label htmlFor="editReference">
              {method === "CHEQUE" ? "Cheque number" : "Transfer reference"}
            </Label>
            <Input
              id="editReference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder={method === "CHEQUE" ? "e.g. 000123" : "e.g. transaction id"}
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="editNotes">Notes (optional)</Label>
          <Input
            id="editNotes"
            value={userNotes}
            onChange={(e) => setUserNotes(e.target.value)}
            placeholder="Additional notes..."
          />
        </div>
      </div>
    </ConfirmDialog>
  )
}
