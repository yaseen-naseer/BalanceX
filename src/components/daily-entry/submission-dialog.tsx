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
import { AlertTriangle, AlertCircle, Send } from "lucide-react"
import type { ValidationMessage } from "@/hooks/use-daily-entry-form"

export interface SubmissionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  messages: ValidationMessage[]
  onConfirm: () => void
}

/**
 * Submission confirmation dialog.
 * Always shown before submit — displays warnings if any, or a clean confirmation.
 */
export function SubmissionDialog({
  open,
  onOpenChange,
  messages,
  onConfirm,
}: SubmissionDialogProps) {
  const warnings = messages.filter((m) => m.type === "warning")
  const hasWarnings = warnings.length > 0

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className={`flex items-center gap-2 ${hasWarnings ? "text-amber-600" : ""}`}>
            {hasWarnings ? (
              <>
                <AlertTriangle className="h-5 w-5" />
                Variance Detected
              </>
            ) : (
              <>
                <Send className="h-5 w-5" />
                Submit Daily Entry
              </>
            )}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>
              {hasWarnings ? (
                <>
                  <p>The following variances were detected in your entry:</p>
                  <ul className="mt-3 space-y-1">
                    {warnings.map((msg, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-amber-700">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        {msg.message}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 text-sm">
                    Are you sure you want to submit with these variances? This action cannot be undone.
                  </p>
                </>
              ) : (
                <p>
                  You are about to submit this daily entry. Once submitted, it can only be reopened by an owner or accountant. Are you sure?
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={hasWarnings ? "bg-amber-600 hover:bg-amber-700" : ""}
          >
            {hasWarnings ? "Submit Anyway" : "Submit Entry"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
