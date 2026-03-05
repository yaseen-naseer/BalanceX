'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, AlertCircle, ArrowRight, CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'

export interface AlertItem {
  id: string
  type: string
  priority: string
  message: string
  link: string
  count?: number
  dates?: string[]
}

export interface AlertsSectionProps {
  alerts: AlertItem[]
}

export function AlertsSection({ alerts }: AlertsSectionProps) {
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null)

  if (alerts.length === 0) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        <span className="text-sm">No alerts - everything looks good!</span>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert) => (
        <div key={alert.id}>
          <div
            className={`flex items-center gap-3 rounded-lg border p-3 transition-colors cursor-pointer hover:bg-muted/50 ${
              alert.priority === 'high'
                ? 'border-rose-200 bg-rose-50/50'
                : 'border-amber-200 bg-amber-50/50'
            }`}
            onClick={() => setExpandedAlert(expandedAlert === alert.id ? null : alert.id)}
          >
            <AlertCircle
              className={`h-4 w-4 shrink-0 ${
                alert.priority === 'high' ? 'text-rose-500' : 'text-amber-500'
              }`}
            />
            <span className="flex-1 text-sm">{alert.message}</span>
            {alert.dates && alert.dates.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {alert.dates.length} {alert.dates.length === 1 ? 'date' : 'dates'}
              </Badge>
            )}
            <ArrowRight
              className={`h-4 w-4 text-muted-foreground transition-transform ${
                expandedAlert === alert.id ? 'rotate-90' : ''
              }`}
            />
          </div>
          {expandedAlert === alert.id && alert.dates && alert.dates.length > 0 && (
            <div className="mt-2 ml-7 space-y-1 border-l-2 border-muted pl-4">
              <p className="text-xs text-muted-foreground font-medium mb-2">Affected dates:</p>
              {alert.dates.map((date) => (
                <Link
                  key={date}
                  href={`/daily-entry?date=${date}`}
                  className="flex items-center gap-2 text-sm py-1.5 px-2 rounded hover:bg-muted/50 transition-colors"
                >
                  <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{format(new Date(date), 'EEEE, dd MMM yyyy')}</span>
                  <ArrowRight className="h-3 w-3 ml-auto text-muted-foreground" />
                </Link>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
