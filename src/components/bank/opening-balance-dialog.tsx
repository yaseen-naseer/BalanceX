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
import { useBank } from '@/hooks/use-bank'
import { toast } from 'sonner'

export interface SetOpeningBalanceDialogProps {
  currentBalance: number
  onUpdate: () => void
}

export function SetOpeningBalanceDialog({
  currentBalance,
  onUpdate,
}: SetOpeningBalanceDialogProps) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState(currentBalance.toString())
  const { setOpeningBalance } = useBank()

  const handleSubmit = async () => {
    const balance = parseFloat(amount)
    if (isNaN(balance)) {
      toast.error('Please enter a valid amount')
      return
    }
    const result = await setOpeningBalance(balance)
    if (result) {
      toast.success('Opening balance updated')
      setOpen(false)
      onUpdate()
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Set Opening Balance
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set Opening Balance</DialogTitle>
          <DialogDescription>Set the initial bank balance to start tracking from</DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="openingBalance">Opening Balance (MVR)</Label>
            <Input
              id="openingBalance"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
