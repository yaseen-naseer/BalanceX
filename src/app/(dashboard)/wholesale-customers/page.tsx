'use client'

import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Plus,
  Search,
  AlertCircle,
  Phone,
  Building2,
  ShoppingBag,
  ChevronDown,
  ChevronUp,
  Users,
  TrendingUp,
  Pencil,
} from 'lucide-react'
import { useApiClient } from '@/hooks/use-api-client'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import type { WholesaleCustomerData } from '@/types'

interface PurchaseItem {
  id: string
  amount: number
  cashAmount: number | null
  discountPercent: number | null
  serviceNumber: string | null
  note: string | null
  category: string
  date: string
  createdAt: string
}

interface CustomerDetail extends WholesaleCustomerData {
  updatedAt: string
  purchases: PurchaseItem[]
}

const DISCOUNT_OPTIONS = [6.0, 6.5, 7.0, 7.5, 8.0] as const

export default function WholesaleCustomersPage() {
  const api = useApiClient()
  const { isSales } = useAuth()
  const [customers, setCustomers] = useState<WholesaleCustomerData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null)
  const [customerDetail, setCustomerDetail] = useState<CustomerDetail | null>(null)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)

  // New customer form
  const [showNewDialog, setShowNewDialog] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newBusinessName, setNewBusinessName] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [newDiscountOverride, setNewDiscountOverride] = useState<string>('auto')
  const [isCreating, setIsCreating] = useState(false)

  // Edit discount
  const [editingDiscount, setEditingDiscount] = useState<string | null>(null)
  const [editDiscountValue, setEditDiscountValue] = useState<string>('auto')
  const [isSavingDiscount, setIsSavingDiscount] = useState(false)

  const fetchCustomers = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await api.get<WholesaleCustomerData[]>('/api/wholesale-customers', {
        params: { search: searchQuery, activeOnly: 'false', limit: '100' },
      })
      if (result.success && result.data) {
        setCustomers(result.data)
      } else {
        setError('Failed to load customers')
      }
    } catch {
      setError('Failed to load customers')
    } finally {
      setIsLoading(false)
    }
  }, [api, searchQuery])

  useEffect(() => {
    const timer = setTimeout(() => fetchCustomers(), 300)
    return () => clearTimeout(timer)
  }, [fetchCustomers])

  const fetchDetail = async (id: string) => {
    setIsLoadingDetail(true)
    try {
      const result = await api.get<CustomerDetail>(`/api/wholesale-customers/${id}`)
      if (result.success && result.data) {
        setCustomerDetail(result.data)
      }
    } finally {
      setIsLoadingDetail(false)
    }
  }

  const toggleExpand = (id: string) => {
    if (expandedCustomer === id) {
      setExpandedCustomer(null)
      setCustomerDetail(null)
    } else {
      setExpandedCustomer(id)
      fetchDetail(id)
    }
  }

  const handleCreate = async () => {
    if (!newName.trim() || !newPhone.trim()) {
      toast.error('Name and phone are required')
      return
    }
    setIsCreating(true)
    try {
      const result = await api.post<WholesaleCustomerData>('/api/wholesale-customers', {
        name: newName.trim(),
        phone: newPhone.trim(),
        businessName: newBusinessName.trim() || null,
        notes: newNotes.trim() || null,
        discountOverride: newDiscountOverride === 'auto' ? null : parseFloat(newDiscountOverride),
      })
      if (result.success && result.data) {
        toast.success(`Customer "${newName.trim()}" created`)
        setShowNewDialog(false)
        setNewName('')
        setNewPhone('')
        setNewBusinessName('')
        setNewNotes('')
        setNewDiscountOverride('auto')
        fetchCustomers()
      } else {
        toast.error(result.error || 'Failed to create customer')
      }
    } finally {
      setIsCreating(false)
    }
  }

  const handleSaveDiscount = async (customerId: string) => {
    setIsSavingDiscount(true)
    try {
      const override = editDiscountValue === 'auto' ? null : parseFloat(editDiscountValue)
      const result = await api.patch<WholesaleCustomerData>(`/api/wholesale-customers/${customerId}`, {
        discountOverride: override,
      })
      if (result.success) {
        toast.success(override ? `Fixed discount set to ${override}%` : 'Discount set to auto (tier-based)')
        setEditingDiscount(null)
        // Update local state
        setCustomers((prev) =>
          prev.map((c) => (c.id === customerId ? { ...c, discountOverride: override } : c))
        )
        if (customerDetail?.id === customerId) {
          setCustomerDetail((prev) => prev ? { ...prev, discountOverride: override } : prev)
        }
      } else {
        toast.error(result.error || 'Failed to update discount')
      }
    } finally {
      setIsSavingDiscount(false)
    }
  }

  // Summary stats
  const totalCustomers = customers.length
  const activeCustomers = customers.filter((c) => c.isActive).length
  const totalReload = customers.reduce((sum, c) => sum + c.totalPurchases, 0)
  const totalCash = customers.reduce((sum, c) => sum + c.totalCashAmount, 0)
  const totalMargin = totalReload - totalCash

  return (
    <div className="flex flex-col">
      <Header title="Wholesale Customers" subtitle="Track wholesale reload buyers and purchase history" />

      <div className="flex-1 space-y-6 p-6">
        {error && (
          <Card className="border-rose-200 bg-rose-50">
            <CardContent className="flex items-center gap-2 py-4">
              <AlertCircle className="h-4 w-4 text-rose-500" />
              <span className="text-sm text-rose-700">{error}</span>
            </CardContent>
          </Card>
        )}

        {/* Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <div className="rounded-lg bg-blue-100 p-2.5 dark:bg-blue-900/30">
                <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Customers</p>
                <p className="text-2xl font-bold">{totalCustomers}</p>
                <p className="text-xs text-muted-foreground">{activeCustomers} active</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <div className="rounded-lg bg-emerald-100 p-2.5 dark:bg-emerald-900/30">
                <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Cash Received</p>
                <p className="text-2xl font-bold font-mono">{totalCash.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">MVR</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <div className="rounded-lg bg-orange-100 p-2.5 dark:bg-orange-900/30">
                <ShoppingBag className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Reload Given</p>
                <p className="text-2xl font-bold font-mono">{totalReload.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">MVR (wallet cost)</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <div className={cn("rounded-lg p-2.5", totalMargin >= 0 ? "bg-red-100 dark:bg-red-900/30" : "bg-emerald-100 dark:bg-emerald-900/30")}>
                <TrendingUp className={cn("h-5 w-5", totalMargin >= 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400")} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Margin</p>
                <p className="text-2xl font-bold font-mono">{Math.abs(totalMargin).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{totalMargin >= 0 ? "Cost exceeds cash" : "MVR profit"}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Add */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, phone, or business..."
              className="pl-9"
            />
          </div>
          <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Customer
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Wholesale Customer</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Customer name"
                    maxLength={100}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone *</Label>
                  <Input
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="Phone number"
                    maxLength={20}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Business Name</Label>
                  <Input
                    value={newBusinessName}
                    onChange={(e) => setNewBusinessName(e.target.value)}
                    placeholder="Optional business name"
                    maxLength={100}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Input
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    placeholder="Optional notes"
                    maxLength={500}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Discount</Label>
                  <Select value={newDiscountOverride} onValueChange={setNewDiscountOverride}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto (based on cash amount)</SelectItem>
                      {DISCOUNT_OPTIONS.map((d) => (
                        <SelectItem key={d} value={d.toString()}>
                          Fixed {d}%
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Auto uses global tier thresholds. Fixed applies the same discount regardless of amount.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button
                  onClick={handleCreate}
                  disabled={isCreating || !newName.trim() || !newPhone.trim()}
                >
                  {isCreating ? 'Creating...' : 'Create Customer'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Customer List */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : customers.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              {searchQuery ? 'No customers found matching your search.' : 'No wholesale customers yet. Add one to get started.'}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {customers.map((customer) => (
              <Card
                key={customer.id}
                className={cn(
                  'transition-colors',
                  !customer.isActive && 'opacity-60'
                )}
              >
                <button
                  type="button"
                  className="w-full text-left px-4 py-3"
                  onClick={() => toggleExpand(customer.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold truncate">{customer.name}</span>
                          {!customer.isActive && (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              Inactive
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {customer.phone}
                          </span>
                          {customer.businessName && (
                            <span className="flex items-center gap-1 truncate">
                              <Building2 className="h-3 w-3" />
                              {customer.businessName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      {customer.discountOverride != null && (
                        <Badge variant="outline" className="text-xs">
                          {customer.discountOverride}% fixed
                        </Badge>
                      )}
                      <div className="text-right">
                        <p className="font-mono font-semibold">{customer.totalCashAmount.toLocaleString()} MVR</p>
                        <p className="text-xs text-muted-foreground">
                          {customer.purchaseCount} sale{customer.purchaseCount !== 1 ? 's' : ''}
                          {customer.totalPurchases > 0 && ` · ${customer.totalPurchases.toLocaleString()} reload`}
                        </p>
                      </div>
                      {expandedCustomer === customer.id ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </button>

                {expandedCustomer === customer.id && (
                  <CardContent className="pt-0 border-t">
                    {isLoadingDetail ? (
                      <div className="py-4 space-y-2">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                    ) : customerDetail ? (
                      <div className="py-3 space-y-4">
                        {customerDetail.notes && (
                          <p className="text-sm text-muted-foreground italic">{customerDetail.notes}</p>
                        )}

                        {/* Discount override edit — owner/accountant only */}
                        {!isSales && (
                          <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2">
                            <span className="text-sm font-medium shrink-0">Discount:</span>
                            {editingDiscount === customer.id ? (
                              <>
                                <Select value={editDiscountValue} onValueChange={setEditDiscountValue}>
                                  <SelectTrigger className="h-8 w-52">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="auto">Auto (tier-based)</SelectItem>
                                    {DISCOUNT_OPTIONS.map((d) => (
                                      <SelectItem key={d} value={d.toString()}>
                                        Fixed {d}%
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="h-8"
                                  disabled={isSavingDiscount}
                                  onClick={() => handleSaveDiscount(customer.id)}
                                >
                                  {isSavingDiscount ? 'Saving...' : 'Save'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8"
                                  onClick={() => setEditingDiscount(null)}
                                >
                                  Cancel
                                </Button>
                              </>
                            ) : (
                              <>
                                <span className="text-sm">
                                  {customer.discountOverride != null
                                    ? <Badge variant="outline">{customer.discountOverride}% fixed</Badge>
                                    : <span className="text-muted-foreground">Auto (based on cash amount tiers)</span>
                                  }
                                </span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2"
                                  onClick={() => {
                                    setEditDiscountValue(
                                      customer.discountOverride != null
                                        ? customer.discountOverride.toString()
                                        : 'auto'
                                    )
                                    setEditingDiscount(customer.id)
                                  }}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        )}

                        <div>
                          <h4 className="text-sm font-medium mb-2">Recent Purchases</h4>
                          {customerDetail.purchases.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No purchases yet.</p>
                          ) : (
                            <div className="rounded-md border divide-y max-h-64 overflow-y-auto">
                              {customerDetail.purchases.map((purchase) => (
                                <div key={purchase.id} className="flex items-center justify-between px-3 py-2 text-sm">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <span className="text-muted-foreground whitespace-nowrap">
                                      {format(new Date(purchase.date), 'dd MMM yyyy')}
                                    </span>
                                    {purchase.cashAmount != null ? (
                                      <>
                                        <span className="font-mono font-medium whitespace-nowrap">
                                          {Number(purchase.cashAmount).toLocaleString()} cash
                                        </span>
                                        <span className="text-xs text-muted-foreground">→</span>
                                        <span className="font-mono whitespace-nowrap text-primary">
                                          {Number(purchase.amount).toLocaleString()} reload
                                        </span>
                                        {purchase.discountPercent != null && (
                                          <Badge variant="outline" className="text-[10px] px-1 py-0">
                                            {Number(purchase.discountPercent)}%
                                          </Badge>
                                        )}
                                      </>
                                    ) : (
                                      <span className="font-mono font-medium whitespace-nowrap">
                                        {Number(purchase.amount).toLocaleString()} MVR
                                      </span>
                                    )}
                                    {purchase.serviceNumber && (
                                      <span className="text-muted-foreground text-xs truncate">
                                        #{purchase.serviceNumber}
                                      </span>
                                    )}
                                    {purchase.note && (
                                      <span className="text-muted-foreground text-xs truncate italic">
                                        {purchase.note}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>Created: {format(new Date(customerDetail.createdAt), 'dd MMM yyyy')}</span>
                          {customerDetail.lastPurchaseDate && (
                            <span>Last purchase: {format(new Date(customerDetail.lastPurchaseDate), 'dd MMM yyyy')}</span>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
