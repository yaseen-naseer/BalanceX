'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Plus, Trash2, SplitSquareHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { initialSettlementForm, type SettlementFormData } from './types'
import { CURRENCY_CODE, fmtCurrency } from '@/lib/constants'
import type { CreditCustomerWithBalance, CreateSettlementDto } from '@/types'

type SettlementMethod = 'CASH' | 'TRANSFER' | 'CHEQUE'

interface SettlementSplit {
  method: SettlementMethod
  amount: string
}

export interface SettlementDialogProps {
  customer: CreditCustomerWithBalance
  onSubmit: (customerId: string, data: CreateSettlementDto) => Promise<void>
  trigger: React.ReactNode
}

export function SettlementDialog({ customer, onSubmit, trigger }: SettlementDialogProps) {
  const [open, setOpen] = useState(false)
  const [formData, setFormData] = useState<SettlementFormData>(initialSettlementForm)
  const [isSplit, setIsSplit] = useState(false)
  const [splits, setSplits] = useState<SettlementSplit[]>([{ method: 'CASH', amount: '' }])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const splitTotal = splits.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0)

  const reset = () => {
    setFormData(initialSettlementForm)
    setIsSplit(false)
    setSplits([{ method: 'CASH', amount: '' }])
  }

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) reset()
  }

  const addSplit = () => {
    if (splits.length >= 3) return
    const used = splits.map((s) => s.method)
    const available = (['CASH', 'TRANSFER', 'CHEQUE'] as const).find((m) => !used.includes(m))
    if (!available) return
    setSplits([...splits, { method: available, amount: '' }])
  }

  const removeSplit = (index: number) => {
    if (splits.length <= 1) return
    setSplits(splits.filter((_, i) => i !== index))
  }

  const updateSplit = (index: number, field: keyof SettlementSplit, value: string) => {
    setSplits(splits.map((s, i) => (i === index ? { ...s, [field]: value } : s)))
  }

  const handleSingleSubmit = async () => {
    const amount = parseFloat(formData.amount)
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid amount')
      return
    }
    if (amount > customer.outstandingBalance) {
      toast.error('Settlement amount exceeds outstanding balance')
      return
    }
    setIsSubmitting(true)
    try {
      await onSubmit(customer.id, {
        customerId: customer.id,
        amount,
        paymentMethod: formData.paymentMethod,
        reference: formData.reference || undefined,
        notes: formData.notes || undefined,
        date: format(new Date(), 'yyyy-MM-dd'),
      })
      reset()
      setOpen(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSplitSubmit = async () => {
    // Validate all splits
    if (splits.some((s) => !parseFloat(s.amount) || parseFloat(s.amount) <= 0)) {
      toast.error('All split amounts must be greater than 0')
      return
    }
    if (splitTotal > customer.outstandingBalance) {
      toast.error('Total settlement exceeds outstanding balance')
      return
    }

    setIsSubmitting(true)
    try {
      const groupId = crypto.randomUUID()
      for (const split of splits) {
        await onSubmit(customer.id, {
          customerId: customer.id,
          amount: parseFloat(split.amount),
          paymentMethod: split.method,
          reference: formData.reference || undefined,
          notes: formData.notes || undefined,
          date: format(new Date(), 'yyyy-MM-dd'),
          settlementGroupId: groupId,
        })
      }
      toast.success(`Split settlement recorded (${splits.length} payments, ${fmtCurrency(splitTotal)} ${CURRENCY_CODE})`)
      reset()
      setOpen(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = () => {
    if (isSplit) {
      handleSplitSubmit()
    } else {
      handleSingleSubmit()
    }
  }

  const canSubmit = isSplit
    ? splitTotal > 0 && splitTotal <= customer.outstandingBalance && splits.every((s) => parseFloat(s.amount) > 0)
    : parseFloat(formData.amount) > 0 && parseFloat(formData.amount) <= customer.outstandingBalance

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Settlement</DialogTitle>
          <DialogDescription>Record payment from {customer.name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="rounded-lg bg-muted p-4 flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Outstanding Balance</span>
            <span className="text-xl font-bold text-rose-600">
              {fmtCurrency(customer.outstandingBalance)} {CURRENCY_CODE}
            </span>
          </div>

          {/* Split toggle */}
          <div className="flex justify-end">
            <Button
              type="button"
              variant={isSplit ? 'default' : 'ghost'}
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => {
                setIsSplit(!isSplit)
                if (!isSplit) {
                  setSplits([{ method: 'CASH', amount: '' }])
                }
              }}
            >
              <SplitSquareHorizontal className="h-3.5 w-3.5" />
              Split Payment
            </Button>
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
                    {(['CASH', 'TRANSFER', 'CHEQUE'] as const).map((m) => {
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
                          {m === 'CASH' ? 'Cash' : m === 'TRANSFER' ? 'Transfer' : 'Cheque'}
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
              <div
                className={`text-xs text-center font-medium ${
                  splitTotal > customer.outstandingBalance
                    ? 'text-rose-600'
                    : splitTotal > 0
                    ? 'text-emerald-600'
                    : 'text-muted-foreground'
                }`}
              >
                Total: {fmtCurrency(splitTotal)} {CURRENCY_CODE}
                {splitTotal > customer.outstandingBalance && ' — exceeds outstanding'}
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="amount">Settlement Amount *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  max={customer.outstandingBalance}
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <div className="flex gap-2">
                  {(['CASH', 'TRANSFER', 'CHEQUE'] as const).map((m) => (
                    <Button
                      key={m}
                      type="button"
                      variant={formData.paymentMethod === m ? 'default' : 'outline'}
                      onClick={() => setFormData({ ...formData, paymentMethod: m })}
                      className="flex-1"
                    >
                      {m === 'CASH' ? 'Cash' : m === 'TRANSFER' ? 'Transfer' : 'Cheque'}
                    </Button>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="reference">Reference (optional)</Label>
            <Input
              id="reference"
              value={formData.reference}
              onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
              placeholder="Bank reference, receipt number, etc."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !canSubmit}>
            {isSubmitting ? 'Recording...' : 'Record Settlement'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
