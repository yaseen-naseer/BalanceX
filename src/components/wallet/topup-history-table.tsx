'use client'

import { Button } from '@/components/ui/button'
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
import { Wallet, Trash2 } from 'lucide-react'
import { format } from 'date-fns'

interface Topup {
  id: string
  date: string | Date
  source: 'CASH' | 'BANK'
  notes: string | null
  amount: number | { toString(): string }
}

export interface TopupHistoryTableProps {
  topups: Topup[]
  isLoading: boolean
  isSales: boolean
  onDelete: (id: string) => void
}

export function TopupHistoryTable({
  topups,
  isLoading,
  isSales,
  onDelete,
}: TopupHistoryTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  if (topups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Wallet className="mb-4 h-12 w-12 text-muted-foreground" />
        <h3 className="mb-2 text-lg font-medium">No top-ups recorded</h3>
        <p className="text-sm text-muted-foreground">
          Add a top-up to start tracking wallet balance
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Notes</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            {!isSales && <TableHead className="w-[50px]"></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {topups.map((topup) => (
            <TableRow key={topup.id}>
              <TableCell className="font-medium">
                {format(new Date(topup.date), 'dd MMM yyyy')}
              </TableCell>
              <TableCell>
                <Badge variant={topup.source === 'CASH' ? 'secondary' : 'outline'}>
                  {topup.source}
                </Badge>
              </TableCell>
              <TableCell className="max-w-[200px] truncate">
                {topup.notes || <span className="text-muted-foreground">-</span>}
              </TableCell>
              <TableCell className="text-right font-mono font-medium text-emerald-600">
                +{Number(topup.amount).toLocaleString()} MVR
              </TableCell>
              {!isSales && (
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(topup.id)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Delete topup"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
