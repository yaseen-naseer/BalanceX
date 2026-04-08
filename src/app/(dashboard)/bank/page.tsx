'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/use-auth'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AlertCircle } from 'lucide-react'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { useBank } from '@/hooks/use-bank'
import { toast } from 'sonner'
import {
  AddTransactionDialog,
  BankSummaryCards,
  TransactionTable,
  type BankTransactionWithBalance,
} from '@/components/bank'

export default function BankLedgerPage() {
  const router = useRouter()
  const { isSales, isOwner, isLoading: authLoading } = useAuth()
  const {
    transactions,
    settings,
    currentBalance,
    isLoading,
    error,
    fetchTransactions,
    updateTransaction,
    deleteTransaction,
  } = useBank()

  const [typeFilter, setTypeFilter] = useState<'ALL' | 'DEPOSIT' | 'WITHDRAWAL'>('ALL')
  const [monthFilter, setMonthFilter] = useState<string>('current')

  useEffect(() => {
    if (!authLoading && isSales) {
      router.replace('/')
    }
  }, [authLoading, isSales, router])

  if (authLoading || isSales) {
    return (
      <div className="flex flex-col">
        <Header title="Bank Ledger" subtitle="Track bank deposits and withdrawals" />
        <div className="flex-1 p-6">
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <Skeleton className="h-8 w-48" />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const openingBalance = settings?.openingBalance || 0
  const today = new Date()

  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(today, i)
    return {
      value: i === 0 ? 'current' : format(date, 'yyyy-MM'),
      label: format(date, 'MMM yyyy'),
      start: startOfMonth(date),
      end: endOfMonth(date),
    }
  })

  const selectedMonth = monthOptions.find((m) => m.value === monthFilter) || monthOptions[0]
  const monthStart = selectedMonth.start
  const monthEnd = selectedMonth.end

  const currentMonthStart = startOfMonth(today)
  const currentMonthEnd = endOfMonth(today)
  const currentMonthTransactions = transactions.filter((t) => {
    const date = new Date(t.date)
    return date >= currentMonthStart && date <= currentMonthEnd
  })

  const monthDeposits = currentMonthTransactions
    .filter((t) => t.type === 'DEPOSIT')
    .reduce((sum, t) => sum + Number(t.amount), 0)
  const monthWithdrawals = currentMonthTransactions
    .filter((t) => t.type === 'WITHDRAWAL')
    .reduce((sum, t) => sum + Number(t.amount), 0)

  const handleUpdate = async (id: string, data: { reference?: string; notes?: string }) => {
    const result = await updateTransaction({ id, ...data })
    return result
  }

  const handleDelete = async (id: string) => {
    const result = await deleteTransaction(id)
    if (result.success) {
      toast.success('Transaction deleted')
    } else {
      toast.error(result.error || 'Failed to delete transaction')
    }
  }

  // Calculate running balance using reduce to avoid mutation during render
  const allTransactionsWithBalance: BankTransactionWithBalance[] = [...transactions]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .reduce((acc, t) => {
      const prevBalance = acc.length > 0 ? acc[acc.length - 1].balance : Number(openingBalance)
      const newBalance = t.type === 'DEPOSIT'
        ? prevBalance + Number(t.amount)
        : prevBalance - Number(t.amount)
      return [...acc, { ...t, balance: newBalance }]
    }, [] as BankTransactionWithBalance[])

  const transactionsWithBalance = allTransactionsWithBalance
    .filter((t) => {
      const date = new Date(t.date)
      if (date < monthStart || date > monthEnd) {
        return false
      }
      if (typeFilter !== 'ALL' && t.type !== typeFilter) {
        return false
      }
      return true
    })
    .reverse()

  return (
    <div className="flex flex-col">
      <Header title="Bank Ledger" subtitle="Track bank deposits and withdrawals" />

      <div className="flex-1 space-y-6 p-6">
        {error && (
          <Card className="border-rose-200 bg-rose-50">
            <CardContent className="flex items-center gap-2 py-4">
              <AlertCircle className="h-4 w-4 text-rose-500" />
              <span className="text-sm text-rose-700">{error}</span>
            </CardContent>
          </Card>
        )}

        <BankSummaryCards
          monthDeposits={monthDeposits}
          monthWithdrawals={monthWithdrawals}
          currentBalance={currentBalance}
          isLoading={isLoading}
        />

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Select
              value={typeFilter}
              onValueChange={(v) => setTypeFilter(v as 'ALL' | 'DEPOSIT' | 'WITHDRAWAL')}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Filter type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Types</SelectItem>
                <SelectItem value="DEPOSIT">Deposits</SelectItem>
                <SelectItem value="WITHDRAWAL">Withdrawals</SelectItem>
              </SelectContent>
            </Select>
            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((month) => (
                  <SelectItem key={month.value} value={month.value}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <AddTransactionDialog onAdd={fetchTransactions} />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
            <CardDescription>All bank transactions sorted by date</CardDescription>
          </CardHeader>
          <CardContent>
            <TransactionTable
              transactions={transactionsWithBalance}
              isLoading={isLoading}
              isOwner={isOwner}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
