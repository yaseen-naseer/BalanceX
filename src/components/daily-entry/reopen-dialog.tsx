'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
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
import { Badge } from '@/components/ui/badge'

const PREDEFINED_REASONS = [
  'Incorrect sales amount',
  'Missing line items',
  'Wrong payment method',
  'Cash float error',
  'Screenshot mismatch',
  'Customer dispute',
]

export interface ReopenDialogProps {
  onReopen: (reason: string) => Promise<boolean>
  isLoading?: boolean
}

export function ReopenDialog({ onReopen, isLoading }: ReopenDialogProps) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleOpen = () => {
    setReason('')
    setError('')
    setOpen(true)
  }

  const handleReopen = async () => {
    if (reason.trim().length < 3) {
      setError('Please provide a reason (at least 3 characters)')
      return
    }
    setIsSubmitting(true)
    setError('')
    const success = await onReopen(reason.trim())
    setIsSubmitting(false)
    if (success) {
      setOpen(false)
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

      <AlertDialog open={open} onOpenChange={setOpen}>
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
            <Label>Quick select</Label>
            <div className="flex flex-wrap gap-1.5">
              {PREDEFINED_REASONS.map((r) => (
                <Badge
                  key={r}
                  variant={reason === r ? 'default' : 'outline'}
                  className="cursor-pointer text-xs"
                  onClick={() => { setReason(r); setError('') }}
                >
                  {r}
                </Badge>
              ))}
            </div>
            <Label htmlFor="reopen-reason">Reason for reopening</Label>
            <Textarea
              id="reopen-reason"
              placeholder="Or type a custom reason..."
              value={reason}
              onChange={(e) => {
                setReason(e.target.value)
                setError('')
              }}
              rows={3}
            />
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleReopen}
              disabled={isSubmitting || reason.trim().length < 3}
            >
              {isSubmitting ? 'Reopening...' : 'Reopen Entry'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
