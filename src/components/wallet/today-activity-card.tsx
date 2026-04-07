'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Wallet, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { WALLET_VARIANCE_THRESHOLD } from '@/lib/constants'
import type { DailyEntryWithRelations } from '@/types'

export interface TodayActivityCardProps {
  todayEntry: DailyEntryWithRelations | null
  todayTopups: number
  todayTopupsCount: number
  todayReloadSales: number
  isLoading: boolean
}

export function TodayActivityCard({
  todayEntry,
  todayTopups,
  todayTopupsCount,
  todayReloadSales,
  isLoading,
}: TodayActivityCardProps) {
  const today = new Date()

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Today&apos;s Wallet Activity</CardTitle>
        <CardDescription>{format(today, 'EEEE, dd MMMM yyyy')}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        ) : !todayEntry?.wallet ? (
          <div className="text-center py-6 text-muted-foreground">
            <Wallet className="mx-auto h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">No wallet data for today</p>
            <p className="text-xs mt-1">Complete today&apos;s daily entry to see wallet activity</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Opening Balance</span>
              <div className="text-right">
                <span className="font-mono font-medium">
                  {Number(todayEntry.wallet.opening).toLocaleString()}
                </span>
                <span className="text-xs text-muted-foreground ml-2">
                  ({todayEntry.wallet.openingSource.replace(/_/g, ' ').toLowerCase()})
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">+ Top-ups</span>
              <div className="text-right">
                <span className="font-mono font-medium text-emerald-600">
                  +{todayTopups.toLocaleString()}
                </span>
                {todayTopupsCount > 0 && (
                  <span className="text-xs text-muted-foreground ml-2">
                    ({todayTopupsCount} top-up{todayTopupsCount > 1 ? 's' : ''})
                  </span>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">- Reload Sales</span>
              <div className="text-right">
                <span className="font-mono font-medium text-rose-600">
                  -{todayReloadSales.toLocaleString()}
                </span>
                <span className="text-xs text-muted-foreground ml-2">(from daily entry)</span>
              </div>
            </div>

            <Separator />

            <div className="flex justify-between items-center text-sm">
              <span className="font-medium">Expected Closing</span>
              <span className="font-mono font-semibold">
                {Number(todayEntry.wallet.closingExpected).toLocaleString()}
              </span>
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="font-medium">Actual Closing</span>
              <div className="text-right">
                <span className="font-mono font-semibold">
                  {Number(todayEntry.wallet.closingActual).toLocaleString()}
                </span>
                <span className="text-xs text-muted-foreground ml-2">(from daily entry)</span>
              </div>
            </div>

            <Separator />

            <div
              className={cn(
                'flex justify-between items-center p-2 rounded-lg',
                todayEntry.wallet.variance === 0
                  ? 'bg-emerald-50'
                  : Math.abs(Number(todayEntry.wallet.variance)) > WALLET_VARIANCE_THRESHOLD
                    ? 'bg-rose-50'
                    : 'bg-amber-50'
              )}
            >
              <div className="flex items-center gap-2">
                {todayEntry.wallet.variance === 0 ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <AlertTriangle
                    className={cn(
                      'h-4 w-4',
                      Math.abs(Number(todayEntry.wallet.variance)) > WALLET_VARIANCE_THRESHOLD
                        ? 'text-rose-600'
                        : 'text-amber-600'
                    )}
                  />
                )}
                <span className="font-medium text-sm">Variance</span>
              </div>
              <span
                className={cn(
                  'font-mono font-bold',
                  todayEntry.wallet.variance === 0
                    ? 'text-emerald-600'
                    : Number(todayEntry.wallet.variance) > 0
                      ? 'text-emerald-600'
                      : 'text-rose-600'
                )}
              >
                {Number(todayEntry.wallet.variance) > 0 ? '+' : ''}
                {Number(todayEntry.wallet.variance).toLocaleString()} MVR
                {Number(todayEntry.wallet.variance) !== 0 && ' \u26a0\ufe0f'}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
