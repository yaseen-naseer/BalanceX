'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { CheckCircle2, AlertTriangle, Users, Banknote, ArrowRightLeft, CreditCard } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MonthlyReportData } from '@/hooks/use-reports'

export interface BreakdownProps {
  data: MonthlyReportData | null
  isLoading: boolean
}

export function PaymentMethodBreakdown({ data, isLoading }: BreakdownProps) {
  if (isLoading || !data) {
    return <Skeleton className="h-48 w-full" />
  }

  const methods = [
    {
      key: 'cash',
      label: 'Cash',
      color: 'bg-emerald-500',
      icon: Banknote,
      ...data.paymentMethodBreakdown.cash,
    },
    {
      key: 'transfer',
      label: 'Transfer',
      color: 'bg-blue-500',
      icon: ArrowRightLeft,
      ...data.paymentMethodBreakdown.transfer,
    },
    {
      key: 'credit',
      label: 'Credit',
      color: 'bg-amber-500',
      icon: CreditCard,
      ...data.paymentMethodBreakdown.credit,
    },
  ]

  return (
    <div className="space-y-4">
      {methods.map((method) => (
        <div key={method.key} className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <method.icon className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{method.label}</span>
            </div>
            <div className="text-right">
              <span className="font-mono font-semibold">{method.amount.toLocaleString()} MVR</span>
              <span className="text-muted-foreground ml-2 text-sm">
                ({method.percentage.toFixed(1)}%)
              </span>
            </div>
          </div>
          <Progress value={method.percentage} className={cn('h-2', `[&>div]:${method.color}`)} />
        </div>
      ))}
    </div>
  )
}

export function CustomerTypeBreakdown({ data, isLoading }: BreakdownProps) {
  if (isLoading || !data) {
    return <Skeleton className="h-32 w-full" />
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4 text-blue-600" />
            <span className="font-medium">Consumer</span>
          </div>
          <div className="text-2xl font-bold text-blue-700">
            {data.customerTypeBreakdown.consumer.amount.toLocaleString()} MVR
          </div>
          <div className="text-sm text-blue-600">
            {data.customerTypeBreakdown.consumer.percentage.toFixed(1)}% of total
          </div>
        </CardContent>
      </Card>
      <Card className="bg-purple-50 border-purple-200">
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4 text-purple-600" />
            <span className="font-medium">Corporate</span>
          </div>
          <div className="text-2xl font-bold text-purple-700">
            {data.customerTypeBreakdown.corporate.amount.toLocaleString()} MVR
          </div>
          <div className="text-sm text-purple-600">
            {data.customerTypeBreakdown.corporate.percentage.toFixed(1)}% of total
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function CategoryBreakdown({ data, isLoading }: BreakdownProps) {
  if (isLoading || !data) {
    return <Skeleton className="h-48 w-full" />
  }

  if (data.categoryBreakdown.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">No category data</div>
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">Cash</TableHead>
            <TableHead className="text-right">Transfer</TableHead>
            <TableHead className="text-right">Credit</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">%</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.categoryBreakdown.map((cat) => (
            <TableRow key={cat.category}>
              <TableCell className="font-medium">
                {cat.categoryLabel}
                {cat.quantity > 0 && (
                  <span className="text-muted-foreground ml-2 text-xs">({cat.quantity} units)</span>
                )}
              </TableCell>
              <TableCell className="text-right font-mono">{cat.cash.toLocaleString()}</TableCell>
              <TableCell className="text-right font-mono">
                {cat.transfer.toLocaleString()}
              </TableCell>
              <TableCell className="text-right font-mono">{cat.credit.toLocaleString()}</TableCell>
              <TableCell className="text-right font-mono font-semibold">
                {cat.total.toLocaleString()}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {cat.percentage.toFixed(1)}%
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export function CreditAgingReport({ data, isLoading }: BreakdownProps) {
  if (isLoading || !data) {
    return <Skeleton className="h-48 w-full" />
  }

  const aging = data.creditAging
  const totalOutstanding =
    aging.current.amount + aging.days30.amount + aging.days60.amount + aging.days90Plus.amount

  if (totalOutstanding === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-emerald-500" />
        <p>No outstanding credit balances</p>
      </div>
    )
  }

  const buckets = [
    {
      label: 'Current (< 30 days)',
      data: aging.current,
      color: 'bg-emerald-100 border-emerald-300 text-emerald-700',
    },
    {
      label: '30-59 days overdue',
      data: aging.days30,
      color: 'bg-amber-100 border-amber-300 text-amber-700',
    },
    {
      label: '60-89 days overdue',
      data: aging.days60,
      color: 'bg-orange-100 border-orange-300 text-orange-700',
    },
    {
      label: '90+ days overdue',
      data: aging.days90Plus,
      color: 'bg-rose-100 border-rose-300 text-rose-700',
    },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {buckets.map((bucket) => (
          <Card key={bucket.label} className={bucket.color}>
            <CardContent className="pt-4">
              <div className="text-sm font-medium mb-1">{bucket.label}</div>
              <div className="text-xl font-bold">{bucket.data.amount.toLocaleString()} MVR</div>
              <div className="text-sm">{bucket.data.count} customers</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {(aging.days30.customers.length > 0 ||
        aging.days60.customers.length > 0 ||
        aging.days90Plus.customers.length > 0) && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-4 w-4" />
              Overdue Customers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                ...aging.days90Plus.customers,
                ...aging.days60.customers,
                ...aging.days30.customers,
              ]
                .slice(0, 5)
                .map((customer, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{customer.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono">{customer.amount.toLocaleString()} MVR</span>
                      {customer.days && (
                        <Badge variant="outline" className="text-xs">
                          {customer.days} days
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
