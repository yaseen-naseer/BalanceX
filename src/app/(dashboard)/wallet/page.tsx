'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useApiClient } from '@/hooks/use-api-client'
import { Header } from '@/components/layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { AlertCircle, Eye, ChevronLeft, ChevronRight, ArrowUpCircle, ArrowDownCircle, Wallet } from 'lucide-react'
import { stripRetailGst } from '@/lib/utils/balance'
import { format, startOfMonth, endOfMonth, addMonths, subMonths, isSameMonth } from 'date-fns'
import { useWallet } from '@/hooks/use-wallet'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { CURRENCY_CODE, fmtCurrency } from '@/lib/constants'
import { AddTopupDialog, WalletSummaryCards } from '@/components/wallet'
import type { DailyEntryWithRelations } from '@/types'

interface ActivityRow {
  date: string
  type: 'topup' | 'reload'
  amount: number
  label: string
  notes?: string | null
  source?: string
}

export default function WalletPage() {
  const api = useApiClient()
  const { isSales } = useAuth()
  const [selectedMonth, setSelectedMonth] = useState(new Date())
  const [monthEntries, setMonthEntries] = useState<DailyEntryWithRelations[]>([])
  const [loadingEntries, setLoadingEntries] = useState(false)
  // Wholesale reload totals per entry (wallet cost = line item amount, not category grid cash)
  const [wholesaleReloadByEntry, setWholesaleReloadByEntry] = useState<Record<string, number>>({})

  const {
    topups,
    currentBalance,
    monthlyUsage,
    isLoading,
    error,
    fetchWallet,
    deleteTopup,
  } = useWallet()

  const today = new Date()
  const isCurrentMonth = isSameMonth(selectedMonth, today)

  // Fetch daily entries for the selected month to get reload sales
  const fetchMonthEntries = useCallback(async (month: Date) => {
    setLoadingEntries(true)
    try {
      const monthStr = format(month, 'yyyy-MM')
      const result = await api.get<DailyEntryWithRelations[]>('/api/daily-entries', {
        params: { month: monthStr, limit: 31 },
      })
      if (result.success && result.data) {
        setMonthEntries(result.data)

        const entryIds = result.data.map((e) => e.id)
        if (entryIds.length > 0) {
          const reloadMap: Record<string, number> = {}
          await Promise.all(
            entryIds.map(async (eid) => {
              const liResult = await api.get<Array<{ category: string; amount: number; cashAmount: number | null }>>('/api/sale-line-items', {
                params: { dailyEntryId: eid },
              })
              if (liResult.success && liResult.data) {
                const wholesaleTotal = liResult.data
                  .filter((li) => li.category === 'WHOLESALE_RELOAD')
                  .reduce((sum, li) => sum + Number(li.amount), 0)
                if (wholesaleTotal > 0) {
                  reloadMap[eid] = wholesaleTotal
                }
              }
            })
          )
          setWholesaleReloadByEntry(reloadMap)
        } else {
          setWholesaleReloadByEntry({})
        }
      }
    } catch {
      // silently fail — reload sales just won't show
    } finally {
      setLoadingEntries(false)
    }
  }, [api])

  useEffect(() => {
    fetchMonthEntries(selectedMonth)
  }, [selectedMonth, fetchMonthEntries])

  // Filter topups for selected month
  const monthTopups = useMemo(() => {
    const start = startOfMonth(selectedMonth)
    const end = endOfMonth(selectedMonth)
    return topups.filter((t) => {
      const d = new Date(t.date)
      return d >= start && d <= end
    })
  }, [topups, selectedMonth])

  const totalTopupsThisMonth = monthTopups.reduce((sum, t) => sum + Number(t.amount), 0)

  // Calculate total reload sales for selected month from daily entries
  const totalReloadSalesThisMonth = useMemo(() => {
    return monthEntries.reduce((sum, entry) => {
      let reloadTotal = 0
      for (const cat of (entry.categories ?? [])) {
        if (cat.category === 'RETAIL_RELOAD') {
          reloadTotal += stripRetailGst(Number(cat.consumerCash) + Number(cat.consumerTransfer))
        }
        // Wholesale: category grid has cash received, skip it here
      }
      // Wholesale wallet cost from line items
      reloadTotal += wholesaleReloadByEntry[entry.id] ?? 0
      return sum + reloadTotal
    }, 0)
  }, [monthEntries, wholesaleReloadByEntry])

  // Build unified activity list: topups + reload sales per day, sorted by date desc
  const activityRows = useMemo((): ActivityRow[] => {
    const rows: ActivityRow[] = []

    // Add topups
    monthTopups.forEach((t) => {
      rows.push({
        date: format(new Date(t.date), 'yyyy-MM-dd'),
        type: 'topup',
        amount: Number(t.amount),
        label: `Top-up (${t.source})`,
        notes: t.notes,
        source: t.source,
      })
    })

    // Add reload sales per day from daily entries
    monthEntries.forEach((entry) => {
      let reloadTotal = 0
      for (const cat of (entry.categories ?? [])) {
        if (cat.category === 'RETAIL_RELOAD') {
          reloadTotal += stripRetailGst(Number(cat.consumerCash) + Number(cat.consumerTransfer))
        }
        // Wholesale: category grid has cash received, use line item data instead
      }
      reloadTotal += wholesaleReloadByEntry[entry.id] ?? 0

      if (reloadTotal > 0) {
        const dateStr = format(new Date(entry.date), 'yyyy-MM-dd')
        rows.push({
          date: dateStr,
          type: 'reload',
          amount: reloadTotal,
          label: 'Reload Sales',
        })
      }
    })

    return rows.sort((a, b) => b.date.localeCompare(a.date))
  }, [monthTopups, monthEntries, wholesaleReloadByEntry])

  const handleDelete = async (id: string) => {
    const result = await deleteTopup(id)
    if (result) {
      toast.success('Top-up deleted')
    }
  }

  const isLoaded = !isLoading && !loadingEntries

  return (
    <div className="flex flex-col">
      <Header
        title="Reload Wallet"
        subtitle={isSales ? 'View wallet balance (read-only)' : 'Track wallet balance and top-ups'}
      />

      <div className="flex-1 space-y-6 p-6">
        {isSales && (
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="flex items-center gap-2 py-4">
              <Eye className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-blue-700">
                View-only mode. Contact Owner or Accountant to add top-ups.
              </span>
            </CardContent>
          </Card>
        )}

        {error && (
          <Card className="border-rose-200 bg-rose-50">
            <CardContent className="flex items-center gap-2 py-4">
              <AlertCircle className="h-4 w-4 text-rose-500" />
              <span className="text-sm text-rose-700">{error}</span>
            </CardContent>
          </Card>
        )}

        <WalletSummaryCards
          totalTopupsThisMonth={totalTopupsThisMonth}
          monthlyUsage={monthlyUsage}
          currentBalance={currentBalance}
          isLoading={isLoading}
        />

        {/* Month Activity */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Wallet Activity</CardTitle>
                <CardDescription>
                  Top-ups and reload sales for{' '}
                  <span className="font-medium">{format(selectedMonth, 'MMMM yyyy')}</span>
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {/* Month navigation */}
                <div className="flex items-center gap-1 rounded-md border bg-background px-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setSelectedMonth((m) => subMonths(m, 1))}
                    aria-label="Previous month"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="min-w-[100px] text-center text-sm font-medium">
                    {format(selectedMonth, 'MMM yyyy')}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setSelectedMonth((m) => addMonths(m, 1))}
                    disabled={isCurrentMonth}
                    aria-label="Next month"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                {!isCurrentMonth && (
                  <Button variant="outline" size="sm" onClick={() => setSelectedMonth(today)}>
                    Current
                  </Button>
                )}
                {!isSales && (
                  <AddTopupDialog
                    defaultDate={format(selectedMonth, 'yyyy-MM') + '-01'}
                    onAdd={fetchWallet}
                  />
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Month summary row */}
            {isLoaded && (
              <div className="grid grid-cols-3 gap-4 rounded-lg bg-muted/50 p-4">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Top-ups</p>
                  <p className="font-mono font-semibold text-emerald-600">
                    +{fmtCurrency(totalTopupsThisMonth)}
                  </p>
                  <p className="text-xs text-muted-foreground">{monthTopups.length} transaction{monthTopups.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Reload Sales</p>
                  <p className="font-mono font-semibold text-rose-600">
                    -{fmtCurrency(totalReloadSalesThisMonth)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {monthEntries.filter(e => e.categories?.some(c =>
                      (c.category === 'RETAIL_RELOAD' || c.category === 'WHOLESALE_RELOAD') &&
                      (Number(c.consumerCash) + Number(c.consumerTransfer)) > 0
                    )).length} day{monthEntries.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Net Change</p>
                  <p className={cn(
                    'font-mono font-semibold',
                    totalTopupsThisMonth - totalReloadSalesThisMonth >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  )}>
                    {totalTopupsThisMonth - totalReloadSalesThisMonth >= 0 ? '+' : ''}
                    {fmtCurrency(totalTopupsThisMonth - totalReloadSalesThisMonth)}
                  </p>
                  <p className="text-xs text-muted-foreground">MVR</p>
                </div>
              </div>
            )}

            <Separator />

            {/* Activity table */}
            {!isLoaded ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : activityRows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Wallet className="mb-4 h-12 w-12 text-muted-foreground opacity-30" />
                <p className="text-sm text-muted-foreground">No wallet activity for {format(selectedMonth, 'MMMM yyyy')}</p>
              </div>
            ) : (
              <div className="space-y-1">
                {activityRows.map((row, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      {row.type === 'topup' ? (
                        <ArrowUpCircle className="h-5 w-5 shrink-0 text-emerald-500" />
                      ) : (
                        <ArrowDownCircle className="h-5 w-5 shrink-0 text-rose-500" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{row.label}</p>
                          {row.source && (
                            <Badge variant="outline" className="text-xs px-1.5 py-0">
                              {row.source}
                            </Badge>
                          )}
                        </div>
                        {row.notes && (
                          <p className="text-xs text-muted-foreground">{row.notes}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn(
                        'font-mono font-semibold text-sm',
                        row.type === 'topup' ? 'text-emerald-600' : 'text-rose-600'
                      )}>
                        {row.type === 'topup' ? '+' : '-'}{fmtCurrency(row.amount)} {CURRENCY_CODE}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(row.date + 'T12:00:00'), 'dd MMM')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
