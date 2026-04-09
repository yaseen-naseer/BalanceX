'use client'

import { useState, useMemo } from 'react'
import { useApiClient } from '@/hooks/use-api-client'
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
import { Key, Eye, EyeOff, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export interface PasswordChangeDialogProps {
  trigger?: React.ReactNode
}

interface PasswordRequirement {
  label: string
  met: boolean
}

function getRequirements(password: string): PasswordRequirement[] {
  return [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'Uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'Lowercase letter', met: /[a-z]/.test(password) },
    { label: 'Number', met: /[0-9]/.test(password) },
    { label: 'Special character (!@#$%^&*)', met: /[!@#$%^&*]/.test(password) },
  ]
}

function getStrength(requirements: PasswordRequirement[]): { score: number; label: string; color: string } {
  const met = requirements.filter((r) => r.met).length
  if (met <= 1) return { score: 0, label: 'Very weak', color: 'bg-rose-500' }
  if (met === 2) return { score: 25, label: 'Weak', color: 'bg-rose-500' }
  if (met === 3) return { score: 50, label: 'Fair', color: 'bg-amber-500' }
  if (met === 4) return { score: 75, label: 'Good', color: 'bg-blue-500' }
  return { score: 100, label: 'Strong', color: 'bg-emerald-500' }
}

function PasswordInput({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pr-10"
      />
      <button
        type="button"
        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        onClick={() => setVisible(!visible)}
        tabIndex={-1}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )
}

export function PasswordChangeDialog({ trigger }: PasswordChangeDialogProps) {
  const api = useApiClient()
  const [open, setOpen] = useState(false)
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [isChanging, setIsChanging] = useState(false)

  const requirements = useMemo(
    () => getRequirements(passwordData.newPassword),
    [passwordData.newPassword]
  )
  const strength = useMemo(() => getStrength(requirements), [requirements])
  const allRequirementsMet = requirements.every((r) => r.met)
  const passwordsMatch = passwordData.newPassword === passwordData.confirmPassword
  const sameAsOld = passwordData.currentPassword.length > 0 &&
    passwordData.newPassword.length > 0 &&
    passwordData.currentPassword === passwordData.newPassword

  const canSubmit =
    passwordData.currentPassword.length > 0 &&
    allRequirementsMet &&
    passwordsMatch &&
    !sameAsOld &&
    passwordData.confirmPassword.length > 0

  const handleChangePassword = async () => {
    if (!canSubmit) return

    setIsChanging(true)
    try {
      const result = await api.post('/api/users/change-password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      })

      if (result.success) {
        toast.success('Password changed successfully')
        setOpen(false)
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
      } else {
        toast.error(result.error || 'Failed to change password')
      }
    } catch {
      toast.error('Failed to change password')
    } finally {
      setIsChanging(false)
    }
  }

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)
    if (!isOpen) {
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
    }
  }

  const defaultTrigger = (
    <Button variant="outline" size="sm">
      <Key className="mr-2 h-4 w-4" />
      Change Password
    </Button>
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger || defaultTrigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change Password</DialogTitle>
          <DialogDescription>
            Enter your current password and choose a new password
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Current Password */}
          <div className="space-y-2">
            <Label htmlFor="current-password">Current Password</Label>
            <PasswordInput
              id="current-password"
              value={passwordData.currentPassword}
              onChange={(v) => setPasswordData({ ...passwordData, currentPassword: v })}
              placeholder="Enter current password"
            />
          </div>

          {/* New Password */}
          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <PasswordInput
              id="new-password"
              value={passwordData.newPassword}
              onChange={(v) => setPasswordData({ ...passwordData, newPassword: v })}
              placeholder="Enter new password"
            />

            {/* Strength meter */}
            {passwordData.newPassword.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Strength</span>
                  <span className={cn(
                    'font-medium',
                    strength.score <= 25 ? 'text-rose-600' :
                    strength.score <= 50 ? 'text-amber-600' :
                    strength.score <= 75 ? 'text-blue-600' :
                    'text-emerald-600'
                  )}>
                    {strength.label}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-300', strength.color)}
                    style={{ width: `${strength.score}%` }}
                  />
                </div>

                {/* Requirements checklist */}
                <div className="grid grid-cols-2 gap-1 pt-1">
                  {requirements.map((req) => (
                    <div key={req.label} className="flex items-center gap-1.5 text-xs">
                      {req.met ? (
                        <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                      ) : (
                        <XCircle className="h-3 w-3 text-muted-foreground shrink-0" />
                      )}
                      <span className={req.met ? 'text-emerald-600' : 'text-muted-foreground'}>
                        {req.label}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Same as old warning */}
                {sameAsOld && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-600">
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    New password must be different from current password
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm New Password</Label>
            <PasswordInput
              id="confirm-password"
              value={passwordData.confirmPassword}
              onChange={(v) => setPasswordData({ ...passwordData, confirmPassword: v })}
              placeholder="Confirm new password"
            />
            {passwordData.confirmPassword.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs">
                {passwordsMatch ? (
                  <>
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    <span className="text-emerald-600">Passwords match</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-3 w-3 text-rose-500" />
                    <span className="text-rose-600">Passwords do not match</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleChangePassword} disabled={isChanging || !canSubmit}>
            {isChanging ? 'Changing...' : 'Change Password'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
