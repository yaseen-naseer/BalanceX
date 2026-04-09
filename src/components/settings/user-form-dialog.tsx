'use client'

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
import { Plus } from 'lucide-react'
import type { User, UserFormData } from './types'

export interface UserFormDialogProps {
  mode: 'add' | 'edit'
  open: boolean
  onOpenChange: (open: boolean) => void
  formData: UserFormData
  onFormChange: (data: Partial<UserFormData>) => void
  onSubmit: () => void
  isSubmitting: boolean
  editingUser?: User | null
  trigger?: React.ReactNode
}

export function UserFormDialog({
  mode,
  open,
  onOpenChange,
  formData,
  onFormChange,
  onSubmit,
  isSubmitting,
  editingUser,
  trigger,
}: UserFormDialogProps) {
  const isAdd = mode === 'add'
  const title = isAdd ? 'Add New User' : 'Edit User'
  const description = isAdd
    ? 'Create a new user account with specified role'
    : `Update user information for ${editingUser?.name}`
  const submitLabel = isAdd ? 'Create User' : 'Save Changes'
  const submitLoadingLabel = isAdd ? 'Creating...' : 'Saving...'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {isAdd && (
            <div className="space-y-2">
              <Label htmlFor="username">Username *</Label>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) => onFormChange({ username: e.target.value })}
                placeholder="Enter username"
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="name">Full Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => onFormChange({ name: e.target.value })}
              placeholder="Enter full name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => onFormChange({ email: e.target.value })}
              placeholder="Enter email (optional)"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">
              {isAdd ? 'Password *' : 'New Password'}
            </Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => onFormChange({ password: e.target.value })}
              placeholder={isAdd ? 'Enter password' : 'Leave blank to keep current password'}
            />
            <p className="text-xs text-muted-foreground">
              Min 8 chars, uppercase, lowercase, number, and special character (!@#$%^&*)
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Role *</Label>
            <Select
              value={formData.role}
              onValueChange={(value) => onFormChange({ role: value as UserFormData['role'] })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SALES">Sales</SelectItem>
                <SelectItem value="ACCOUNTANT">Accountant</SelectItem>
                <SelectItem value="OWNER">Owner</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={isSubmitting}>
            {isSubmitting ? submitLoadingLabel : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function AddUserButton({ onClick }: { onClick: () => void }) {
  return (
    <Button onClick={onClick}>
      <Plus className="mr-2 h-4 w-4" />
      Add User
    </Button>
  )
}
