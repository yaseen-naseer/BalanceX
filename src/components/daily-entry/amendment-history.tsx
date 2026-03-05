'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { History, ChevronDown, ChevronUp, Eye } from 'lucide-react'
import { format } from 'date-fns'
import type { DailyEntryWithRelations } from '@/types'

type Amendment = NonNullable<DailyEntryWithRelations['amendments']>[number]

interface AmendmentDiff {
  field: string
  before: string | number
  after: string | number
}

function parseSnapshot(json: string): Record<string, unknown> {
  try {
    return JSON.parse(json)
  } catch {
    return {}
  }
}

function buildDiff(before: Record<string, unknown>, after: Record<string, unknown>): AmendmentDiff[] {
  const diffs: AmendmentDiff[] = []

  // Cash drawer
  const cdBefore = (before.cashDrawer ?? {}) as Record<string, number>
  const cdAfter = (after.cashDrawer ?? {}) as Record<string, number>
  const cdFields: [string, string][] = [
    ['opening', 'Cash Opening'],
    ['bankDeposits', 'Bank Deposits'],
    ['closingActual', 'Cash Closing (Actual)'],
    ['closingExpected', 'Cash Closing (Expected)'],
    ['variance', 'Cash Variance'],
  ]
  for (const [key, label] of cdFields) {
    const bVal = cdBefore[key] ?? 0
    const aVal = cdAfter[key] ?? 0
    if (bVal !== aVal) diffs.push({ field: label, before: bVal, after: aVal })
  }

  // Wallet
  const wBefore = (before.wallet ?? {}) as Record<string, number>
  const wAfter = (after.wallet ?? {}) as Record<string, number>
  const wFields: [string, string][] = [
    ['opening', 'Wallet Opening'],
    ['closingActual', 'Wallet Closing (Actual)'],
    ['closingExpected', 'Wallet Closing (Expected)'],
    ['variance', 'Wallet Variance'],
  ]
  for (const [key, label] of wFields) {
    const bVal = wBefore[key] ?? 0
    const aVal = wAfter[key] ?? 0
    if (bVal !== aVal) diffs.push({ field: label, before: bVal, after: aVal })
  }

  // Categories
  const catsBefore = (before.categories ?? []) as Array<Record<string, unknown>>
  const catsAfter = (after.categories ?? []) as Array<Record<string, unknown>>
  const catFields = [
    'consumerCash', 'consumerTransfer', 'consumerCredit',
    'corporateCash', 'corporateTransfer', 'corporateCredit', 'quantity',
  ]
  const catLabels: Record<string, string> = {
    DHIRAAGU_BILLS: 'Dhiraagu Bills',
    RETAIL_RELOAD: 'Retail Reload',
    WHOLESALE_RELOAD: 'Wholesale Reload',
    SIM: 'SIM',
    USIM: 'USIM',
  }
  const fieldLabels: Record<string, string> = {
    consumerCash: 'Consumer Cash',
    consumerTransfer: 'Consumer Transfer',
    consumerCredit: 'Consumer Credit',
    corporateCash: 'Corporate Cash',
    corporateTransfer: 'Corporate Transfer',
    corporateCredit: 'Corporate Credit',
    quantity: 'Qty',
  }
  for (const catBefore of catsBefore) {
    const catAfter = catsAfter.find((c) => c.category === catBefore.category)
    if (!catAfter) continue
    const catName = catLabels[catBefore.category as string] ?? String(catBefore.category)
    for (const field of catFields) {
      const bVal = Number(catBefore[field] ?? 0)
      const aVal = Number(catAfter[field] ?? 0)
      if (bVal !== aVal) {
        diffs.push({
          field: `${catName} – ${fieldLabels[field] ?? field}`,
          before: bVal,
          after: aVal,
        })
      }
    }
  }

  return diffs
}

interface DiffDialogProps {
  amendment: Amendment
  index: number
  open: boolean
  onClose: () => void
}

function DiffDialog({ amendment, index, open, onClose }: DiffDialogProps) {
  const before = parseSnapshot(amendment.snapshotBefore)
  const after = amendment.snapshotAfter ? parseSnapshot(amendment.snapshotAfter) : null
  const diffs = after ? buildDiff(before, after) : []

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Amendment #{index + 1} – Changes</DialogTitle>
        </DialogHeader>

        {!after ? (
          <p className="text-sm text-muted-foreground">
            This amendment has not been re-submitted yet. No &quot;after&quot; snapshot available.
          </p>
        ) : diffs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No numeric field changes detected.</p>
        ) : (
          <div className="space-y-1">
            <div className="grid grid-cols-3 gap-2 text-xs font-medium text-muted-foreground border-b pb-2 mb-2">
              <span>Field</span>
              <span className="text-right">Before</span>
              <span className="text-right">After</span>
            </div>
            {diffs.map((diff, i) => (
              <div key={i} className="grid grid-cols-3 gap-2 text-sm py-1 border-b last:border-0">
                <span className="text-muted-foreground">{diff.field}</span>
                <span className="text-right font-mono">{Number(diff.before).toLocaleString()}</span>
                <span className={`text-right font-mono font-medium ${diff.after !== diff.before ? 'text-amber-600' : ''}`}>
                  {Number(diff.after).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export interface AmendmentHistoryProps {
  amendments: NonNullable<DailyEntryWithRelations['amendments']>
}

export function AmendmentHistory({ amendments }: AmendmentHistoryProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [diffIndex, setDiffIndex] = useState<number | null>(null)

  if (amendments.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Amendment History</CardTitle>
            <Badge variant="secondary">{amendments.length}</Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed((c) => !c)}
          >
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>

      {!collapsed && (
        <CardContent className="space-y-4 pt-0">
          {amendments.map((amendment, index) => (
            <div key={amendment.id} className="border rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  Amendment #{index + 1}
                </span>
                {amendment.snapshotAfter && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDiffIndex(index)}
                  >
                    <Eye className="mr-1.5 h-3 w-3" />
                    View Changes
                  </Button>
                )}
              </div>

              <div className="text-sm space-y-1 text-muted-foreground">
                <div>
                  <span className="font-medium text-foreground">Reopened by:</span>{' '}
                  {amendment.reopenedByUser.name}{' '}
                  <span className="text-xs">
                    at {format(new Date(amendment.reopenedAt), 'dd MMM yyyy, HH:mm')}
                  </span>
                </div>
                <div className="italic text-foreground/80">
                  Reason: &quot;{amendment.reason}&quot;
                </div>
                {amendment.resubmittedByUser && amendment.resubmittedAt ? (
                  <div>
                    <span className="font-medium text-foreground">Re-submitted by:</span>{' '}
                    {amendment.resubmittedByUser.name}{' '}
                    <span className="text-xs">
                      at {format(new Date(amendment.resubmittedAt), 'dd MMM yyyy, HH:mm')}
                    </span>
                  </div>
                ) : (
                  <div className="text-amber-600 text-xs">Pending re-submission</div>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      )}

      {diffIndex !== null && (
        <DiffDialog
          amendment={amendments[diffIndex]}
          index={diffIndex}
          open={diffIndex !== null}
          onClose={() => setDiffIndex(null)}
        />
      )}
    </Card>
  )
}
