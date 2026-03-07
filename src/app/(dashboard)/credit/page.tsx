'use client'

import { useState } from 'react'
import { Header } from '@/components/layout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Search, AlertCircle } from 'lucide-react'
import { useCreditCustomers } from '@/hooks/use-credit-customers'
import { useAuth } from '@/hooks/use-auth'
import {
  CustomerFormDialog,
  CreditSummaryCards,
  CustomerTable,
} from '@/components/credit'
import type { CreateCreditCustomerDto, CreateSettlementDto } from '@/types'
import { toast } from 'sonner'

export default function CreditCustomersPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'CONSUMER' | 'CORPORATE'>('ALL')
  const { isSales } = useAuth()
  const { customers, isLoading, error, createCustomer, updateCustomer, recordSettlement } = useCreditCustomers()

  const filteredCustomers = customers.filter((c) => {
    if (typeFilter !== 'ALL' && c.type !== typeFilter) {
      return false
    }
    return (
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone?.includes(searchQuery) ||
      c.email?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })

  const handleAddCustomer = async (data: CreateCreditCustomerDto) => {
    const result = await createCustomer(data)
    if (result) {
      toast.success(`Customer "${data.name}" added successfully`)
    }
  }

  const handleUpdateCustomer = async (id: string, data: import('@/types').UpdateCreditCustomerDto) => {
    const result = await updateCustomer(id, data)
    if (result) {
      toast.success('Customer updated successfully')
    }
  }

  const handleSettlement = async (customerId: string, data: CreateSettlementDto) => {
    const result = await recordSettlement(customerId, data)
    if (result) {
      const customer = customers.find((c) => c.id === customerId)
      toast.success(
        `Settlement of ${data.amount.toLocaleString()} MVR recorded for ${customer?.name}`
      )
    }
  }

  return (
    <div className="flex flex-col">
      <Header title="Credit Customers" subtitle="Manage credit sales and settlements" />

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
        <CreditSummaryCards customers={customers} isLoading={isLoading} />

        {/* Search, Filter & Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search customers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={typeFilter}
              onValueChange={(v) => setTypeFilter(v as 'ALL' | 'CONSUMER' | 'CORPORATE')}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Filter type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Types</SelectItem>
                <SelectItem value="CONSUMER">Consumer</SelectItem>
                <SelectItem value="CORPORATE">Corporate</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <CustomerFormDialog
            onSubmit={handleAddCustomer}
            trigger={
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Customer
              </Button>
            }
          />
        </div>

        {/* Customers Table */}
        <Card>
          <CardContent className="p-0">
            <CustomerTable
              customers={filteredCustomers}
              isLoading={isLoading}
              isSales={isSales}
              searchQuery={searchQuery}
              onSettlement={handleSettlement}
              onUpdate={handleUpdateCustomer}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
