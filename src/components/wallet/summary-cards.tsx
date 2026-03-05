'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export interface WalletSummaryCardsProps {
  totalTopupsThisMonth: number
  monthlyUsage: number
  currentBalance: number
  isLoading: boolean
}

export function WalletSummaryCards({
  totalTopupsThisMonth,
  monthlyUsage,
  currentBalance,
  isLoading,
}: WalletSummaryCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            This Month Top-ups
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <span className="text-2xl font-bold text-emerald-600">
              +{totalTopupsThisMonth.toLocaleString()} MVR
            </span>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            This Month Usage
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <span className="text-2xl font-bold text-rose-600">
              -{monthlyUsage.toLocaleString()} MVR
            </span>
          )}
          <p className="text-xs text-muted-foreground mt-1">Retail + Wholesale Reload Sales</p>
        </CardContent>
      </Card>
      <Card className="bg-primary text-primary-foreground">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium opacity-80">Current Balance</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-8 w-24 bg-primary-foreground/20" />
          ) : (
            <span className="text-2xl font-bold">{currentBalance.toLocaleString()} MVR</span>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
