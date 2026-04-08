'use client'

import { useState } from 'react'
import { useApiClient } from '@/hooks/use-api-client'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { FileText, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { fmtCurrency } from '@/lib/constants'
import type { CustomerWithTransactions } from './types'
import type { CreditCustomerWithBalance } from '@/types'

export interface LedgerDialogProps {
  customer: CreditCustomerWithBalance
  trigger: React.ReactNode
}

export function LedgerDialog({ customer, trigger }: LedgerDialogProps) {
  const api = useApiClient()
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [customerData, setCustomerData] = useState<CustomerWithTransactions | null>(null)

  const fetchLedger = async () => {
    setIsLoading(true)
    try {
      const result = await api.get<CustomerWithTransactions>(`/api/credit-customers/${customer.id}`)
      if (result.success && result.data) {
        setCustomerData(result.data)
      }
    } catch (error) {
      console.error('Error fetching ledger:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)
    if (isOpen) {
      fetchLedger()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Customer Ledger
          </DialogTitle>
          <DialogDescription>Transaction history for {customer.name}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : customerData ? (
          <div className="space-y-4">
            {/* Customer Summary */}
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg bg-muted p-3 text-center">
                <p className="text-xs text-muted-foreground">Credit Limit</p>
                <p className="font-mono font-semibold">
                  {customerData.creditLimit
                    ? `${fmtCurrency(customerData.creditLimit)} MVR`
                    : 'Unlimited'}
                </p>
              </div>
              <div className="rounded-lg bg-muted p-3 text-center">
                <p className="text-xs text-muted-foreground">Outstanding</p>
                <p
                  className={cn(
                    'font-mono font-semibold',
                    customerData.outstandingBalance > 0 ? 'text-rose-600' : 'text-emerald-600'
                  )}
                >
                  {fmtCurrency(customerData.outstandingBalance)} MVR
                </p>
              </div>
              <div className="rounded-lg bg-muted p-3 text-center">
                <p className="text-xs text-muted-foreground">Transactions</p>
                <p className="font-mono font-semibold">{customerData.transactions.length}</p>
              </div>
            </div>

            <Separator />

            {/* Transaction List */}
            {customerData.transactions.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">No transactions found</div>
            ) : (
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-2">
                  {customerData.transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className={cn(
                        'rounded-lg border p-3',
                        tx.type === 'CREDIT_SALE'
                          ? 'border-rose-100 bg-rose-50/50'
                          : 'border-emerald-100 bg-emerald-50/50'
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          {tx.type === 'CREDIT_SALE' ? (
                            <ArrowUpRight className="h-4 w-4 text-rose-600" />
                          ) : (
                            <ArrowDownRight className="h-4 w-4 text-emerald-600" />
                          )}
                          <div>
                            <p className="font-medium text-sm">
                              {tx.type === 'CREDIT_SALE' ? 'Credit Sale' : 'Settlement'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(tx.date), 'dd MMM yyyy')}
                              {tx.paymentMethod && ` • ${tx.paymentMethod}`}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p
                            className={cn(
                              'font-mono font-semibold',
                              tx.type === 'CREDIT_SALE' ? 'text-rose-600' : 'text-emerald-600'
                            )}
                          >
                            {tx.type === 'CREDIT_SALE' ? '+' : '-'}
                            {fmtCurrency(tx.amount)} MVR
                          </p>
                          <p className="text-xs text-muted-foreground font-mono">
                            Balance: {fmtCurrency(tx.balanceAfter)}
                          </p>
                        </div>
                      </div>
                      {(tx.reference || tx.notes) && (
                        <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
                          {tx.reference && <span>Ref: {tx.reference}</span>}
                          {tx.reference && tx.notes && <span> • </span>}
                          {tx.notes && <span>{tx.notes}</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
