'use client'

import { useState, useEffect } from 'react'
import { useDialogState } from '@/hooks/use-dialog-state'
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
import { useApiClient } from '@/hooks/use-api-client'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/hooks/use-auth'
import { useWholesaleCustomers } from '@/hooks/use-wholesale-customers'
import type { CreditCustomerWithBalance, CreateCreditCustomerDto, WholesaleCustomerData } from '@/types'
import { CustomerSelector } from './customer-selector'
import { CustomerInfoCard } from './customer-info-card'
import { LimitWarningDialog, type LimitWarningData } from './limit-warning-dialog'
import { CustomerFormDialog } from './customer-form-dialog'
import { WholesaleCustomerSelector } from './wholesale-customer-selector'
import { fmtCurrency } from '@/lib/constants'

const CREDIT_CATEGORIES = [
  { value: 'DHIRAAGU_BILLS', label: 'Dhiraagu Bills' },
  { value: 'WHOLESALE_RELOAD', label: 'Wholesale Reload' },
] as const

interface CreditSaleDialogProps {
  dailyEntryId: string | null
  onSaleAdded: () => void
  onSaveDraft?: () => Promise<string | false>
  disabled?: boolean
}

export function CreditSaleDialog({ dailyEntryId, onSaleAdded, onSaveDraft, disabled }: CreditSaleDialogProps) {
  const api = useApiClient()
  const { isOwner } = useAuth()
  const wholesale = useWholesaleCustomers()
  const dialog = useDialogState()
  const [customerSelectOpen, setCustomerSelectOpen] = useState(false)
  const [showLimitWarning, setShowLimitWarning] = useState(false)

  const [customers, setCustomers] = useState<CreditCustomerWithBalance[]>([])
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<CreditCustomerWithBalance | null>(null)
  const [selectedWholesaleCustomer, setSelectedWholesaleCustomer] = useState<WholesaleCustomerData | null>(null)
  const [amount, setAmount] = useState('')
  const [cashAmount, setCashAmount] = useState('')
  const [reference, setReference] = useState('')
  const [category, setCategory] = useState<'DHIRAAGU_BILLS' | 'WHOLESALE_RELOAD'>('DHIRAAGU_BILLS')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [limitWarningData, setLimitWarningData] = useState<LimitWarningData | null>(null)
  const [resolvedEntryId, setResolvedEntryId] = useState<string | null>(dailyEntryId)

  // Wholesale calculator — use the selected wholesale customer for discount override
  const isWholesale = category === 'WHOLESALE_RELOAD'
  const numCashAmount = parseFloat(cashAmount) || 0
  const wholesaleDiscount = isWholesale && numCashAmount > 0
    ? wholesale.getDiscount(numCashAmount, selectedWholesaleCustomer)
    : null
  const wholesaleReloadAmount = wholesaleDiscount != null && numCashAmount > 0
    ? wholesale.calculateReload(numCashAmount, wholesaleDiscount)
    : null

  useEffect(() => {
    setResolvedEntryId(dailyEntryId)
  }, [dailyEntryId])

  useEffect(() => {
    if (dialog.isOpen) {
      fetchCustomers()
    }
    // fetchCustomers is intentionally re-defined per render; we only re-fetch when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog.isOpen])

  const fetchCustomers = async () => {
    setIsLoadingCustomers(true)
    try {
      const result = await api.get<CreditCustomerWithBalance[]>('/api/credit-customers')
      if (result.success && result.data) {
        setCustomers(result.data.filter((c) => c.isActive))
      }
    } catch (error) {
      console.error('Error fetching customers:', error)
      toast.error('Failed to load credit customers')
    } finally {
      setIsLoadingCustomers(false)
    }
  }

  const handleCreateCustomer = async (data: CreateCreditCustomerDto) => {
    try {
      const result = await api.post<CreditCustomerWithBalance>('/api/credit-customers', data)
      if (result.success) {
        toast.success(`Customer "${data.name}" created`)
        await fetchCustomers()
        if (result.data) setSelectedCustomer(result.data)
      } else {
        toast.error(result.error || 'Failed to create customer')
      }
    } catch {
      toast.error('Failed to create customer')
    }
  }

  const resetForm = () => {
    setSelectedCustomer(null)
    setSelectedWholesaleCustomer(null)
    setAmount('')
    setCashAmount('')
    setReference('')
    setCategory('DHIRAAGU_BILLS')
    setSearchQuery('')
  }

  // Wraps useDialogState's onOpenChange to also reset the credit-sale form on close.
  const handleOpenChange = (newOpen: boolean) => {
    dialog.onOpenChange(newOpen)
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

    if (isWholesale) {
      if (!selectedWholesaleCustomer) {
        toast.error('Please select a wholesale customer')
        return
      }
      if (!numCashAmount || numCashAmount <= 0) {
        toast.error('Please enter a valid cash amount')
        return
      }
      if (wholesale.minCashAmount && numCashAmount < wholesale.minCashAmount) {
        toast.error(`Minimum cash amount is ${fmtCurrency(wholesale.minCashAmount)} MVR`)
        return
      }
      if (wholesaleDiscount == null || wholesaleReloadAmount == null) {
        toast.error('Cash amount does not qualify for any discount tier')
        return
      }
      // Wholesale credit: no local credit limit check — API will handle it
      submitCreditSale(false, entryId)
      return
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
    if (!id) return

    // For wholesale: need wholesale customer. For regular: need credit customer.
    if (isWholesale && !selectedWholesaleCustomer) return
    if (!isWholesale && !selectedCustomer) return

    setIsSubmitting(true)
    setShowLimitWarning(false)

    try {
      const submitAmount = isWholesale && wholesaleReloadAmount ? wholesaleReloadAmount : parseFloat(amount)
      const customerName = isWholesale ? selectedWholesaleCustomer!.name : selectedCustomer!.name

      const body: Record<string, unknown> = {
        dailyEntryId: id,
        amount: submitAmount,
        cashAmount: isWholesale ? numCashAmount : null,
        discountPercent: isWholesale ? wholesaleDiscount : null,
        reference: reference || null,
        category,
        overrideLimit,
      }

      if (isWholesale) {
        body.wholesaleCustomerId = selectedWholesaleCustomer!.id
      } else {
        body.customerId = selectedCustomer!.id
        body.customerType = selectedCustomer!.type
      }

      const result = await api.post<Record<string, unknown>>('/api/credit-sales', body)

      const resAny = result as unknown as Record<string, unknown>
      if (result.success) {
        if (resAny.limitOverridden) {
          toast.success(`Credit sale approved with limit override`, {
            description: resAny.warning as string,
          })
        } else if (resAny.warning) {
          toast.warning(resAny.warning as string)
        } else {
          toast.success(`Credit sale added for ${customerName}`)
        }
        handleOpenChange(false)
        onSaleAdded()
      } else if (resAny.requiresOwnerApproval) {
        toast.error('Credit limit exceeded', {
          description: 'Only the Owner can approve sales that exceed credit limits.',
        })
      } else {
        toast.error(result.error || 'Failed to add credit sale')
      }
    } catch (_error) {
      toast.error('Failed to add credit sale')
    } finally {
      setIsSubmitting(false)
    }
  }

  // For CustomerInfoCard: show the credit balance impact (non-wholesale only)
  const newAmountValue = !isWholesale && parseFloat(amount) > 0 ? parseFloat(amount) : undefined

  return (
    <>
      <Dialog open={dialog.isOpen} onOpenChange={handleOpenChange}>
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
              Record a credit sale for a customer. The amount will be added to the selected category&apos;s credit column.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Category *</Label>
              <Select value={category} onValueChange={(v) => {
                setCategory(v as 'DHIRAAGU_BILLS' | 'WHOLESALE_RELOAD')
                setSelectedCustomer(null)
                setSelectedWholesaleCustomer(null)
                setCashAmount('')
                setAmount('')
              }}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CREDIT_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isWholesale ? (
              <div className="space-y-2">
                <Label>Wholesale Customer *</Label>
                <WholesaleCustomerSelector
                  customers={wholesale.customers}
                  selectedCustomer={selectedWholesaleCustomer}
                  isLoading={wholesale.isLoading}
                  onSelect={(c) => setSelectedWholesaleCustomer(c)}
                  searchQuery={wholesale.search}
                  onSearchChange={wholesale.setSearch}
                />
                {selectedWholesaleCustomer?.discountOverride != null && (
                  <p className="text-xs text-muted-foreground">
                    Fixed discount: {selectedWholesaleCustomer.discountOverride}%
                  </p>
                )}
              </div>
            ) : (
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
            )}

            {!isWholesale && selectedCustomer && (
              <CustomerInfoCard customer={selectedCustomer} newAmount={newAmountValue} />
            )}


            {isWholesale ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="cashAmount">Cash Amount (MVR) *</Label>
                  <Input
                    id="cashAmount"
                    type="text"
                    inputMode="decimal"
                    value={cashAmount}
                    onChange={(e) => {
                      if (e.target.value === '' || /^\d*\.?\d*$/.test(e.target.value)) {
                        setCashAmount(e.target.value)
                      }
                    }}
                    placeholder={wholesale.minCashAmount ? `Min ${wholesale.minCashAmount}` : '0.00'}
                    className="font-mono"
                  />
                </div>
                {numCashAmount > 0 && (
                  <div className="rounded-md bg-muted/50 p-3 space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Discount</span>
                      <span className="font-medium">
                        {wholesaleDiscount != null ? `${wholesaleDiscount}%` : 'Below min threshold'}
                      </span>
                    </div>
                    {wholesaleReloadAmount != null && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Reload (wallet deduction)</span>
                        <span className="font-mono font-semibold text-primary">
                          {fmtCurrency(wholesaleReloadAmount)} MVR
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Credit balance (owes)</span>
                      <span className="font-mono font-semibold text-amber-600">
                        {fmtCurrency(numCashAmount)} MVR
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
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
            )}

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
