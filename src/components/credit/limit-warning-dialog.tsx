'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ShieldAlert, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface LimitWarningData {
  currentBalance: number
  newBalance: number
  limit: number
  exceededBy: number
  saleAmount: number
}

export interface LimitWarningDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: LimitWarningData | null
  isOwner: boolean
  onConfirm: () => void
}

export function LimitWarningDialog({
  open,
  onOpenChange,
  data,
  isOwner,
  onConfirm,
}: LimitWarningDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle
            className={cn(
              'flex items-center gap-2',
              isOwner ? 'text-amber-600' : 'text-rose-600'
            )}
          >
            {isOwner ? (
              <ShieldCheck className="h-5 w-5" />
            ) : (
              <ShieldAlert className="h-5 w-5" />
            )}
            Credit Limit Exceeded
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>This sale will exceed the customer&apos;s credit limit:</p>
              {data && (
                <div
                  className={cn(
                    'rounded-lg border p-3 space-y-1',
                    isOwner ? 'bg-amber-50 border-amber-200' : 'bg-rose-50 border-rose-200'
                  )}
                >
                  <div className="flex justify-between text-sm">
                    <span>Current Balance:</span>
                    <span className="font-mono">{data.currentBalance.toLocaleString()} MVR</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Sale Amount:</span>
                    <span className="font-mono">+{data.saleAmount.toLocaleString()} MVR</span>
                  </div>
                  <div
                    className={cn(
                      'flex justify-between text-sm font-medium border-t pt-1',
                      isOwner ? 'border-amber-200' : 'border-rose-200'
                    )}
                  >
                    <span>New Balance:</span>
                    <span
                      className={cn('font-mono', isOwner ? 'text-amber-700' : 'text-rose-700')}
                    >
                      {data.newBalance.toLocaleString()} MVR
                    </span>
                  </div>
                  <div className="flex justify-between text-sm text-rose-600">
                    <span>Credit Limit:</span>
                    <span className="font-mono">{data.limit.toLocaleString()} MVR</span>
                  </div>
                  <div className="flex justify-between text-sm text-rose-600 font-medium">
                    <span>Exceeds By:</span>
                    <span className="font-mono">{data.exceededBy.toLocaleString()} MVR</span>
                  </div>
                </div>
              )}
              {isOwner ? (
                <p className="text-sm">
                  As the Owner, you can approve this sale despite exceeding the credit limit.
                  This override will be recorded.
                </p>
              ) : (
                <div className="rounded-lg bg-rose-100 border border-rose-300 p-3">
                  <p className="text-sm text-rose-800 font-medium">Owner approval required</p>
                  <p className="text-sm text-rose-700 mt-1">
                    Only the Owner can approve sales that exceed credit limits. Please contact
                    the Owner to proceed with this sale.
                  </p>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          {isOwner && (
            <AlertDialogAction
              onClick={onConfirm}
              className="bg-amber-600 hover:bg-amber-700"
            >
              <ShieldCheck className="mr-2 h-4 w-4" />
              Override & Approve
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
