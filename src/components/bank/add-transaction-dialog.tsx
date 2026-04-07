'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { Plus, CalendarIcon, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { useBank } from '@/hooks/use-bank'
import { toast } from 'sonner'
import { CURRENCY_CODE } from '@/lib/constants'
import { initialTransactionForm, type TransactionFormData } from './types'

export interface AddTransactionDialogProps {
  onAdd: () => void
}

export function AddTransactionDialog({ onAdd }: AddTransactionDialogProps) {
  const [open, setOpen] = useState(false)
  const [formData, setFormData] = useState<TransactionFormData>(initialTransactionForm)
  const { addTransaction } = useBank()

  const handleSubmit = async () => {
    const amount = parseFloat(formData.amount)
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    if (!formData.reference.trim()) {
      toast.error('Please enter a reference')
      return
    }

    const result = await addTransaction({
      date: format(formData.date, 'yyyy-MM-dd'),
      type: formData.type,
      amount,
      reference: formData.reference,
      notes: formData.notes || undefined,
    })

    if (result) {
      toast.success(
        `${formData.type === 'DEPOSIT' ? 'Deposit' : 'Withdrawal'} of ${amount.toLocaleString()} ${CURRENCY_CODE} recorded`
      )
      setFormData(initialTransactionForm)
      setOpen(false)
      onAdd()
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Transaction
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Bank Transaction</DialogTitle>
          <DialogDescription>Record a deposit or withdrawal</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(formData.date, 'dd MMM yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={formData.date}
                  onSelect={(date) => date && setFormData({ ...formData, date })}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Transaction Type</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={formData.type === 'DEPOSIT' ? 'default' : 'outline'}
                onClick={() => setFormData({ ...formData, type: 'DEPOSIT' })}
                className={cn(
                  'flex-1',
                  formData.type === 'DEPOSIT' && 'bg-emerald-600 hover:bg-emerald-700'
                )}
              >
                <ArrowDownRight className="mr-2 h-4 w-4" />
                Deposit
              </Button>
              <Button
                type="button"
                variant={formData.type === 'WITHDRAWAL' ? 'default' : 'outline'}
                onClick={() => setFormData({ ...formData, type: 'WITHDRAWAL' })}
                className={cn(
                  'flex-1',
                  formData.type === 'WITHDRAWAL' && 'bg-rose-600 hover:bg-rose-700'
                )}
              >
                <ArrowUpRight className="mr-2 h-4 w-4" />
                Withdrawal
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount (MVR)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reference">Reference *</Label>
            <Input
              id="reference"
              value={formData.reference}
              onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
              placeholder="Bank slip number, transfer reference, etc."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes..."
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Add Transaction</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
