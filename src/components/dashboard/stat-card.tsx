'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingUp, TrendingDown } from 'lucide-react'

export interface StatCardProps {
  title: string
  value: string
  description?: string
  icon: React.ElementType
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  variant?: 'default' | 'success' | 'warning' | 'danger'
  isLoading?: boolean
}

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  trendValue,
  variant = 'default',
  isLoading = false,
}: StatCardProps) {
  const variantStyles = {
    default: 'bg-card',
    success: 'bg-secondary/10 border-secondary/20',
    warning: 'bg-amber-500/10 border-amber-500/20',
    danger: 'bg-rose-500/10 border-rose-500/20',
  }

  const iconStyles = {
    default: 'bg-primary/10 text-primary',
    success: 'bg-secondary/20 text-secondary-foreground',
    warning: 'bg-amber-500/20 text-amber-600',
    danger: 'bg-rose-500/20 text-rose-600',
  }

  return (
    <Card className={variantStyles[variant]}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</CardTitle>
        <div className={`rounded-xl p-2.5 ${iconStyles[variant]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <>
            <div className="text-3xl font-extrabold tracking-tight">{value}</div>
            {(description || trendValue) && (
              <div className="mt-2 flex items-center gap-2">
                {trend && trendValue && (
                  <span
                    className={`flex items-center text-xs font-extrabold ${trend === 'up'
                        ? 'text-secondary-foreground'
                        : trend === 'down'
                          ? 'text-rose-500'
                          : 'text-muted-foreground'
                      }`}
                  >
                    {trend === 'up' ? (
                      <TrendingUp className="mr-1 h-3 w-3" />
                    ) : trend === 'down' ? (
                      <TrendingDown className="mr-1 h-3 w-3" />
                    ) : null}
                    {trendValue}
                  </span>
                )}
                {description && <span className="text-xs font-medium text-muted-foreground">{description}</span>}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
