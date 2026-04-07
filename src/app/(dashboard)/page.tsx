'use client'

import { Header } from '@/components/layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DollarSign,
  CreditCard,
  Wallet,
  Landmark,
  Banknote,
  Plus,
  Upload,
  ArrowRight,
  AlertCircle,
} from 'lucide-react'
import Link from 'next/link'
import { useDashboard } from '@/hooks/use-dashboard'
import { CURRENCY_CODE } from '@/lib/constants'
import {
  StatCard,
  AlertsSection,
  TodayBreakdownTable,
  ActivityFeed,
} from '@/components/dashboard'

export default function DashboardPage() {
  const { data, isLoading, error } = useDashboard()
  const isLimitedView = data?.limitedView ?? false

  const formatCurrency = (amount: number | null | undefined) =>
    amount != null ? `${amount.toLocaleString()} ${CURRENCY_CODE}` : '—'

  return (
    <div className="flex flex-col">
      <Header
        title="Dashboard"
        subtitle={isLimitedView ? "Today's overview" : "Overview of your shop's finances"}
      />

      <div className="flex-1 space-y-6 p-6">
        {error && (
          <Card className="border-rose-200 bg-rose-50">
            <CardContent className="flex items-center gap-2 py-4">
              <AlertCircle className="h-4 w-4 text-rose-500" />
              <span className="text-sm text-rose-700">{error}</span>
            </CardContent>
          </Card>
        )}

        <div
          className={`grid gap-4 md:grid-cols-2 ${isLimitedView ? 'lg:grid-cols-2' : 'lg:grid-cols-4'}`}
        >
          <StatCard
            title="Today's Revenue"
            value={formatCurrency(data?.todayRevenue || 0)}
            icon={DollarSign}
            trend={
              !isLimitedView && data?.monthRevenueChange && data.monthRevenueChange > 0
                ? 'up'
                : !isLimitedView && data?.monthRevenueChange && data.monthRevenueChange < 0
                  ? 'down'
                  : 'neutral'
            }
            trendValue={
              !isLimitedView && data?.monthRevenueChange
                ? `${data.monthRevenueChange.toFixed(1)}%`
                : undefined
            }
            description={isLimitedView ? 'Sales today' : 'this month vs last'}
            isLoading={isLoading}
          />
          {!isLimitedView && (
            <StatCard
              title="Cash in Hand"
              value={formatCurrency(data?.cashInHand)}
              icon={Banknote}
              description={data?.cashInHand != null ? "Today's closing" : 'No entry today'}
              isLoading={isLoading}
            />
          )}
          {!isLimitedView && (
            <StatCard
              title="Bank Balance"
              value={formatCurrency(data?.bankBalance)}
              icon={Landmark}
              description="Current balance"
              isLoading={isLoading}
            />
          )}
          {!isLimitedView && (
            <StatCard
              title="Credit Outstanding"
              value={formatCurrency(data?.creditOutstanding)}
              icon={CreditCard}
              variant={data?.creditOutstanding && data.creditOutstanding > 10000 ? 'warning' : 'default'}
              description="Total receivables"
              isLoading={isLoading}
            />
          )}
          <StatCard
            title="Wallet Balance"
            value={formatCurrency(data?.walletBalance || 0)}
            icon={Wallet}
            description="Reload wallet"
            isLoading={isLoading}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>
                {isLimitedView ? 'Daily tasks' : 'Common tasks for daily operations'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button asChild className="w-full justify-start gap-2">
                <Link href="/daily-entry">
                  <Plus className="h-4 w-4" />
                  New Daily Entry
                  <ArrowRight className="ml-auto h-4 w-4" />
                </Link>
              </Button>
              {!isLimitedView && (
                <Button asChild variant="outline" className="w-full justify-start gap-2">
                  <Link href="/import">
                    <Upload className="h-4 w-4" />
                    Import Telco Report
                    <ArrowRight className="ml-auto h-4 w-4" />
                  </Link>
                </Button>
              )}
              <Button asChild variant="outline" className="w-full justify-start gap-2">
                <Link href="/credit">
                  <CreditCard className="h-4 w-4" />
                  {isLimitedView ? 'View Credit Customers' : 'Record Settlement'}
                  <ArrowRight className="ml-auto h-4 w-4" />
                </Link>
              </Button>
              {!isLimitedView && (
                <Button asChild variant="outline" className="w-full justify-start gap-2">
                  <Link href="/bank">
                    <Landmark className="h-4 w-4" />
                    Add Bank Transaction
                    <ArrowRight className="ml-auto h-4 w-4" />
                  </Link>
                </Button>
              )}
              <Button asChild variant="outline" className="w-full justify-start gap-2">
                <Link href="/wallet">
                  <Wallet className="h-4 w-4" />
                  View Wallet
                  <ArrowRight className="ml-auto h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Alerts</CardTitle>
                <CardDescription>Items requiring attention</CardDescription>
              </div>
              {data?.alerts && data.alerts.length > 0 && (
                <Badge variant="destructive">{data.alerts.length}</Badge>
              )}
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : (
                <AlertsSection alerts={data?.alerts || []} />
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s Breakdown</CardTitle>
            <CardDescription>Revenue by customer type and payment method</CardDescription>
          </CardHeader>
          <CardContent>
            <TodayBreakdownTable breakdown={data?.todayBreakdown} isLoading={isLoading} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Today&apos;s Activity</CardTitle>
              <CardDescription>
                {isLimitedView ? 'Your activity today' : 'Latest transactions and updates'}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <ActivityFeed items={data?.recentActivity || []} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
