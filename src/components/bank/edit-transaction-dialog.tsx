'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Pencil } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { BankTransactionWithBalance } from './types'

export interface EditTransactionDialogProps {
  transaction: BankTransactionWithBalance
  onUpdate: (id: string, data: { reference?: string; notes?: string }) => Promise<unknown>
}

export function EditTransactionDialog({ transaction, onUpdate }: EditTransactionDialogProps) {
  const [open, setOpen] = useState(false)
  const [reference, setReference] = useState(transaction.reference || '')
  const [notes, setNotes] = useState(transaction.notes || '')

  const handleSubmit = async () => {
    const result = await onUpdate(transaction.id, {
      reference: reference || undefined,
      notes: notes || undefined,
    })
    if (result) {
      toast.success('Transaction updated')
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary" aria-label="Edit transaction">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Transaction</DialogTitle>
          <DialogDescription>Update the reference or notes for this transaction</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="rounded-lg bg-muted p-4 flex justify-between items-center">
            <div>
              <span className="text-sm text-muted-foreground">
                {format(new Date(transaction.date), 'dd MMM yyyy')}
              </span>
              <span
                className={cn(
                  'ml-2 font-mono font-medium',
                  transaction.type === 'DEPOSIT' ? 'text-emerald-600' : 'text-rose-600'
                )}
              >
                {transaction.type === 'DEPOSIT' ? '+' : '-'}
                {Number(transaction.amount).toLocaleString()} MVR
              </span>
            </div>
            <Badge variant={transaction.type === 'DEPOSIT' ? 'default' : 'destructive'}>
              {transaction.type}
            </Badge>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-reference">Reference</Label>
            <Input
              id="edit-reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Bank slip number, transfer reference, etc."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-notes">Notes</Label>
            <Textarea
              id="edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes..."
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
