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
import { Landmark, Trash2, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { EditTransactionDialog } from './edit-transaction-dialog'
import type { BankTransactionWithBalance } from './types'

export interface TransactionTableProps {
  transactions: BankTransactionWithBalance[]
  isLoading: boolean
  isOwner: boolean
  onUpdate: (id: string, data: { reference?: string; notes?: string }) => Promise<unknown>
  onDelete: (id: string) => void
}

export function TransactionTable({
  transactions,
  isLoading,
  isOwner,
  onUpdate,
  onDelete,
}: TransactionTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Landmark className="mb-4 h-12 w-12 text-muted-foreground" />
        <h3 className="mb-2 text-lg font-medium">No transactions yet</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Start by setting your opening balance and adding transactions
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
            <TableHead>Type</TableHead>
            <TableHead>Reference</TableHead>
            <TableHead>Notes</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-right">Balance</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((transaction) => (
            <TableRow key={transaction.id}>
              <TableCell className="font-medium">
                {format(new Date(transaction.date), 'dd MMM yyyy')}
              </TableCell>
              <TableCell>
                <Badge
                  variant={transaction.type === 'DEPOSIT' ? 'default' : 'destructive'}
                  className={transaction.type === 'DEPOSIT' ? 'bg-emerald-600' : ''}
                >
                  {transaction.type === 'DEPOSIT' ? (
                    <>
                      <ArrowDownRight className="mr-1 h-3 w-3" /> Deposit
                    </>
                  ) : (
                    <>
                      <ArrowUpRight className="mr-1 h-3 w-3" /> Withdrawal
                    </>
                  )}
                </Badge>
              </TableCell>
              <TableCell>
                {transaction.reference || <span className="text-muted-foreground">-</span>}
              </TableCell>
              <TableCell className="max-w-[200px] truncate">
                {transaction.notes || <span className="text-muted-foreground">-</span>}
              </TableCell>
              <TableCell
                className={cn(
                  'text-right font-mono font-medium',
                  transaction.type === 'DEPOSIT' ? 'text-emerald-600' : 'text-rose-600'
                )}
              >
                {transaction.type === 'DEPOSIT' ? '+' : '-'}
                {Number(transaction.amount).toLocaleString()}
              </TableCell>
              <TableCell className="text-right font-mono">
                {transaction.balance.toLocaleString()}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <EditTransactionDialog transaction={transaction} onUpdate={onUpdate} />
                  {isOwner && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(transaction.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
