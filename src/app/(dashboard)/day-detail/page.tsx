'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  CalendarIcon,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  AlertTriangle,
} from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { useDailyEntry } from '@/hooks/use-daily-entry'
import { useAuth } from '@/hooks/use-auth'
import { useWallet } from '@/hooks/use-wallet'
import { useSystemStartDate } from '@/hooks/use-system-date'
import {
  calculateEntryTotals,
  ReconciliationCard,
  SalesBreakdown,
  ScreenshotSection,
  useScreenshotStatus,
  WalletTopupsSection,
  CreditSalesSection,
} from '@/components/day-detail'

export default function DayDetailPage() {
  const [currentDate, setCurrentDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const { entry, calculationData, isLoading, error, fetchEntry } = useDailyEntry({
    date: currentDate,
  })
  const { user, isOwner } = useAuth()
  const { getTopupsByDate, getTotalTopupsByDate } = useWallet()
  const { screenshotUploaded, screenshotVerified } = useScreenshotStatus(currentDate)

  const canUpload = user?.role === 'OWNER' || user?.role === 'ACCOUNTANT'
  const systemStartDate = useSystemStartDate()

  useEffect(() => {
    fetchEntry(currentDate)
  }, [currentDate, fetchEntry])

  const isSubmitted = entry?.status === 'SUBMITTED'
  const totals = entry ? calculateEntryTotals(entry) : null
  const dayTopups = getTopupsByDate(currentDate)
  const totalTopups = getTotalTopupsByDate(currentDate)

  const dayStatus = {
    entrySubmitted: isSubmitted,
    screenshotUploaded,
    screenshotVerified,
  }
  const isComplete =
    dayStatus.entrySubmitted && dayStatus.screenshotUploaded && dayStatus.screenshotVerified

  return (
    <div className="flex flex-col">
      <Header
        title="Day Detail"
        subtitle="View daily entry with telco screenshot verification"
      />

      <div className="flex-1 space-y-6 p-6">
        {/* Date Selector & Status */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  {format(new Date(currentDate), 'EEEE, dd MMMM yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={new Date(currentDate)}
                  onSelect={(date) => date && setCurrentDate(format(date, 'yyyy-MM-dd'))}
                  disabled={{ after: new Date(), ...(systemStartDate && { before: systemStartDate }) }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Status Badges */}
          <div className="flex gap-2">
            <Badge variant={dayStatus.entrySubmitted ? 'default' : 'secondary'}>
              {dayStatus.entrySubmitted ? (
                <>
                  <CheckCircle2 className="mr-1 h-3 w-3" /> Entry Submitted
                </>
              ) : (
                <>
                  <XCircle className="mr-1 h-3 w-3" /> Entry Pending
                </>
              )}
            </Badge>
            <Badge variant={dayStatus.screenshotUploaded ? 'default' : 'secondary'}>
              {dayStatus.screenshotUploaded ? (
                <>
                  <CheckCircle2 className="mr-1 h-3 w-3" /> Screenshot
                </>
              ) : (
                <>
                  <XCircle className="mr-1 h-3 w-3" /> No Screenshot
                </>
              )}
            </Badge>
            <Badge variant={dayStatus.screenshotVerified ? 'default' : 'secondary'}>
              {dayStatus.screenshotVerified ? (
                <>
                  <CheckCircle2 className="mr-1 h-3 w-3" /> Verified
                </>
              ) : (
                <>
                  <XCircle className="mr-1 h-3 w-3" /> Not Verified
                </>
              )}
            </Badge>
          </div>
        </div>

        {/* Completion Status */}
        <Card
          className={cn(
            'border-2',
            isComplete ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'
          )}
        >
          <CardContent className="flex items-center gap-3 py-4">
            {isComplete ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <span className="font-medium text-emerald-800">Day Complete</span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <span className="font-medium text-amber-800">
                  Incomplete: {!dayStatus.entrySubmitted && 'Entry not submitted. '}
                  {!dayStatus.screenshotUploaded && 'Screenshot required. '}
                  {dayStatus.screenshotUploaded &&
                    !dayStatus.screenshotVerified &&
                    'Verification pending.'}
                </span>
              </>
            )}
          </CardContent>
        </Card>

        {error && (
          <Card className="border-rose-200 bg-rose-50">
            <CardContent className="flex items-center gap-2 py-4">
              <AlertCircle className="h-4 w-4 text-rose-500" />
              <span className="text-sm text-rose-700">{error}</span>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
          </div>
        ) : !entry ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-medium">No entry for this date</h3>
              <p className="text-sm text-muted-foreground">
                Create a daily entry first before adding a screenshot
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Manual Entry Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Manual Entry Summary
                </CardTitle>
                <CardDescription>
                  Submitted by {entry.user.name}{' '}
                  {entry.submittedAt &&
                    `on ${format(new Date(entry.submittedAt), 'dd MMM yyyy, h:mm a')}`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {totals && <SalesBreakdown totals={totals} />}

                {/* Reconciliation */}
                {totals && (entry.cashDrawer || entry.wallet) && (
                  <ReconciliationCard
                    entry={entry}
                    totals={totals}
                    calculationData={calculationData}
                    walletTopupsTotal={totalTopups}
                  />
                )}

                {/* Notes */}
                {entry.notes?.content && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground">Notes</h4>
                    <div className="rounded-lg bg-muted p-3 text-sm">{entry.notes.content}</div>
                  </div>
                )}

                {/* Credit Sales */}
                {entry.creditSales && <CreditSalesSection creditSales={entry.creditSales} />}

                {/* Wallet Top-ups */}
                <WalletTopupsSection topups={dayTopups} totalTopups={totalTopups} />
              </CardContent>
            </Card>

            {/* Screenshot & Verification */}
            <ScreenshotSection
              currentDate={currentDate}
              canUpload={canUpload}
              isOwner={isOwner}
            />
          </div>
        )}
      </div>
    </div>
  )
}
