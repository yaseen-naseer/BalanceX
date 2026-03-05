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

interface WalletOpeningBalanceDialogProps {
  currentBalance: number
  onUpdate: () => void
  setOpeningBalance: (balance: number) => Promise<boolean>
}

export function WalletOpeningBalanceDialog({ currentBalance, onUpdate, setOpeningBalance }: WalletOpeningBalanceDialogProps) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState(currentBalance.toString())

  const handleSubmit = async () => {
    const balance = parseFloat(amount)
    if (isNaN(balance) || balance < 0) {
      toast.error('Please enter a valid amount')
      return
    }
    const result = await setOpeningBalance(balance)
    if (result) {
      toast.success('Wallet opening balance updated')
      setOpen(false)
      onUpdate()
    } else {
      toast.error('Failed to update opening balance')
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
          <DialogTitle>Set Wallet Opening Balance</DialogTitle>
          <DialogDescription>
            Set the initial wallet balance before any top-ups or reload sales were recorded in this system.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="openingBalance">Opening Balance (MVR)</Label>
            <Input
              id="openingBalance"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="font-mono"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
