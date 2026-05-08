'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useDialogState } from '@/hooks/use-dialog-state'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { initialCustomerForm, type NewCustomerFormData } from './types'
import type { CreateCreditCustomerDto, CreditCustomerWithBalance, UpdateCreditCustomerDto } from '@/types'

export interface CustomerFormDialogProps {
  onSubmit: (data: CreateCreditCustomerDto) => Promise<void>
  trigger: React.ReactNode
  // Edit mode
  mode?: 'create' | 'edit'
  initialData?: CreditCustomerWithBalance
  onUpdate?: (id: string, data: UpdateCreditCustomerDto) => Promise<void>
}

export function CustomerFormDialog({ onSubmit, trigger, mode = 'create', initialData, onUpdate }: CustomerFormDialogProps) {
  const dialog = useDialogState()
  const [formData, setFormData] = useState<NewCustomerFormData>(initialCustomerForm)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Pre-populate form when editing
  useEffect(() => {
    if (dialog.isOpen && mode === 'edit' && initialData) {
      setFormData({
        name: initialData.name,
        phone: initialData.phone,
        email: initialData.email ?? '',
        type: initialData.type,
        creditLimit: initialData.creditLimit != null ? String(initialData.creditLimit) : '',
      })
    } else if (!dialog.isOpen) {
      setFormData(initialCustomerForm)
    }
  }, [dialog.isOpen, mode, initialData])

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Please enter a customer name')
      return
    }
    if (!formData.phone.trim()) {
      toast.error('Please enter a phone number')
      return
    }

    setIsSubmitting(true)
    try {
      if (mode === 'edit' && initialData && onUpdate) {
        await onUpdate(initialData.id, {
          name: formData.name,
          phone: formData.phone,
          email: formData.email || undefined,
          type: formData.type,
          creditLimit: formData.creditLimit ? parseFloat(formData.creditLimit) : undefined,
        })
      } else {
        await onSubmit({
          name: formData.name,
          phone: formData.phone,
          email: formData.email || undefined,
          type: formData.type,
          creditLimit: formData.creditLimit ? parseFloat(formData.creditLimit) : undefined,
        })
      }
      dialog.close()
    } finally {
      setIsSubmitting(false)
    }
  }

  const isEdit = mode === 'edit'

  return (
    <Dialog open={dialog.isOpen} onOpenChange={dialog.onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Credit Customer' : 'Add New Credit Customer'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update customer details' : 'Create a new customer account for credit sales'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Customer Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter customer name"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone *</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="7XXXXXX"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@example.com"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Customer Type</Label>
              <Select
                value={formData.type}
                onValueChange={(v) =>
                  setFormData({ ...formData, type: v as 'CONSUMER' | 'CORPORATE' })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CONSUMER">Consumer</SelectItem>
                  <SelectItem value="CORPORATE">Corporate</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="creditLimit">Credit Limit (optional)</Label>
              <Input
                id="creditLimit"
                type="number"
                value={formData.creditLimit}
                onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })}
                placeholder="No limit"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={dialog.close} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Customer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
