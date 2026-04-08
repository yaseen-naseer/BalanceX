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
import { toast } from 'sonner'
import { format } from 'date-fns'
import { initialSettlementForm, type SettlementFormData } from './types'
import { CURRENCY_CODE, fmtCurrency } from '@/lib/constants'
import type { CreditCustomerWithBalance, CreateSettlementDto } from '@/types'

export interface SettlementDialogProps {
  customer: CreditCustomerWithBalance
  onSubmit: (customerId: string, data: CreateSettlementDto) => Promise<void>
  trigger: React.ReactNode
}

export function SettlementDialog({ customer, onSubmit, trigger }: SettlementDialogProps) {
  const [open, setOpen] = useState(false)
  const [formData, setFormData] = useState<SettlementFormData>(initialSettlementForm)

  const handleSubmit = async () => {
    const amount = parseFloat(formData.amount)
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid amount')
      return
    }
    if (amount > customer.outstandingBalance) {
      toast.error('Settlement amount exceeds outstanding balance')
      return
    }
    await onSubmit(customer.id, {
      customerId: customer.id,
      amount,
      paymentMethod: formData.paymentMethod,
      reference: formData.reference || undefined,
      notes: formData.notes || undefined,
      date: format(new Date(), 'yyyy-MM-dd'),
    })
    setFormData(initialSettlementForm)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
              <Button
                type="button"
                variant={formData.paymentMethod === 'CASH' ? 'default' : 'outline'}
                onClick={() => setFormData({ ...formData, paymentMethod: 'CASH' })}
                className="flex-1"
              >
                Cash
              </Button>
              <Button
                type="button"
                variant={formData.paymentMethod === 'TRANSFER' ? 'default' : 'outline'}
                onClick={() => setFormData({ ...formData, paymentMethod: 'TRANSFER' })}
                className="flex-1"
              >
                Transfer
              </Button>
            </div>
          </div>
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
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Record Settlement</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
