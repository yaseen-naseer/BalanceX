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
import { SplitSquareHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { initialSettlementForm, type SettlementFormData } from './types'
import { CURRENCY_CODE, fmtCurrency } from '@/lib/constants'
import type { CreditCustomerWithBalance, CreateSettlementDto } from '@/types'
import { useSplitPayment } from '@/hooks/use-split-payment'
import { SplitPaymentInput, PaymentMethodButtons } from '@/components/shared'
import { randomUUID } from '@/lib/utils/uuid'
import { useDialogState } from '@/hooks/use-dialog-state'

export interface SettlementDialogProps {
  customer: CreditCustomerWithBalance
  onSubmit: (customerId: string, data: CreateSettlementDto) => Promise<void>
  trigger: React.ReactNode
}

export function SettlementDialog({ customer, onSubmit, trigger }: SettlementDialogProps) {
  const dialog = useDialogState()
  const [formData, setFormData] = useState<SettlementFormData>(initialSettlementForm)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const split = useSplitPayment({ defaultMethod: 'CASH' })

  const reset = () => {
    setFormData(initialSettlementForm)
    split.reset()
  }

  // Wraps useDialogState's onOpenChange to also reset form + split state on close.
  const handleOpenChange = (next: boolean) => {
    dialog.onOpenChange(next)
    if (!next) reset()
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
      dialog.close()
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSplitSubmit = async () => {
    if (split.splits.some((s) => !parseFloat(s.amount) || parseFloat(s.amount) <= 0)) {
      toast.error('All split amounts must be greater than 0')
      return
    }
    if (split.splitTotal > customer.outstandingBalance) {
      toast.error('Total settlement exceeds outstanding balance')
      return
    }

    setIsSubmitting(true)
    try {
      const groupId = randomUUID()
      for (const s of split.splits) {
        await onSubmit(customer.id, {
          customerId: customer.id,
          amount: parseFloat(s.amount),
          paymentMethod: s.method,
          reference: formData.reference || undefined,
          notes: formData.notes || undefined,
          date: format(new Date(), 'yyyy-MM-dd'),
          settlementGroupId: groupId,
        })
      }
      toast.success(`Split settlement recorded (${split.splits.length} payments, ${fmtCurrency(split.splitTotal)} ${CURRENCY_CODE})`)
      reset()
      dialog.close()
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = () => {
    if (split.isSplit) {
      handleSplitSubmit()
    } else {
      handleSingleSubmit()
    }
  }

  const canSubmit = split.isSplit
    ? split.splitTotal > 0 &&
      split.splitTotal <= customer.outstandingBalance &&
      split.splits.every((s) => parseFloat(s.amount) > 0)
    : parseFloat(formData.amount) > 0 &&
      parseFloat(formData.amount) <= customer.outstandingBalance

  const splitFooter = (
    <div
      className={`text-xs text-center font-medium ${
        split.splitTotal > customer.outstandingBalance
          ? 'text-rose-600'
          : split.splitTotal > 0
          ? 'text-emerald-600'
          : 'text-muted-foreground'
      }`}
    >
      Total: {fmtCurrency(split.splitTotal)} {CURRENCY_CODE}
      {split.splitTotal > customer.outstandingBalance && ' — exceeds outstanding'}
    </div>
  )

  return (
    <Dialog open={dialog.isOpen} onOpenChange={handleOpenChange}>
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
              variant={split.isSplit ? 'default' : 'ghost'}
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={split.toggle}
            >
              <SplitSquareHorizontal className="h-3.5 w-3.5" />
              Split Payment
            </Button>
          </div>

          {split.isSplit ? (
            <SplitPaymentInput
              splits={split.splits}
              onAdd={split.addSplit}
              onRemove={split.removeSplit}
              onUpdate={split.updateSplit}
              maxSplits={split.maxSplits}
              footer={splitFooter}
            />
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
                <PaymentMethodButtons
                  value={formData.paymentMethod}
                  onChange={(m) => setFormData({ ...formData, paymentMethod: m })}
                />
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
