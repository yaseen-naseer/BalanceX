'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { fmtCurrency } from '@/lib/constants'
import type { CreditCustomerWithBalance } from '@/types'

export interface CreditSummaryCardsProps {
  customers: CreditCustomerWithBalance[]
  isLoading: boolean
}

export function CreditSummaryCards({ customers, isLoading }: CreditSummaryCardsProps) {
  const totalOutstanding = customers.reduce((sum, c) => sum + c.outstandingBalance, 0)
  const consumerOutstanding = customers
    .filter((c) => c.type === 'CONSUMER')
    .reduce((sum, c) => sum + c.outstandingBalance, 0)
  const corporateOutstanding = customers
    .filter((c) => c.type === 'CORPORATE')
    .reduce((sum, c) => sum + c.outstandingBalance, 0)

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card className={totalOutstanding > 0 ? 'bg-rose-50 border-rose-200' : ''}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Outstanding
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <div
              className={cn(
                'text-2xl font-bold',
                totalOutstanding > 0 ? 'text-rose-600' : 'text-emerald-600'
              )}
            >
              {fmtCurrency(totalOutstanding)} MVR
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-1">{customers.length} customers</p>
        </CardContent>
      </Card>
      <Card className={consumerOutstanding > 0 ? 'bg-amber-50 border-amber-200' : ''}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Consumer Outstanding
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <div
              className={cn(
                'text-2xl font-bold',
                consumerOutstanding > 0 ? 'text-amber-600' : 'text-emerald-600'
              )}
            >
              {fmtCurrency(consumerOutstanding)} MVR
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            {customers.filter((c) => c.type === 'CONSUMER').length} consumers
          </p>
        </CardContent>
      </Card>
      <Card className={corporateOutstanding > 0 ? 'bg-blue-50 border-blue-200' : ''}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Corporate Outstanding
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <div
              className={cn(
                'text-2xl font-bold',
                corporateOutstanding > 0 ? 'text-blue-600' : 'text-emerald-600'
              )}
            >
              {fmtCurrency(corporateOutstanding)} MVR
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            {customers.filter((c) => c.type === 'CORPORATE').length} corporates
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
