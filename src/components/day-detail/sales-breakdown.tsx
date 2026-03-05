'use client'

import { Separator } from '@/components/ui/separator'
import { Banknote, Wallet, Users } from 'lucide-react'
import type { EntryTotals } from './types'

const CATEGORY_LABELS: Record<string, string> = {
  DHIRAAGU_BILLS: 'Dhiraagu Bills',
  RETAIL_RELOAD: 'Retail Reload',
  WHOLESALE_RELOAD: 'Wholesale Reload',
  SIM: 'SIM',
  USIM: 'USIM',
}

const CATEGORIES = ['DHIRAAGU_BILLS', 'RETAIL_RELOAD', 'WHOLESALE_RELOAD', 'SIM', 'USIM']

export interface SalesBreakdownProps {
  totals: EntryTotals
}

export function SalesBreakdown({ totals }: SalesBreakdownProps) {
  return (
    <div className="space-y-4">
      {/* Revenue by Category */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-muted-foreground">Revenue by Category</h4>
        <div className="grid grid-cols-2 gap-2">
          {CATEGORIES.map((cat) => (
            <div key={cat} className="flex justify-between py-1">
              <span className="text-sm">{CATEGORY_LABELS[cat]}</span>
              <span className="font-mono text-sm font-medium">
                {(totals.categoryTotals[cat] || 0).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Payment Method Breakdown */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-muted-foreground">By Payment Method</h4>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="rounded-lg bg-emerald-50 p-3">
            <Banknote className="mx-auto mb-1 h-4 w-4 text-emerald-600" />
            <p className="text-xs text-muted-foreground">Cash</p>
            <p className="font-mono font-semibold text-emerald-700">
              {totals.totalCash.toLocaleString()}
            </p>
          </div>
          <div className="rounded-lg bg-blue-50 p-3">
            <Wallet className="mx-auto mb-1 h-4 w-4 text-blue-600" />
            <p className="text-xs text-muted-foreground">Transfer</p>
            <p className="font-mono font-semibold text-blue-700">
              {totals.totalTransfer.toLocaleString()}
            </p>
          </div>
          <div className="rounded-lg bg-amber-50 p-3">
            <Users className="mx-auto mb-1 h-4 w-4 text-amber-600" />
            <p className="text-xs text-muted-foreground">Credit</p>
            <p className="font-mono font-semibold text-amber-700">
              {totals.totalCredit.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      <Separator />

      {/* Total */}
      <div className="rounded-lg bg-primary/10 p-4 text-center">
        <p className="text-sm text-muted-foreground">Total Revenue</p>
        <p className="text-2xl font-bold">{totals.totalRevenue.toLocaleString()} MVR</p>
      </div>
    </div>
  )
}
