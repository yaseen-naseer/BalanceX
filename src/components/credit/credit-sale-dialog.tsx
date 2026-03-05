'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/use-auth'
import type { CreditCustomerWithBalance, CreateCreditCustomerDto } from '@/types'
import { CustomerSelector } from './customer-selector'
import { CustomerInfoCard } from './customer-info-card'
import { LimitWarningDialog, type LimitWarningData } from './limit-warning-dialog'
import { CustomerFormDialog } from './customer-form-dialog'

interface CreditSaleDialogProps {
  dailyEntryId: string | null
  onSaleAdded: () => void
  onSaveDraft?: () => Promise<string | false>
  disabled?: boolean
}

export function CreditSaleDialog({ dailyEntryId, onSaleAdded, onSaveDraft, disabled }: CreditSaleDialogProps) {
  const { isOwner } = useAuth()
  const [open, setOpen] = useState(false)
  const [customerSelectOpen, setCustomerSelectOpen] = useState(false)
  const [showLimitWarning, setShowLimitWarning] = useState(false)

  const [customers, setCustomers] = useState<CreditCustomerWithBalance[]>([])
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<CreditCustomerWithBalance | null>(null)
  const [amount, setAmount] = useState('')
  const [reference, setReference] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [limitWarningData, setLimitWarningData] = useState<LimitWarningData | null>(null)
  const [resolvedEntryId, setResolvedEntryId] = useState<string | null>(dailyEntryId)

  useEffect(() => {
    setResolvedEntryId(dailyEntryId)
  }, [dailyEntryId])

  useEffect(() => {
    if (open) {
      fetchCustomers()
    }
  }, [open])

  const fetchCustomers = async () => {
    setIsLoadingCustomers(true)
    try {
      const response = await fetch('/api/credit-customers')
      const data = await response.json()
      if (data.success) {
        setCustomers(data.data.filter((c: CreditCustomerWithBalance) => c.isActive))
      }
    } catch (error) {
      console.error('Error fetching customers:', error)
    } finally {
      setIsLoadingCustomers(false)
    }
  }

  const handleCreateCustomer = async (data: CreateCreditCustomerDto) => {
    try {
      const response = await fetch('/api/credit-customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const result = await response.json()
      if (result.success) {
        toast.success(`Customer "${data.name}" created`)
        await fetchCustomers()
        // Auto-select the newly created customer
        setSelectedCustomer(result.data)
      } else {
        toast.error(result.error || 'Failed to create customer')
      }
    } catch {
      toast.error('Failed to create customer')
    }
  }

  const resetForm = () => {
    setSelectedCustomer(null)
    setAmount('')
    setReference('')
    setSearchQuery('')
  }

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen) {
      resetForm()
    }
  }

  const handleCustomerSelect = (customer: CreditCustomerWithBalance) => {
    setSelectedCustomer(customer)
    setCustomerSelectOpen(false)
  }

  const validateAndSubmit = async () => {
    let entryId = resolvedEntryId

    if (!entryId) {
      if (!onSaveDraft) {
        toast.error('Please save the daily entry first')
        return
      }
      const toastId = toast.loading('Saving entry draft first...')
      const savedId = await onSaveDraft()
      toast.dismiss(toastId)
      if (!savedId) {
        toast.error('Failed to save entry. Please try again.')
        return
      }
      setResolvedEntryId(savedId)
      entryId = savedId
    }

    if (!selectedCustomer) {
      toast.error('Please select a customer')
      return
    }

    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    const currentBalance = selectedCustomer.outstandingBalance
    const newBalance = currentBalance + amountNum
    const limit = selectedCustomer.creditLimit

    if (limit !== null && newBalance > limit) {
      setLimitWarningData({
        currentBalance,
        newBalance,
        limit,
        exceededBy: newBalance - limit,
        saleAmount: amountNum,
      })
      setShowLimitWarning(true)
      return
    }

    submitCreditSale(false, entryId)
  }

  const submitCreditSale = async (overrideLimit: boolean = false, entryIdOverride?: string) => {
    const id = entryIdOverride ?? resolvedEntryId
    if (!id || !selectedCustomer) return

    setIsSubmitting(true)
    setShowLimitWarning(false)

    try {
      const response = await fetch('/api/credit-sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dailyEntryId: id,
          customerId: selectedCustomer.id,
          amount: parseFloat(amount),
          reference: reference || null,
          customerType: selectedCustomer.type,
          overrideLimit,
        }),
      })

      const data = await response.json()

      if (data.success) {
        if (data.limitOverridden) {
          toast.success(`Credit sale approved with limit override`, {
            description: data.warning,
          })
        } else if (data.warning) {
          toast.warning(data.warning)
        } else {
          toast.success(`Credit sale of ${amount} MVR added for ${selectedCustomer.name}`)
        }
        handleOpenChange(false)
        onSaleAdded()
      } else if (data.requiresOwnerApproval) {
        toast.error('Credit limit exceeded', {
          description: 'Only the Owner can approve sales that exceed credit limits.',
        })
      } else {
        toast.error(data.error || 'Failed to add credit sale')
      }
    } catch (_error) {
      toast.error('Failed to add credit sale')
    } finally {
      setIsSubmitting(false)
    }
  }

  const parsedAmount = parseFloat(amount)
  const newAmountValue = !isNaN(parsedAmount) && parsedAmount > 0 ? parsedAmount : undefined

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1" disabled={disabled}>
            <Plus className="h-3 w-3" />
            Add Credit Sale
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Credit Sale</DialogTitle>
            <DialogDescription>
              Record a credit sale for a customer. This will be added to the Dhiraagu Bills
              category.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Customer *</Label>
                <CustomerFormDialog
                  onSubmit={handleCreateCustomer}
                  trigger={
                    <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 px-2">
                      <Plus className="h-3 w-3" />
                      New Customer
                    </Button>
                  }
                />
              </div>
              <CustomerSelector
                customers={customers}
                selectedCustomer={selectedCustomer}
                isLoading={isLoadingCustomers}
                open={customerSelectOpen}
                onOpenChange={setCustomerSelectOpen}
                onSelect={handleCustomerSelect}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
              />
            </div>

            {selectedCustomer && (
              <CustomerInfoCard customer={selectedCustomer} newAmount={newAmountValue} />
            )}

            <div className="space-y-2">
              <Label htmlFor="amount">Amount (MVR) *</Label>
              <Input
                id="amount"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reference">Reference (optional)</Label>
              <Input
                id="reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g., Invoice number"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={validateAndSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Adding...' : 'Add Credit Sale'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LimitWarningDialog
        open={showLimitWarning}
        onOpenChange={setShowLimitWarning}
        data={limitWarningData}
        isOwner={isOwner}
        onConfirm={() => submitCreditSale(true)}
      />
    </>
  )
}
