'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useDialogState } from '@/hooks/use-dialog-state'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { AlertTriangle, RotateCcw } from 'lucide-react'

const REOPEN_REASONS = [
  'Incorrect sales amount',
  'Missing line items',
  'Wrong payment method',
  'Cash float error',
  'Screenshot mismatch',
  'Customer dispute',
] as const

export interface ReopenDialogProps {
  onReopen: (reason: string) => Promise<boolean>
  isLoading?: boolean
}

export function ReopenDialog({ onReopen, isLoading }: ReopenDialogProps) {
  const dialog = useDialogState()
  const [selectedReason, setSelectedReason] = useState('')
  const [customReason, setCustomReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const finalReason = selectedReason === 'Other' ? customReason.trim() : selectedReason

  const handleOpen = () => {
    setSelectedReason('')
    setCustomReason('')
    setError('')
    dialog.open()
  }

  const handleReopen = async () => {
    if (!finalReason || finalReason.length < 3) {
      setError('Please provide a reason (at least 3 characters)')
      return
    }
    setIsSubmitting(true)
    setError('')
    const success = await onReopen(finalReason)
    setIsSubmitting(false)
    if (success) {
      dialog.close()
    } else {
      setError('Failed to reopen entry. Please try again.')
    }
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={handleOpen}
        disabled={isLoading || isSubmitting}
      >
        <RotateCcw className="mr-2 h-4 w-4" />
        Reopen Entry
      </Button>

      <AlertDialog open={dialog.isOpen} onOpenChange={dialog.onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <AlertDialogTitle>Reopen Submitted Entry</AlertDialogTitle>
            </div>
            <AlertDialogDescription>
              This will revert the entry back to draft status, allowing it to be
              edited and re-submitted. All changes will be tracked in the amendment
              history. A reason is required.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3 py-2">
            <Label>Reason for reopening *</Label>
            <Select
              value={selectedReason}
              onValueChange={(v) => {
                setSelectedReason(v)
                if (v !== 'Other') setCustomReason('')
                setError('')
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a reason..." />
              </SelectTrigger>
              <SelectContent>
                {REOPEN_REASONS.map((reason) => (
                  <SelectItem key={reason} value={reason}>{reason}</SelectItem>
                ))}
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
            {selectedReason === 'Other' && (
              <Input
                placeholder="Enter reason..."
                value={customReason}
                onChange={(e) => { setCustomReason(e.target.value); setError('') }}
                autoFocus
              />
            )}
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleReopen}
              disabled={isSubmitting || !finalReason || finalReason.length < 3}
            >
              {isSubmitting ? 'Reopening...' : 'Reopen Entry'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
