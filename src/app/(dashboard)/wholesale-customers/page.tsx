'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Header } from '@/components/layout'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Search,
  AlertCircle,
  Phone,
  Building2,
  ShoppingBag,
  ChevronDown,
  ChevronUp,
  Users,
  TrendingUp,
} from 'lucide-react'
import { useApiClient } from '@/hooks/use-api-client'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { WholesaleCustomerData } from '@/types'
import { NewCustomerDialog } from '@/components/wholesale/new-customer-dialog'
import { CustomerDetailSection } from '@/components/wholesale/customer-detail'

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
      } else {
        toast.error('Failed to load customer details')
      }
    } catch {
      toast.error('Failed to load customer details')
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

  const handleDiscountSaved = (customerId: string, override: number | null) => {
    setCustomers((prev) =>
      prev.map((c) => (c.id === customerId ? { ...c, discountOverride: override } : c))
    )
    if (customerDetail?.id === customerId) {
      setCustomerDetail((prev) => prev ? { ...prev, discountOverride: override } : prev)
    }
  }

  // Summary stats — memoized to avoid recomputation on unrelated renders
  const { totalCustomers, activeCustomers, totalReload, totalCash, totalMargin } = useMemo(() => {
    const total = customers.length
    const active = customers.filter((c) => c.isActive).length
    const reload = customers.reduce((sum, c) => sum + c.totalPurchases, 0)
    const cash = customers.reduce((sum, c) => sum + c.totalCashAmount, 0)
    return { totalCustomers: total, activeCustomers: active, totalReload: reload, totalCash: cash, totalMargin: reload - cash }
  }, [customers])

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
          <NewCustomerDialog onCreated={fetchCustomers} />
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
                  <CustomerDetailSection
                    customer={customer}
                    detail={customerDetail}
                    isLoadingDetail={isLoadingDetail}
                    isSales={isSales}
                    onDiscountSaved={handleDiscountSaved}
                  />
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
