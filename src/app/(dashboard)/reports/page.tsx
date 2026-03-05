'use client'

import { useState } from 'react'
import { Header } from '@/components/layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ChevronLeft, ChevronRight, DollarSign, CreditCard, BarChart3, Download, Calendar } from 'lucide-react'
import { format, subMonths, addMonths } from 'date-fns'
import { useReports, type MonthlyReportData } from '@/hooks/use-reports'
import {
  SummaryCard,
  DailyBreakdownTable,
  PaymentMethodBreakdown,
  CustomerTypeBreakdown,
  CategoryBreakdown,
  CreditAgingReport,
} from '@/components/reports'

function exportToCsv(data: MonthlyReportData) {
  const rows: string[] = []
  rows.push(`Monthly Report - ${data.monthLabel}`)
  rows.push('')

  rows.push('Summary')
  rows.push(`Total Revenue,${data.summary.totalRevenue}`)
  rows.push(`Daily Average,${data.summary.dailyAverage.toFixed(2)}`)
  rows.push(`Submitted Days,${data.summary.submittedDays}`)
  rows.push(`Draft Days,${data.summary.draftDays}`)
  rows.push(`Total Cash Variance,${data.summary.totalCashVariance}`)
  rows.push('')

  rows.push('Daily Breakdown')
  rows.push('Date,Status,Cash,Transfer,Credit,Total,SIM,USIM,Cash Variance')
  data.dailyBreakdown.forEach((day) => {
    rows.push(
      `${day.date},${day.status},${day.cashRevenue},${day.transferRevenue},${day.creditRevenue},${day.totalRevenue},${day.simQuantity || 0},${day.usimQuantity || 0},${day.cashVariance}`
    )
  })
  rows.push('')

  rows.push('Payment Method Breakdown')
  rows.push('Method,Amount,Percentage')
  rows.push(
    `Cash,${data.paymentMethodBreakdown.cash.amount},${data.paymentMethodBreakdown.cash.percentage.toFixed(1)}%`
  )
  rows.push(
    `Transfer,${data.paymentMethodBreakdown.transfer.amount},${data.paymentMethodBreakdown.transfer.percentage.toFixed(1)}%`
  )
  rows.push(
    `Credit,${data.paymentMethodBreakdown.credit.amount},${data.paymentMethodBreakdown.credit.percentage.toFixed(1)}%`
  )
  rows.push('')

  rows.push('Category Breakdown')
  rows.push('Category,Cash,Transfer,Credit,Total,Percentage')
  data.categoryBreakdown.forEach((cat) => {
    rows.push(
      `${cat.categoryLabel},${cat.cash},${cat.transfer},${cat.credit},${cat.total},${cat.percentage.toFixed(1)}%`
    )
  })

  const csvContent = rows.join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `report-${data.month}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export default function ReportsPage() {
  const [currentMonth, setCurrentMonth] = useState(format(new Date(), 'yyyy-MM'))
  const { data, isLoading, error, fetchReport } = useReports(currentMonth)

  const handlePrevMonth = () => {
    const prev = format(subMonths(new Date(currentMonth + '-01'), 1), 'yyyy-MM')
    setCurrentMonth(prev)
    fetchReport(prev)
  }

  const handleNextMonth = () => {
    const next = format(addMonths(new Date(currentMonth + '-01'), 1), 'yyyy-MM')
    setCurrentMonth(next)
    fetchReport(next)
  }

  const handleExport = () => {
    if (data) exportToCsv(data)
  }

  const totalCredit =
    (data?.creditAging?.current?.amount || 0) +
    (data?.creditAging?.days30?.amount || 0) +
    (data?.creditAging?.days60?.amount || 0) +
    (data?.creditAging?.days90Plus?.amount || 0)

  const creditCustomers =
    (data?.creditAging?.current?.count || 0) +
    (data?.creditAging?.days30?.count || 0) +
    (data?.creditAging?.days60?.count || 0) +
    (data?.creditAging?.days90Plus?.count || 0)

  const creditVariant =
    (data?.creditAging?.days60?.amount || 0) + (data?.creditAging?.days90Plus?.amount || 0) > 0
      ? 'danger'
      : (data?.creditAging?.days30?.amount || 0) > 0
        ? 'warning'
        : 'default'

  return (
    <div className="flex flex-col">
      <Header title="Monthly Report" subtitle="Revenue summary and trends" />

      <div className="flex-1 space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handlePrevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-xl font-semibold min-w-[180px] text-center">
              {data?.monthLabel || format(new Date(currentMonth + '-01'), 'MMMM yyyy')}
            </h2>
            <Button variant="outline" size="icon" onClick={handleNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" onClick={handleExport} disabled={!data}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>

        {error && (
          <Card className="border-rose-200 bg-rose-50">
            <CardContent className="py-4">
              <p className="text-rose-700">{error}</p>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            title="Total Revenue"
            value={`${(data?.summary.totalRevenue || 0).toLocaleString()} MVR`}
            subtitle={`${data?.summary.submittedDays || 0} days recorded`}
            icon={DollarSign}
            isLoading={isLoading}
          />
          <SummaryCard
            title="Daily Average"
            value={`${Math.round(data?.summary.dailyAverage || 0).toLocaleString()} MVR`}
            subtitle="Per working day"
            icon={BarChart3}
            isLoading={isLoading}
          />
          <SummaryCard
            title="Entry Status"
            value={`${data?.summary.submittedDays || 0} / ${(data?.summary.submittedDays || 0) + (data?.summary.draftDays || 0)}`}
            subtitle={`${data?.summary.draftDays || 0} drafts pending`}
            icon={Calendar}
            variant={data?.summary.draftDays ? 'warning' : 'success'}
            isLoading={isLoading}
          />
          <SummaryCard
            title="Credit Outstanding"
            value={`${totalCredit.toLocaleString()} MVR`}
            subtitle={`${creditCustomers} customers with balance`}
            icon={CreditCard}
            variant={creditVariant as 'default' | 'success' | 'warning' | 'danger'}
            isLoading={isLoading}
          />
        </div>

        <Tabs defaultValue="daily" className="space-y-4">
          <TabsList>
            <TabsTrigger value="daily">Daily Breakdown</TabsTrigger>
            <TabsTrigger value="payment">By Payment Method</TabsTrigger>
            <TabsTrigger value="category">By Category</TabsTrigger>
            <TabsTrigger value="credit">Credit Aging</TabsTrigger>
          </TabsList>

          <TabsContent value="daily">
            <Card>
              <CardHeader>
                <CardTitle>Daily Breakdown</CardTitle>
                <CardDescription>Revenue and variance for each day of the month</CardDescription>
              </CardHeader>
              <CardContent>
                <DailyBreakdownTable data={data} isLoading={isLoading} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payment">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Revenue by Payment Method</CardTitle>
                  <CardDescription>
                    Breakdown of cash, transfer, and credit payments
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <PaymentMethodBreakdown data={data} isLoading={isLoading} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Revenue by Customer Type</CardTitle>
                  <CardDescription>Consumer vs corporate sales</CardDescription>
                </CardHeader>
                <CardContent>
                  <CustomerTypeBreakdown data={data} isLoading={isLoading} />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="category">
            <Card>
              <CardHeader>
                <CardTitle>Revenue by Category</CardTitle>
                <CardDescription>Breakdown by product/service category</CardDescription>
              </CardHeader>
              <CardContent>
                <CategoryBreakdown data={data} isLoading={isLoading} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="credit">
            <Card>
              <CardHeader>
                <CardTitle>Credit Aging Report</CardTitle>
                <CardDescription>Outstanding balances by age (30/60/90+ days)</CardDescription>
              </CardHeader>
              <CardContent>
                <CreditAgingReport data={data} isLoading={isLoading} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
