'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowUpRight, ArrowDownRight } from 'lucide-react'

export interface BankSummaryCardsProps {
  monthDeposits: number
  monthWithdrawals: number
  currentBalance: number
  isLoading: boolean
}

export function BankSummaryCards({
  monthDeposits,
  monthWithdrawals,
  currentBalance,
  isLoading,
}: BankSummaryCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <ArrowDownRight className="h-4 w-4 text-emerald-500" />
            This Month Deposits
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <span className="text-2xl font-bold text-emerald-600">
              +{monthDeposits.toLocaleString()} MVR
            </span>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <ArrowUpRight className="h-4 w-4 text-rose-500" />
            This Month Withdrawals
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <span className="text-2xl font-bold text-rose-600">
              -{monthWithdrawals.toLocaleString()} MVR
            </span>
          )}
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
