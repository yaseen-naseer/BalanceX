"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { AlertTriangle, AlertCircle } from "lucide-react"
import type { ValidationMessage } from "@/hooks/use-daily-entry-form"

export interface SubmissionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  messages: ValidationMessage[]
  onConfirm: () => void
}

/**
 * Variance warning dialog for submission.
 * Shows warnings before allowing submission with variances.
 */
export function SubmissionDialog({
  open,
  onOpenChange,
  messages,
  onConfirm,
}: SubmissionDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            Variance Detected
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>
              <p>The following variances were detected in your entry:</p>
              <ul className="mt-3 space-y-1">
                {messages.map((msg, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-amber-700">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {msg.message}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm">
                Are you sure you want to submit with these variances? This action cannot be undone.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-amber-600 hover:bg-amber-700"
          >
            Submit Anyway
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
