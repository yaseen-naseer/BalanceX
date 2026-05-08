'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Plus, CalendarIcon, SplitSquareHorizontal } from 'lucide-react'
import { format } from 'date-fns'
import { useWallet } from '@/hooks/use-wallet'
import { useBankBalance } from '@/hooks/use-bank-balance'
import { toast } from 'sonner'
import { TOPUP_FACTOR, DEALER_DISCOUNT_RATE, GST_RATE, fmtCurrency } from '@/lib/constants'
import { useSystemStartDate } from '@/hooks/use-system-date'
import {
  useSplitPayment,
  paymentMethodToWalletSource,
  PAYMENT_METHOD_LABEL,
  type PaymentMethod,
} from '@/hooks/use-split-payment'
import { SplitPaymentInput, PaymentMethodButtons } from '@/components/shared'
import { randomUUID } from '@/lib/utils/uuid'
import { useDialogState } from '@/hooks/use-dialog-state'

export interface AddTopupDialogProps {
  onAdd: () => void
  defaultDate?: string
}

export function AddTopupDialog({ onAdd, defaultDate }: AddTopupDialogProps) {
  const dialog = useDialogState()
  const [date, setDate] = useState(() => defaultDate ? new Date(defaultDate + 'T12:00:00') : new Date())
  const [amount, setAmount] = useState('')
  const [splitReference, setSplitReference] = useState('')
  const [singleMethod, setSingleMethod] = useState<PaymentMethod>('CASH')
  const [singleReference, setSingleReference] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { addTopup } = useWallet()
  const systemStartDate = useSystemStartDate()
  const bankBalance = useBankBalance(dialog.isOpen)
  const split = useSplitPayment({ defaultMethod: 'CASH' })

  const numAmount = parseFloat(amount) || 0

  const breakdown = useMemo(() => {
    if (numAmount <= 0) return null
    const reloadValue = Math.round((numAmount / TOPUP_FACTOR) * 100) / 100
    const discount = Math.round(reloadValue * DEALER_DISCOUNT_RATE * 100) / 100
    const afterDiscount = Math.round((reloadValue - discount) * 100) / 100
    const gst = Math.round(afterDiscount * GST_RATE * 100) / 100
    return { reloadValue, discount, afterDiscount, gst }
  }, [numAmount])

  // Split payment totals
  const splitRemaining = Math.round((numAmount - split.splitTotal) * 100) / 100

  // Bank amount from splits (non-cash) and single-mode bank amount, used for the
  // "exceeds bank balance" warning.
  const bankAmountFromSplits = split.splits
    .filter((s) => s.method !== 'CASH')
    .reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0)
  const singleBankAmount = singleMethod !== 'CASH' ? numAmount : 0

  const reset = () => {
    setAmount('')
    setSplitReference('')
    setSingleMethod('CASH')
    setSingleReference('')
    setNotes('')
    split.reset()
  }

  const handleSubmit = async () => {
    if (!numAmount || numAmount <= 0 || !breakdown) {
      toast.error('Please enter a valid amount')
      return
    }

    if (split.isSplit) {
      if (split.splits.some((s) => !parseFloat(s.amount) || parseFloat(s.amount) <= 0)) {
        toast.error('All split amounts must be greater than 0')
        return
      }
      if (Math.abs(splitRemaining) > 0.01) {
        toast.error(`Split amounts must equal total (${fmtCurrency(splitRemaining)} MVR remaining)`)
        return
      }

      setIsSubmitting(true)
      try {
        // Create one top-up per split, each with a proportional reload value.
        const groupId = randomUUID()
        const refPart = splitReference.trim() ? ` (Ref: ${splitReference.trim()})` : ''
        for (const s of split.splits) {
          const splitPaid = parseFloat(s.amount)
          const splitReload = Math.round((splitPaid / TOPUP_FACTOR) * 100) / 100
          const methodNote = `${PAYMENT_METHOD_LABEL[s.method]} payment${refPart} (split ${split.splits.length}-way)`
          const fullNotes = notes ? `${methodNote} — ${notes}` : methodNote

          const result = await addTopup({
            date: format(date, 'yyyy-MM-dd'),
            amount: splitReload,
            paidAmount: splitPaid,
            source: paymentMethodToWalletSource(s.method),
            notes: fullNotes,
            splitGroupId: groupId,
          })

          if (!result) {
            toast.error(`Failed to add ${PAYMENT_METHOD_LABEL[s.method]} split`)
            setIsSubmitting(false)
            return
          }
        }

        toast.success(`Top-up added: ${fmtCurrency(breakdown.reloadValue)} MVR reload (paid ${fmtCurrency(numAmount)} MVR, split ${split.splits.length} ways)`)
        reset()
        dialog.close()
        onAdd()
      } finally {
        setIsSubmitting(false)
      }
    } else {
      // Single payment
      setIsSubmitting(true)
      try {
        const refPart = singleReference.trim()
          ? ` (${singleMethod === 'CHEQUE' ? 'CHQ' : 'REF'}: ${singleReference.trim()})`
          : ''
        const methodNote = `${PAYMENT_METHOD_LABEL[singleMethod]} payment${refPart}`
        const fullNotes = notes ? `${methodNote} — ${notes}` : methodNote

        const result = await addTopup({
          date: format(date, 'yyyy-MM-dd'),
          amount: breakdown.reloadValue,
          paidAmount: numAmount,
          source: paymentMethodToWalletSource(singleMethod),
          notes: fullNotes,
        })

        if (result) {
          toast.success(`Top-up added: ${fmtCurrency(breakdown.reloadValue)} MVR reload (paid ${fmtCurrency(numAmount)} MVR via ${PAYMENT_METHOD_LABEL[singleMethod]})`)
          reset()
          dialog.close()
          onAdd()
        }
      } finally {
        setIsSubmitting(false)
      }
    }
  }

  const splitFooter = numAmount > 0 ? (
    <div className={`text-xs text-center font-medium ${Math.abs(splitRemaining) <= 0.01 ? 'text-emerald-600' : 'text-amber-600'}`}>
      {Math.abs(splitRemaining) <= 0.01
        ? 'Splits match total'
        : `Remaining: ${fmtCurrency(splitRemaining)} MVR`}
    </div>
  ) : null

  return (
    <Dialog
      open={dialog.isOpen}
      onOpenChange={(v) => { dialog.onOpenChange(v); if (!v) reset() }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Top-up
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Wallet Top-up</DialogTitle>
          <DialogDescription>Enter the amount paid to Dhiraagu</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Date */}
          <div className="space-y-2">
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(date, 'dd MMM yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => d && setDate(d)}
                  // Fail-closed: when `systemStartDate` is null (fetch in flight),
                  // `before` defaults to today so all past dates stay disabled.
                  disabled={{ after: new Date(), before: systemStartDate ?? new Date() }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">Amount Paid to Dhiraagu (MVR)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>

          {/* Breakdown */}
          {breakdown && (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Reload Value</span>
                <span className="font-mono font-semibold text-primary">{fmtCurrency(breakdown.reloadValue)} MVR</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Discount ({DEALER_DISCOUNT_RATE * 100}%)</span>
                <span className="font-mono">-{fmtCurrency(breakdown.discount)} MVR</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">After Discount</span>
                <span className="font-mono">{fmtCurrency(breakdown.afterDiscount)} MVR</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">GST ({GST_RATE * 100}%)</span>
                <span className="font-mono">+{fmtCurrency(breakdown.gst)} MVR</span>
              </div>
              <div className="flex justify-between text-xs border-t pt-1.5 mt-1.5">
                <span className="text-muted-foreground font-medium">Total Paid</span>
                <span className="font-mono font-medium">{fmtCurrency(numAmount)} MVR</span>
              </div>
            </div>
          )}

          {/* Bank balance warning */}
          {bankBalance != null && (split.isSplit ? bankAmountFromSplits : singleBankAmount) > bankBalance && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 flex items-start gap-2">
              <span className="shrink-0">&#9888;</span>
              <span>
                Bank portion ({fmtCurrency(split.isSplit ? bankAmountFromSplits : singleBankAmount)} MVR) exceeds current bank balance ({fmtCurrency(bankBalance)} MVR).
              </span>
            </div>
          )}

          {/* Payment Method — Single or Split */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Payment Method</Label>
              {numAmount > 0 && (
                <Button
                  type="button"
                  variant={split.isSplit ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => {
                    split.toggle()
                    if (!split.isSplit) {
                      // entering split mode — clear single-mode reference
                      setSplitReference('')
                    }
                  }}
                >
                  <SplitSquareHorizontal className="h-3.5 w-3.5" />
                  Split Payment
                </Button>
              )}
            </div>

            {split.isSplit ? (
              <>
                <SplitPaymentInput
                  splits={split.splits}
                  onAdd={split.addSplit}
                  onRemove={split.removeSplit}
                  onUpdate={split.updateSplit}
                  maxSplits={split.maxSplits}
                  footer={splitFooter}
                />
                <Input
                  value={splitReference}
                  onChange={(e) => setSplitReference(e.target.value)}
                  placeholder="Reference number (shared across all splits)"
                />
              </>
            ) : (
              <>
                <PaymentMethodButtons
                  value={singleMethod}
                  onChange={setSingleMethod}
                  size="sm"
                />
                {singleMethod !== 'CASH' && (
                  <Input
                    value={singleReference}
                    onChange={(e) => setSingleReference(e.target.value)}
                    placeholder={singleMethod === 'CHEQUE' ? 'Cheque number' : 'Transfer reference'}
                  />
                )}
              </>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); dialog.close() }}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!breakdown || isSubmitting || (split.isSplit && Math.abs(splitRemaining) > 0.01)}
          >
            {isSubmitting ? 'Adding...' : 'Add Top-up'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
