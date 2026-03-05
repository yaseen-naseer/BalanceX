'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingUp, TrendingDown } from 'lucide-react'

export interface SummaryCardProps {
  title: string
  value: string
  subtitle?: string
  icon: React.ElementType
  variant?: 'default' | 'success' | 'warning' | 'danger'
  trend?: 'up' | 'down'
  isLoading?: boolean
}

export function SummaryCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'default',
  trend,
  isLoading,
}: SummaryCardProps) {
  const variants = {
    default: '',
    success: 'bg-emerald-50 border-emerald-200',
    warning: 'bg-amber-50 border-amber-200',
    danger: 'bg-rose-50 border-rose-200',
  }

  return (
    <Card className={variants[variant]}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Icon className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-32" />
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{value}</span>
              {trend &&
                (trend === 'up' ? (
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-rose-600" />
                ))}
            </div>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </>
        )}
      </CardContent>
    </Card>
  )
}
