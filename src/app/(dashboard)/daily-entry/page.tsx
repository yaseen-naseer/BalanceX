'use client'

import { useState, useMemo } from 'react'
import { Header } from '@/components/layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  CalendarIcon,
  Save,
  Send,
  AlertCircle,
  CheckCircle2,
  Lock,
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useWholesaleCustomers } from '@/hooks/use-wholesale-customers'
import { canReopenDailyEntry } from '@/lib/permissions'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { useDailyEntryForm, type ValidationMessage } from '@/hooks/use-daily-entry-form'
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes'
import { registerDirtyGuard } from '@/lib/dirty-guard'
import { useEffect } from 'react'
import { toast } from 'sonner'

// Extracted components
import {
  CategoryTable,
  CashDrawerSection,
  WalletSection,
  CreditSalesSection,
  SaleItemsSection,
  SubmissionDialog,
  DailySummaryBar,
  ReopenDialog,
  AmendmentHistory,
} from '@/components/daily-entry'
import { PresenceBanner } from '@/components/daily-entry/presence-banner'
import { DailyEntryProvider } from '@/contexts/daily-entry-context'

export default function DailyEntryPage() {
  const [currentDate, setCurrentDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [initialDateResolved, setInitialDateResolved] = useState(false)
  const [showVarianceWarning, setShowVarianceWarning] = useState(false)
  const [varianceMessages, setVarianceMessages] = useState<ValidationMessage[]>([])

  const { user } = useAuth()

  // On mount: check if yesterday has an unsubmitted entry — if so, stay on yesterday
  useEffect(() => {
    if (initialDateResolved) return
    const today = format(new Date(), 'yyyy-MM-dd')
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = format(yesterday, 'yyyy-MM-dd')

    fetch(`/api/daily-entries/${yesterdayStr}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data && data.data.status !== 'SUBMITTED') {
          setCurrentDate(yesterdayStr)
        }
      })
      .catch(() => {})
      .finally(() => setInitialDateResolved(true))
  }, [initialDateResolved])

  // Use the extracted form hook
  const form = useDailyEntryForm({ date: currentDate })
  const wholesale = useWholesaleCustomers()

  // Guard unsaved changes on navigation and date changes
  const { showDialog: showUnsavedDialog, guard, handleLeave, handleSaveAndLeave, handleStay } =
    useUnsavedChanges(form.isDirty, form.saveDraft)

  // Register save function for idle-timeout auto-save
  useEffect(() => {
    if (!form.isDirty) return
    return registerDirtyGuard(form.saveDraft)
  }, [form.isDirty, form.saveDraft])

  const handleDateChange = (date: string) => {
    guard(() => setCurrentDate(date))
  }

  // Check if current user can reopen
  const canReopen = useMemo(() => {
    if (!user?.role) return false
    return canReopenDailyEntry(user.role, new Date(currentDate))
  }, [user, currentDate])

  // Get subtitle based on state
  const subtitle = useMemo(() => {
    if (form.isSubmitted) return 'Viewing submitted entry'
    if (!form.editPermission.canEdit) return form.editPermission.reason || 'View only'
    return "Enter today's sales data"
  }, [form.isSubmitted, form.editPermission])

  // Handle reopen entry
  const handleReopen = async (reason: string): Promise<boolean> => {
    const success = await form.reopenEntry(reason)
    if (success) {
      toast.success('Entry reopened as draft')
    } else {
      toast.error('Failed to reopen entry')
    }
    return success
  }

  // Handle save draft
  const handleSaveDraft = async () => {
    const success = await form.saveDraft()
    if (success) {
      toast.success('Draft saved')
    } else {
      toast.error('Failed to save draft')
    }
  }

  // Handle submit click
  const handleSubmitClick = () => {
    const validation = form.validateBeforeSubmit()

    if (!validation.canSubmit) {
      toast.error('Cannot submit: Validation failed', {
        description: validation.messages.map((m) => m.message).join('\n'),
      })
      return
    }

    // Always show confirmation dialog before submitting
    setVarianceMessages(validation.messages)
    setShowVarianceWarning(true)
  }

  // Handle actual submission
  const handleSubmit = async (acknowledgeWarnings: boolean = false) => {
    setShowVarianceWarning(false)

    const result = await form.submitEntry(acknowledgeWarnings)

    if (result.success) {
      toast.success('Daily entry submitted successfully!')
    } else if (result.requiresConfirmation && result.messages) {
      setVarianceMessages(result.messages)
      setShowVarianceWarning(true)
    } else if (result.messages) {
      toast.error('Cannot submit: Validation failed', {
        description: result.messages.map((m) => m.message).join('\n'),
      })
    } else {
      toast.error('Failed to submit entry')
    }
  }

  return (
    <DailyEntryProvider form={form} wholesale={wholesale}>
    <div className="flex flex-col">
      <Header title="Daily Sales Entry" subtitle={subtitle} />

      <div className="flex-1 space-y-6 p-6">
        {/* Permission restriction banner */}
        {!form.editPermission.canEdit && !form.isSubmitted && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="flex items-center gap-2 py-4">
              <Lock className="h-4 w-4 text-amber-600" />
              <span className="text-sm text-amber-800 font-medium">
                {form.editPermission.reason || 'You do not have permission to edit this entry'}
              </span>
            </CardContent>
          </Card>
        )}

        {/* Error banner */}
        {form.error && (
          <Card className="border-rose-200 bg-rose-50">
            <CardContent className="flex items-center gap-2 py-4">
              <AlertCircle className="h-4 w-4 text-rose-500" />
              <span className="text-sm text-rose-700">{form.error}</span>
            </CardContent>
          </Card>
        )}

        {/* Active editors banner */}
        <PresenceBanner editors={form.activeEditors} />

        {/* Date Selector & Status */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Quick Navigation Buttons */}
            <div className="flex items-center gap-1">
              <Button
                variant={currentDate === format(new Date(), 'yyyy-MM-dd') ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleDateChange(format(new Date(), 'yyyy-MM-dd'))}
              >
                Today
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const yesterday = new Date()
                  yesterday.setDate(yesterday.getDate() - 1)
                  handleDateChange(format(yesterday, 'yyyy-MM-dd'))
                }}
              >
                Yesterday
              </Button>
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'gap-2',
                    currentDate === format(new Date(), 'yyyy-MM-dd') && 'border-primary'
                  )}
                >
                  <CalendarIcon className="h-4 w-4" />
                  {format(new Date(currentDate), 'EEEE, dd MMMM yyyy')}
                  {currentDate === format(new Date(), 'yyyy-MM-dd') && (
                    <Badge variant="secondary" className="ml-1 text-xs">
                      Today
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={new Date(currentDate)}
                  onSelect={(date) => date && handleDateChange(format(date, 'yyyy-MM-dd'))}
                  disabled={{ after: new Date() }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {form.isLoading ? (
              <Skeleton className="h-6 w-20" />
            ) : (
              <>
                <Badge variant={form.isSubmitted ? 'default' : 'secondary'}>
                  {form.isSubmitted ? (
                    <>
                      <CheckCircle2 className="mr-1 h-3 w-3" /> Submitted
                    </>
                  ) : (
                    'Draft'
                  )}
                </Badge>
                {form.isLive && (
                  <Badge variant="outline" className="gap-1.5 text-xs text-emerald-600 border-emerald-300">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    Live
                  </Badge>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {form.isSubmitted && canReopen && (
              <ReopenDialog
                onReopen={handleReopen}
                isLoading={form.isLoading}
              />
            )}
            <Button
              variant="outline"
              onClick={handleSaveDraft}
              disabled={form.isReadOnly || form.isSaving}
            >
              <Save className="mr-2 h-4 w-4" />
              {form.isSaving ? 'Saving...' : 'Save Draft'}
            </Button>
            <Button onClick={handleSubmitClick} disabled={form.isReadOnly || form.isSubmitting}>
              <Send className="mr-2 h-4 w-4" />
              {form.isSubmitting ? 'Submitting...' : 'Submit Entry'}
            </Button>
          </div>
        </div>

        {form.isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-96 w-full" />
            <div className="grid gap-6 lg:grid-cols-2">
              <Skeleton className="h-64" />
              <Skeleton className="h-64" />
            </div>
          </div>
        ) : (
          <>
            {/* Sales Entry Grid */}
            <CategoryTable
              localData={form.localData}
              totals={form.totals}
              isReadOnly={form.isReadOnly}
              onValueChange={form.handleValueChange}
              onQuantityChange={form.handleQuantityChange}
              getCategoryTotal={form.getCategoryTotal}
              dailyEntryId={form.entry?.id ?? null}
              hasLineItems={form.hasLineItems}
              getLineItemsForCell={form.getLineItemsForCell}
              getLineItemCount={form.getLineItemCount}
              onAddLineItem={form.addLineItem}
              onDeleteLineItem={form.deleteLineItem}
              onEnsureDraft={form.saveDraft}
              wholesaleCustomers={wholesale.customers}
              wholesaleSearch={wholesale.search}
              onWholesaleSearchChange={wholesale.setSearch}
              onCreateWholesaleCustomer={wholesale.createCustomer}
              getDiscount={wholesale.getDiscount}
              calculateReload={wholesale.calculateReload}
              minCashAmount={wholesale.minCashAmount}
            />

            {/* Credit Sales Section */}
            <CreditSalesSection
              entry={form.entry}
              linkedConsumerCreditTotal={form.linkedConsumerCreditTotal}
              linkedCorporateCreditTotal={form.linkedCorporateCreditTotal}
              isReadOnly={form.isReadOnly}
              onRefreshEntry={form.refreshEntry}
              onSaveDraft={form.saveDraft}
            />

            {/* Sale Line Items (collapsible) */}
            <SaleItemsSection
              lineItems={form.saleLineItems}
              isLoading={form.saleLineItemsLoading}
              isReadOnly={form.isReadOnly}
              onEditLineItem={form.editLineItem}
              onDeleteLineItem={form.deleteLineItem}
            />

            {/* Wallet & Cash Reconciliation */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Wallet Tracking */}
              <WalletSection
                wallet={form.localData.wallet}
                reloadSalesTotal={form.reloadSalesTotal}
                variance={form.variance}
                dayTopups={form.dayTopups}
                totalTopups={form.totalTopups}
                currentDate={currentDate}
                isReadOnly={form.isReadOnly}
                walletOpeningSource={form.walletOpeningSource}
                walletOpeningReason={form.walletOpeningReason}
                onFieldChange={form.handleFieldChange}
                onOverrideWalletOpening={form.overrideWalletOpening}
                onRefreshWallet={form.refreshWallet}
              />

              {/* Cash Reconciliation */}
              <CashDrawerSection
                cashDrawer={form.localData.cashDrawer}
                totals={form.totals}
                variance={form.variance}
                isReadOnly={form.isReadOnly}
                onFieldChange={form.handleFieldChange}
              />
            </div>

            {/* Notes */}
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
                <CardDescription>Add any additional notes for this day</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={form.localData.notes}
                  onChange={(e) => form.handleFieldChange('notes', e.target.value)}
                  placeholder="Enter any notes or observations..."
                  rows={3}
                  disabled={form.isReadOnly}
                />
              </CardContent>
            </Card>

            {/* Amendment History */}
            {form.amendments.length > 0 && (
              <AmendmentHistory amendments={form.amendments} />
            )}

            {/* Summary Bar */}
            <DailySummaryBar totals={form.totals} />
          </>
        )}
      </div>

      {/* Variance Warning Dialog */}
      <SubmissionDialog
        open={showVarianceWarning}
        onOpenChange={setShowVarianceWarning}
        messages={varianceMessages}
        onConfirm={() => handleSubmit(true)}
      />

      {/* Unsaved Changes Dialog */}
      <AlertDialog open={showUnsavedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes that will be lost if you leave. Save as a draft to keep your progress.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={handleStay} className="sm:mr-auto">
              Stay on Page
            </Button>
            <Button variant="ghost" onClick={handleLeave}>
              Leave without Saving
            </Button>
            <Button onClick={handleSaveAndLeave} disabled={form.isSaving}>
              <Save className="mr-2 h-4 w-4" />
              {form.isSaving ? 'Saving...' : 'Save Draft & Leave'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
    </DailyEntryProvider>
  )
}
