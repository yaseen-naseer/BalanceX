'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus } from 'lucide-react'
import { useApiClient } from '@/hooks/use-api-client'
import { toast } from 'sonner'
import type { WholesaleCustomerData } from '@/types'

const DISCOUNT_OPTIONS = [6.0, 6.5, 7.0, 7.5, 8.0] as const

interface NewCustomerDialogProps {
  onCreated: () => void
}

export function NewCustomerDialog({ onCreated }: NewCustomerDialogProps) {
  const api = useApiClient()
  const [showNewDialog, setShowNewDialog] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newBusinessName, setNewBusinessName] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [newDiscountOverride, setNewDiscountOverride] = useState<string>('auto')
  const [isCreating, setIsCreating] = useState(false)

  const handleCreate = async () => {
    if (!newName.trim() || !newPhone.trim()) {
      toast.error('Name and phone are required')
      return
    }
    setIsCreating(true)
    try {
      const result = await api.post<WholesaleCustomerData>('/api/wholesale-customers', {
        name: newName.trim(),
        phone: newPhone.trim(),
        businessName: newBusinessName.trim() || null,
        notes: newNotes.trim() || null,
        discountOverride: newDiscountOverride === 'auto' ? null : parseFloat(newDiscountOverride),
      })
      if (result.success && result.data) {
        toast.success(`Customer "${newName.trim()}" created`)
        setShowNewDialog(false)
        setNewName('')
        setNewPhone('')
        setNewBusinessName('')
        setNewNotes('')
        setNewDiscountOverride('auto')
        onCreated()
      } else {
        toast.error(result.error || 'Failed to create customer')
      }
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Customer
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Wholesale Customer</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Customer name"
              maxLength={100}
            />
          </div>
          <div className="space-y-2">
            <Label>Phone *</Label>
            <Input
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="Phone number"
              maxLength={20}
            />
          </div>
          <div className="space-y-2">
            <Label>Business Name</Label>
            <Input
              value={newBusinessName}
              onChange={(e) => setNewBusinessName(e.target.value)}
              placeholder="Optional business name"
              maxLength={100}
            />
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Input
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              placeholder="Optional notes"
              maxLength={500}
            />
          </div>
          <div className="space-y-2">
            <Label>Discount</Label>
            <Select value={newDiscountOverride} onValueChange={setNewDiscountOverride}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto (based on cash amount)</SelectItem>
                {DISCOUNT_OPTIONS.map((d) => (
                  <SelectItem key={d} value={d.toString()}>
                    Fixed {d}%
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Auto uses global tier thresholds. Fixed applies the same discount regardless of amount.
            </p>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            onClick={handleCreate}
            disabled={isCreating || !newName.trim() || !newPhone.trim()}
          >
            {isCreating ? 'Creating...' : 'Create Customer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
