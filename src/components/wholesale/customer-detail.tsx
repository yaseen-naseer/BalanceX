'use client'

import { useState } from 'react'
import { CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Pencil } from 'lucide-react'
import { useApiClient } from '@/hooks/use-api-client'
import { toast } from 'sonner'
import { format } from 'date-fns'
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

interface CustomerDetailSectionProps {
  customer: WholesaleCustomerData
  detail: CustomerDetail | null
  isLoadingDetail: boolean
  isSales: boolean
  onDiscountSaved: (customerId: string, override: number | null) => void
}

export function CustomerDetailSection({
  customer,
  detail,
  isLoadingDetail,
  isSales,
  onDiscountSaved,
}: CustomerDetailSectionProps) {
  const api = useApiClient()
  const [editingDiscount, setEditingDiscount] = useState<string | null>(null)
  const [editDiscountValue, setEditDiscountValue] = useState<string>('auto')
  const [isSavingDiscount, setIsSavingDiscount] = useState(false)

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
        onDiscountSaved(customerId, override)
      } else {
        toast.error(result.error || 'Failed to update discount')
      }
    } finally {
      setIsSavingDiscount(false)
    }
  }

  return (
    <CardContent className="pt-0 border-t">
      {isLoadingDetail ? (
        <div className="py-4 space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      ) : detail ? (
        <div className="py-3 space-y-4">
          {detail.notes && (
            <p className="text-sm text-muted-foreground italic">{detail.notes}</p>
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
            {detail.purchases.length === 0 ? (
              <p className="text-sm text-muted-foreground">No purchases yet.</p>
            ) : (
              <div className="rounded-md border divide-y max-h-64 overflow-y-auto">
                {detail.purchases.map((purchase) => (
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
            <span>Created: {format(new Date(detail.createdAt), 'dd MMM yyyy')}</span>
            {detail.lastPurchaseDate && (
              <span>Last purchase: {format(new Date(detail.lastPurchaseDate), 'dd MMM yyyy')}</span>
            )}
          </div>
        </div>
      ) : null}
    </CardContent>
  )
}
