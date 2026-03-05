'use client'

import { Badge } from '@/components/ui/badge'
import type { WalletTopup } from '@/types'

export interface WalletTopupsSectionProps {
  topups: WalletTopup[]
  totalTopups: number
}

export function WalletTopupsSection({ topups, totalTopups }: WalletTopupsSectionProps) {
  if (topups.length === 0) return null

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-muted-foreground">
        Wallet Top-ups ({topups.length})
      </h4>
      <div className="space-y-1">
        {topups.map((topup) => (
          <div key={topup.id} className="flex justify-between text-sm">
            <div className="flex items-center gap-2">
              <Badge
                variant={topup.source === 'CASH' ? 'default' : 'secondary'}
                className="text-xs"
              >
                {topup.source}
              </Badge>
              {topup.notes && (
                <span className="text-muted-foreground text-xs">{topup.notes}</span>
              )}
            </div>
            <span className="font-mono text-emerald-600">
              +{Number(topup.amount).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-sm font-medium pt-1 border-t">
        <span>Total Top-ups</span>
        <span className="font-mono text-emerald-600">+{totalTopups.toLocaleString()} MVR</span>
      </div>
    </div>
  )
}
