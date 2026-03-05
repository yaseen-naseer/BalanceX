'use client'

import { useState } from 'react'
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

  const handleSubmit = async () => {
    const numAmount = parseFloat(amount)
    if (!numAmount || numAmount <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    const result = await addTopup({
      date: format(date, 'yyyy-MM-dd'),
      amount: numAmount,
      source,
      notes: notes || undefined,
    })

    if (result) {
      toast.success(`Top-up of ${numAmount.toLocaleString()} MVR added`)
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
          <DialogDescription>Record a reload wallet top-up</DialogDescription>
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
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount (MVR)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>

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
          <Button onClick={handleSubmit}>Add Top-up</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
