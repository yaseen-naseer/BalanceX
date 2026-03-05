'use client'

import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export interface TodayBreakdown {
  consumer: { cash: number; transfer: number; credit: number; total: number }
  corporate: { cash: number; transfer: number; credit: number; total: number }
  totals: { cash: number; transfer: number; credit: number; grandTotal: number }
}

export interface TodayBreakdownTableProps {
  breakdown?: TodayBreakdown
  isLoading: boolean
}

export function TodayBreakdownTable({ breakdown, isLoading }: TodayBreakdownTableProps) {
  const formatAmount = (amount: number) => amount.toLocaleString()

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    )
  }

  if (!breakdown || breakdown.totals.grandTotal === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground py-8">No sales recorded today</div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[120px]"></TableHead>
          <TableHead className="text-right">Cash</TableHead>
          <TableHead className="text-right">Transfer</TableHead>
          <TableHead className="text-right">Credit</TableHead>
          <TableHead className="text-right font-semibold">Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell className="font-medium">Consumer</TableCell>
          <TableCell className="text-right font-mono">
            {formatAmount(breakdown.consumer.cash)}
          </TableCell>
          <TableCell className="text-right font-mono">
            {formatAmount(breakdown.consumer.transfer)}
          </TableCell>
          <TableCell className="text-right font-mono">
            {formatAmount(breakdown.consumer.credit)}
          </TableCell>
          <TableCell className="text-right font-mono font-semibold">
            {formatAmount(breakdown.consumer.total)}
          </TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="font-medium">Corporate</TableCell>
          <TableCell className="text-right font-mono">
            {formatAmount(breakdown.corporate.cash)}
          </TableCell>
          <TableCell className="text-right font-mono">
            {formatAmount(breakdown.corporate.transfer)}
          </TableCell>
          <TableCell className="text-right font-mono">
            {formatAmount(breakdown.corporate.credit)}
          </TableCell>
          <TableCell className="text-right font-mono font-semibold">
            {formatAmount(breakdown.corporate.total)}
          </TableCell>
        </TableRow>
        <TableRow className="bg-muted/50 font-semibold">
          <TableCell className="font-semibold">TOTAL</TableCell>
          <TableCell className="text-right font-mono">
            {formatAmount(breakdown.totals.cash)}
          </TableCell>
          <TableCell className="text-right font-mono">
            {formatAmount(breakdown.totals.transfer)}
          </TableCell>
          <TableCell className="text-right font-mono">
            {formatAmount(breakdown.totals.credit)}
          </TableCell>
          <TableCell className="text-right font-mono text-primary">
            {formatAmount(breakdown.totals.grandTotal)}
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  )
}
