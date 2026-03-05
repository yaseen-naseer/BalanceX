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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { initialCustomerForm, type NewCustomerFormData } from './types'
import type { CreateCreditCustomerDto } from '@/types'

export interface CustomerFormDialogProps {
  onSubmit: (data: CreateCreditCustomerDto) => Promise<void>
  trigger: React.ReactNode
}

export function CustomerFormDialog({ onSubmit, trigger }: CustomerFormDialogProps) {
  const [open, setOpen] = useState(false)
  const [formData, setFormData] = useState<NewCustomerFormData>(initialCustomerForm)

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Please enter a customer name')
      return
    }
    if (!formData.phone.trim()) {
      toast.error('Please enter a phone number')
      return
    }
    await onSubmit({
      name: formData.name,
      phone: formData.phone,
      email: formData.email || undefined,
      type: formData.type,
      creditLimit: formData.creditLimit ? parseFloat(formData.creditLimit) : undefined,
    })
    setFormData(initialCustomerForm)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Credit Customer</DialogTitle>
          <DialogDescription>Create a new customer account for credit sales</DialogDescription>
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
                placeholder="0.00"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Add Customer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
