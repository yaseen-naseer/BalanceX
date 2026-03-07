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
  SubmissionDialog,
  DailySummaryBar,
  ReopenDialog,
  AmendmentHistory,
} from '@/components/daily-entry'

// CASH FLOAT — disabled (shop does not use a till/float)
// Re-enable by uncommenting all /* CASH FLOAT */ blocks below and restoring imports/state
// import { CashFloatSummary, CashFloatDialog } from '@/components/cash-float'

export default function DailyEntryPage() {
  const [currentDate, setCurrentDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [showVarianceWarning, setShowVarianceWarning] = useState(false)
  const [varianceMessages, setVarianceMessages] = useState<ValidationMessage[]>([])

  const { user } = useAuth()

  /* CASH FLOAT STATE
  interface CashFloatData {
    id: string
    shiftName: string
    selectedFloatAmount: number
    selectedFloatId?: string
    openingTotal?: number
    closingTotal?: number
    variance?: number
    openingFloatVerified?: boolean
    closingFloatVerified?: boolean
    openingFloatNotes?: string
    closingFloatNotes?: string
    [key: string]: string | number | boolean | undefined
  }
  const [cashFloat, setCashFloat] = useState<CashFloatData | null>(null)
  const [showFloatDialog, setShowFloatDialog] = useState(false)
  const [floatDialogType, setFloatDialogType] = useState<'opening' | 'closing'>('opening')
  const [isLoadingFloat, setIsLoadingFloat] = useState(false)
  */

  // Use the extracted form hook
  const form = useDailyEntryForm({ date: currentDate })

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

  /* CASH FLOAT FETCH
  const fetchCashFloat = async () => {
    setIsLoadingFloat(true)
    try {
      const res = await fetch(`/api/cash-float?date=${currentDate}`)
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setCashFloat(data.data.cashFloat)
        }
      }
    } catch (error) {
      console.error('Error fetching cash float:', error)
    } finally {
      setIsLoadingFloat(false)
    }
  }

  useEffect(() => {
    if (!form.isLoading) {
      fetchCashFloat()
    }
  }, [currentDate, form.isLoading])

  const handleRecordOpening = () => {
    if (!form.entry) {
      toast.error('Save a draft first before recording cash float')
      return
    }
    setFloatDialogType('opening')
    setShowFloatDialog(true)
  }

  const handleRecordClosing = () => {
    if (!form.entry) {
      toast.error('Save a draft first before recording cash float')
      return
    }
    setFloatDialogType('closing')
    setShowFloatDialog(true)
  }
  */

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

    if (validation.hasWarnings) {
      setVarianceMessages(validation.messages)
      setShowVarianceWarning(true)
      return
    }

    handleSubmit(false)
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
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {form.isLoading ? (
              <Skeleton className="h-6 w-20" />
            ) : (
              <Badge variant={form.isSubmitted ? 'default' : 'secondary'}>
                {form.isSubmitted ? (
                  <>
                    <CheckCircle2 className="mr-1 h-3 w-3" /> Submitted
                  </>
                ) : (
                  'Draft'
                )}
              </Badge>
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
            />

            {/* Credit Sales Section */}
            <CreditSalesSection
              entry={form.entry}
              gridCreditTotal={form.gridCreditTotal}
              linkedCreditTotal={form.linkedCreditTotal}
              gridConsumerCreditTotal={form.gridConsumerCreditTotal}
              gridCorporateCreditTotal={form.gridCorporateCreditTotal}
              linkedConsumerCreditTotal={form.linkedConsumerCreditTotal}
              linkedCorporateCreditTotal={form.linkedCorporateCreditTotal}
              creditBalanced={form.creditBalanced}
              isReadOnly={form.isReadOnly}
              onRefreshEntry={form.refreshEntry}
              onSaveDraft={form.saveDraft}
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
                onFieldChange={form.handleFieldChange}
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

            {/* CASH FLOAT SUMMARY — disabled
            <CashFloatSummary
              cashFloat={cashFloat}
              isReadOnly={form.isReadOnly}
              onRecordOpening={handleRecordOpening}
              onRecordClosing={handleRecordClosing}
            />
            */}

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

      {/* CASH FLOAT DIALOG — disabled
      {form.entry && (
        <CashFloatDialog
          open={showFloatDialog}
          onOpenChange={setShowFloatDialog}
          dailyEntryId={form.entry.id}
          date={currentDate}
          type={floatDialogType}
          existingFloat={cashFloat}
          cashExpected={form.variance.cashExpected}
          onSuccess={fetchCashFloat}
        />
      )}
      */}
    </div>
  )
}
