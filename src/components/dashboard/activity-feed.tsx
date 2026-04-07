'use client'

import { FileSpreadsheet, CreditCard, CheckCircle2, AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'
import { CURRENCY_CODE } from '@/lib/constants'

export interface ActivityItem {
  id: string
  type: string
  description: string
  amount: number
  date: Date
  user: string
}

export interface ActivityFeedProps {
  items: ActivityItem[]
}

export function ActivityFeed({ items }: ActivityFeedProps) {
  const getIcon = (type: string) => {
    switch (type) {
      case 'daily_entry':
        return <FileSpreadsheet className="h-4 w-4 text-primary" />
      case 'credit_sale':
        return <CreditCard className="h-4 w-4 text-amber-500" />
      case 'settlement':
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
      default:
        return <AlertTriangle className="h-4 w-4 text-muted-foreground" />
    }
  }

  if (items.length === 0) {
    return <div className="text-center text-sm text-muted-foreground py-8">No recent activity</div>
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.id} className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full bg-muted p-1.5">{getIcon(item.type)}</div>
          <div className="flex-1 space-y-0.5">
            <p className="text-sm font-medium leading-none">{item.description}</p>
            <p className="text-xs text-muted-foreground">
              {CURRENCY_CODE} {item.amount.toLocaleString()} by {item.user}
            </p>
          </div>
          <span className="text-xs text-muted-foreground">
            {format(new Date(item.date), 'dd MMM, HH:mm')}
          </span>
        </div>
      ))}
    </div>
  )
}
