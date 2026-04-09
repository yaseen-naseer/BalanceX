'use client'

import { useState, useMemo, useEffect } from 'react'
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
import { Plus, CalendarIcon, Trash2, SplitSquareHorizontal } from 'lucide-react'
import { format } from 'date-fns'
import { useWallet } from '@/hooks/use-wallet'
import { toast } from 'sonner'
import { TOPUP_FACTOR, DEALER_DISCOUNT_RATE, GST_RATE, fmtCurrency } from '@/lib/constants'
import { useSystemStartDate } from '@/hooks/use-system-date'

type PaymentMethod = 'Cash' | 'Cheque' | 'Transfer'

interface PaymentSplit {
  method: PaymentMethod
  amount: string
}

export interface AddTopupDialogProps {
  onAdd: () => void
  defaultDate?: string
}

export function AddTopupDialog({ onAdd, defaultDate }: AddTopupDialogProps) {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(() => defaultDate ? new Date(defaultDate + 'T12:00:00') : new Date())
  const [amount, setAmount] = useState('')
  const [isSplit, setIsSplit] = useState(false)
  const [splits, setSplits] = useState<PaymentSplit[]>([
    { method: 'Cash', amount: '' },
  ])
  const [splitReference, setSplitReference] = useState('')
  const [singleMethod, setSingleMethod] = useState<PaymentMethod>('Cash')
  const [singleReference, setSingleReference] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { addTopup } = useWallet()
  const systemStartDate = useSystemStartDate()
  const [bankBalance, setBankBalance] = useState<number | null>(null)

  useEffect(() => {
    if (!open) return
    fetch('/api/bank')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data?.currentBalance != null) {
          setBankBalance(data.data.currentBalance)
        }
      })
      .catch(() => {})
  }, [open])

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
  const splitTotal = splits.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0)
  const splitRemaining = Math.round((numAmount - splitTotal) * 100) / 100

  // Bank amount from splits (non-cash)
  const bankAmountFromSplits = splits
    .filter((s) => s.method !== 'Cash')
    .reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0)

  // Bank amount for single mode
  const singleBankAmount = singleMethod !== 'Cash' ? numAmount : 0

  const reset = () => {
    setAmount('')
    setIsSplit(false)
    setSplits([{ method: 'Cash', amount: '' }])
    setSplitReference('')
    setSingleMethod('Cash')
    setSingleReference('')
    setNotes('')
  }

  const usedMethods = splits.map((s) => s.method)

  const addSplit = () => {
    if (splits.length >= 3) return
    const available = (['Cash', 'Cheque', 'Transfer'] as const).find((m) => !usedMethods.includes(m))
    if (!available) return
    setSplits([...splits, { method: available, amount: '' }])
  }

  const removeSplit = (index: number) => {
    if (splits.length <= 1) return
    setSplits(splits.filter((_, i) => i !== index))
  }

  const updateSplit = (index: number, field: keyof PaymentSplit, value: string) => {
    setSplits(splits.map((s, i) => i === index ? { ...s, [field]: value } : s))
  }

  const handleSubmit = async () => {
    if (!numAmount || numAmount <= 0 || !breakdown) {
      toast.error('Please enter a valid amount')
      return
    }

    if (isSplit) {
      // Validate splits
      if (splits.some((s) => !parseFloat(s.amount) || parseFloat(s.amount) <= 0)) {
        toast.error('All split amounts must be greater than 0')
        return
      }
      if (Math.abs(splitRemaining) > 0.01) {
        toast.error(`Split amounts must equal total (${fmtCurrency(splitRemaining)} MVR remaining)`)
        return
      }

      setIsSubmitting(true)
      try {
        // Create one top-up per split, each with proportional reload value
        const groupId = crypto.randomUUID()
        const refPart = splitReference.trim() ? ` (Ref: ${splitReference.trim()})` : ''
        for (const split of splits) {
          const splitPaid = parseFloat(split.amount)
          const splitReload = Math.round((splitPaid / TOPUP_FACTOR) * 100) / 100
          const source = split.method === 'Cash' ? 'CASH' as const : 'BANK' as const
          const methodNote = `${split.method} payment${refPart} (split ${splits.length}-way)`
          const fullNotes = notes ? `${methodNote} — ${notes}` : methodNote

          const result = await addTopup({
            date: format(date, 'yyyy-MM-dd'),
            amount: splitReload,
            paidAmount: splitPaid,
            source,
            notes: fullNotes,
            splitGroupId: groupId,
          })

          if (!result) {
            toast.error(`Failed to add ${split.method} split`)
            setIsSubmitting(false)
            return
          }
        }

        toast.success(`Top-up added: ${fmtCurrency(breakdown.reloadValue)} MVR reload (paid ${fmtCurrency(numAmount)} MVR, split ${splits.length} ways)`)
        reset()
        setOpen(false)
        onAdd()
      } finally {
        setIsSubmitting(false)
      }
    } else {
      // Single payment
      setIsSubmitting(true)
      try {
        const source = singleMethod === 'Cash' ? 'CASH' as const : 'BANK' as const
        const refPart = singleReference.trim()
          ? ` (${singleMethod === 'Cheque' ? 'CHQ' : 'REF'}: ${singleReference.trim()})`
          : ''
        const methodNote = `${singleMethod} payment${refPart}`
        const fullNotes = notes ? `${methodNote} — ${notes}` : methodNote

        const result = await addTopup({
          date: format(date, 'yyyy-MM-dd'),
          amount: breakdown.reloadValue,
          paidAmount: numAmount,
          source,
          notes: fullNotes,
        })

        if (result) {
          toast.success(`Top-up added: ${fmtCurrency(breakdown.reloadValue)} MVR reload (paid ${fmtCurrency(numAmount)} MVR via ${singleMethod})`)
          reset()
          setOpen(false)
          onAdd()
        }
      } finally {
        setIsSubmitting(false)
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
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
                  disabled={{ after: new Date(), ...(systemStartDate && { before: systemStartDate }) }}
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
          {bankBalance != null && (isSplit ? bankAmountFromSplits : singleBankAmount) > bankBalance && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 flex items-start gap-2">
              <span className="shrink-0">&#9888;</span>
              <span>
                Bank portion ({fmtCurrency(isSplit ? bankAmountFromSplits : singleBankAmount)} MVR) exceeds current bank balance ({fmtCurrency(bankBalance)} MVR).
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
                  variant={isSplit ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => {
                    setIsSplit(!isSplit)
                    if (!isSplit) {
                      setSplits([{ method: 'Cash', amount: '' }])
    setSplitReference('')
                    }
                  }}
                >
                  <SplitSquareHorizontal className="h-3.5 w-3.5" />
                  Split Payment
                </Button>
              )}
            </div>

            {isSplit ? (
              <div className="space-y-3">
                {splits.map((split, index) => (
                  <div key={index} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Split {index + 1}</span>
                      {splits.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => removeSplit(index)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {(['Cash', 'Cheque', 'Transfer'] as const).map((m) => {
                        const usedByOther = splits.some((s, i) => i !== index && s.method === m)
                        return (
                          <Button
                            key={m}
                            type="button"
                            variant={split.method === m ? 'default' : 'outline'}
                            onClick={() => updateSplit(index, 'method', m)}
                            className="flex-1"
                            size="sm"
                            disabled={usedByOther}
                          >
                            {m}
                          </Button>
                        )
                      })}
                    </div>
                    <Input
                      type="number"
                      step="0.01"
                      value={split.amount}
                      onChange={(e) => updateSplit(index, 'amount', e.target.value)}
                      placeholder="Amount"
                      className="font-mono"
                    />
                  </div>
                ))}
                {splits.length < 3 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={addSplit}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add Split
                  </Button>
                )}
                <Input
                  value={splitReference}
                  onChange={(e) => setSplitReference(e.target.value)}
                  placeholder="Reference number (shared across all splits)"
                />
                {numAmount > 0 && (
                  <div className={`text-xs text-center font-medium ${Math.abs(splitRemaining) <= 0.01 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {Math.abs(splitRemaining) <= 0.01
                      ? 'Splits match total'
                      : `Remaining: ${fmtCurrency(splitRemaining)} MVR`}
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  {(['Cash', 'Cheque', 'Transfer'] as const).map((m) => (
                    <Button
                      key={m}
                      type="button"
                      variant={singleMethod === m ? 'default' : 'outline'}
                      onClick={() => setSingleMethod(m)}
                      className="flex-1"
                      size="sm"
                    >
                      {m}
                    </Button>
                  ))}
                </div>
                {singleMethod !== 'Cash' && (
                  <Input
                    value={singleReference}
                    onChange={(e) => setSingleReference(e.target.value)}
                    placeholder={singleMethod === 'Cheque' ? 'Cheque number' : 'Transfer reference'}
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
          <Button variant="outline" onClick={() => { reset(); setOpen(false) }}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!breakdown || isSubmitting || (isSplit && Math.abs(splitRemaining) > 0.01)}
          >
            {isSubmitting ? 'Adding...' : 'Add Top-up'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
