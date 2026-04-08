'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { fmtCurrency } from '@/lib/constants'
import type { CreditCustomerWithBalance } from '@/types'

export interface CustomerInfoCardProps {
  customer: CreditCustomerWithBalance
  newAmount?: number
}

export function CustomerInfoCard({ customer, newAmount }: CustomerInfoCardProps) {
  const available = customer.creditLimit !== null
    ? customer.creditLimit - customer.outstandingBalance
    : null

  return (
    <div className="rounded-lg bg-muted p-3 space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Current Balance:</span>
        <span
          className={cn(
            'font-mono font-medium',
            customer.outstandingBalance > 0 ? 'text-amber-600' : ''
          )}
        >
          {fmtCurrency(customer.outstandingBalance)} MVR
        </span>
      </div>
      {customer.creditLimit !== null && (
        <>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Credit Limit:</span>
            <span className="font-mono">{fmtCurrency(customer.creditLimit)} MVR</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Available:</span>
            <span
              className={cn(
                'font-mono font-medium',
                available !== null && available <= 0 ? 'text-rose-600' : 'text-emerald-600'
              )}
            >
              {available != null ? fmtCurrency(available) : ''} MVR
            </span>
          </div>
        </>
      )}
      {customer.creditLimit === null && (
        <Badge variant="outline" className="text-xs">
          No credit limit
        </Badge>
      )}
      {newAmount !== undefined && newAmount > 0 && (
        <p className="text-xs text-muted-foreground pt-1 border-t">
          New balance will be:{' '}
          <span className="font-mono font-medium">
            {fmtCurrency(customer.outstandingBalance + newAmount)} MVR
          </span>
        </p>
      )}
    </div>
  )
}
