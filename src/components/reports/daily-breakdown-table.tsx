'use client'

import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { CheckCircle2, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MonthlyReportData } from '@/hooks/use-reports'

export interface DailyBreakdownTableProps {
  data: MonthlyReportData | null
  isLoading: boolean
}

export function DailyBreakdownTable({ data, isLoading }: DailyBreakdownTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  if (!data || data.dailyBreakdown.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">No daily entries for this month</div>
    )
  }

  const totalSim = data.dailyBreakdown.reduce((sum, day) => sum + (day.simQuantity || 0), 0)
  const totalUsim = data.dailyBreakdown.reduce((sum, day) => sum + (day.usimQuantity || 0), 0)

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Cash</TableHead>
            <TableHead className="text-right">Transfer</TableHead>
            <TableHead className="text-right">Credit</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-center">SIM</TableHead>
            <TableHead className="text-center">USIM</TableHead>
            <TableHead className="text-right">Variance</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...data.dailyBreakdown].reverse().map((day) => (
            <TableRow key={day.date}>
              <TableCell>
                <div>
                  <span className="font-medium">{day.dateFormatted}</span>
                  <span className="text-muted-foreground ml-2 text-xs">{day.dayOfWeek}</span>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={day.status === 'SUBMITTED' ? 'default' : 'secondary'}>
                  {day.status === 'SUBMITTED' ? (
                    <>
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Submitted
                    </>
                  ) : (
                    <>
                      <Clock className="h-3 w-3 mr-1" /> Draft
                    </>
                  )}
                </Badge>
              </TableCell>
              <TableCell className="text-right font-mono text-emerald-600">
                {day.cashRevenue.toLocaleString()}
              </TableCell>
              <TableCell className="text-right font-mono text-blue-600">
                {day.transferRevenue.toLocaleString()}
              </TableCell>
              <TableCell className="text-right font-mono text-amber-600">
                {day.creditRevenue.toLocaleString()}
              </TableCell>
              <TableCell className="text-right font-mono font-semibold">
                {day.totalRevenue.toLocaleString()}
              </TableCell>
              <TableCell className="text-center font-mono">
                {day.simQuantity || <span className="text-muted-foreground">-</span>}
              </TableCell>
              <TableCell className="text-center font-mono">
                {day.usimQuantity || <span className="text-muted-foreground">-</span>}
              </TableCell>
              <TableCell
                className={cn(
                  'text-right font-mono',
                  day.cashVariance !== 0 &&
                    (Math.abs(day.cashVariance) > 500 ? 'text-rose-600' : 'text-amber-600')
                )}
              >
                {day.cashVariance !== 0 ? (
                  `${day.cashVariance > 0 ? '+' : ''}${day.cashVariance.toLocaleString()}`
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
            </TableRow>
          ))}
          <TableRow className="bg-muted/50 font-semibold">
            <TableCell colSpan={2}>Total</TableCell>
            <TableCell className="text-right font-mono text-emerald-600">
              {data.paymentMethodBreakdown.cash.amount.toLocaleString()}
            </TableCell>
            <TableCell className="text-right font-mono text-blue-600">
              {data.paymentMethodBreakdown.transfer.amount.toLocaleString()}
            </TableCell>
            <TableCell className="text-right font-mono text-amber-600">
              {data.paymentMethodBreakdown.credit.amount.toLocaleString()}
            </TableCell>
            <TableCell className="text-right font-mono">
              {data.summary.totalRevenue.toLocaleString()}
            </TableCell>
            <TableCell className="text-center font-mono">{totalSim || '-'}</TableCell>
            <TableCell className="text-center font-mono">{totalUsim || '-'}</TableCell>
            <TableCell
              className={cn(
                'text-right font-mono',
                data.summary.totalCashVariance !== 0 &&
                  (Math.abs(data.summary.totalCashVariance) > 500
                    ? 'text-rose-600'
                    : 'text-amber-600')
              )}
            >
              {data.summary.totalCashVariance !== 0
                ? `${data.summary.totalCashVariance > 0 ? '+' : ''}${data.summary.totalCashVariance.toLocaleString()}`
                : '-'}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  )
}
