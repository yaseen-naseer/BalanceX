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
import { Plus, CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { useWallet } from '@/hooks/use-wallet'
import { toast } from 'sonner'
import { TOPUP_FACTOR, DEALER_DISCOUNT_RATE, GST_RATE } from '@/lib/constants'

export interface AddTopupDialogProps {
  onAdd: () => void
  defaultDate?: string // ISO date string e.g. "2026-03-04"
}

export function AddTopupDialog({ onAdd, defaultDate }: AddTopupDialogProps) {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(() => defaultDate ? new Date(defaultDate + 'T12:00:00') : new Date())
  const [amount, setAmount] = useState('')
  const [source, setSource] = useState<'CASH' | 'BANK'>('CASH')
  const [notes, setNotes] = useState('')
  const { addTopup } = useWallet()

  const numAmount = parseFloat(amount) || 0

  // Calculate the breakdown from the amount paid to Dhiraagu
  const breakdown = useMemo(() => {
    if (numAmount <= 0) return null
    const reloadValue = Math.round((numAmount / TOPUP_FACTOR) * 100) / 100
    const discount = Math.round(reloadValue * DEALER_DISCOUNT_RATE * 100) / 100
    const afterDiscount = Math.round((reloadValue - discount) * 100) / 100
    const gst = Math.round(afterDiscount * GST_RATE * 100) / 100
    return { reloadValue, discount, afterDiscount, gst }
  }, [numAmount])

  const handleSubmit = async () => {
    if (!numAmount || numAmount <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    if (!breakdown) return

    const result = await addTopup({
      date: format(date, 'yyyy-MM-dd'),
      amount: breakdown.reloadValue,
      paidAmount: numAmount,
      source,
      notes: notes || undefined,
    })

    if (result) {
      toast.success(`Top-up added: ${breakdown.reloadValue.toLocaleString()} MVR reload (paid ${numAmount.toLocaleString()} MVR)`)
      setAmount('')
      setNotes('')
      setOpen(false)
      onAdd()
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Top-up
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Wallet Top-up</DialogTitle>
          <DialogDescription>Enter the amount paid to Dhiraagu</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
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
                  disabled={{ after: new Date() }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

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

          {breakdown && (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Reload Value</span>
                <span className="font-mono font-semibold text-primary">{breakdown.reloadValue.toLocaleString()} MVR</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Discount ({DEALER_DISCOUNT_RATE * 100}%)</span>
                <span className="font-mono">-{breakdown.discount.toLocaleString()} MVR</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">After Discount</span>
                <span className="font-mono">{breakdown.afterDiscount.toLocaleString()} MVR</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">GST ({GST_RATE * 100}%)</span>
                <span className="font-mono">+{breakdown.gst.toLocaleString()} MVR</span>
              </div>
              <div className="flex justify-between text-xs border-t pt-1.5 mt-1.5">
                <span className="text-muted-foreground font-medium">Total Paid</span>
                <span className="font-mono font-medium">{numAmount.toLocaleString()} MVR</span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Source</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={source === 'CASH' ? 'default' : 'outline'}
                onClick={() => setSource('CASH')}
                className="flex-1"
              >
                Cash
              </Button>
              <Button
                type="button"
                variant={source === 'BANK' ? 'default' : 'outline'}
                onClick={() => setSource('BANK')}
                className="flex-1"
              >
                Bank Transfer
              </Button>
            </div>
          </div>

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
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!breakdown}>
            Add Top-up
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
