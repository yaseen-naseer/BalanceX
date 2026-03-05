"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import type { LucideIcon } from "lucide-react"

/**
 * Props for the StatCard component
 */
export interface StatCardProps {
  /** Card title */
  title: string
  /** Main value to display */
  value: string | number
  /** Optional subtitle/description */
  subtitle?: string
  /** Icon component to display */
  icon?: LucideIcon
  /** Trend information */
  trend?: {
    /** Trend value (percentage or absolute) */
    value: number
    /** Optional label after the value */
    label?: string
    /** Whether value represents percentage change */
    isPercentage?: boolean
  }
  /** Visual variant */
  variant?: "default" | "success" | "warning" | "danger" | "info"
  /** Loading state */
  isLoading?: boolean
  /** Additional CSS classes */
  className?: string
  /** Click handler */
  onClick?: () => void
  /** Make the entire card a link */
  href?: string
}

/**
 * A statistics card component for displaying key metrics.
 *
 * Features:
 * - Multiple visual variants
 * - Trend indicators
 * - Icon support
 * - Loading state
 * - Clickable/linkable
 *
 * @example
 * ```tsx
 * // Basic usage
 * <StatCard
 *   title="Today's Revenue"
 *   value="12,450 MVR"
 *   icon={DollarSign}
 * />
 *
 * // With trend
 * <StatCard
 *   title="Monthly Revenue"
 *   value="156,200 MVR"
 *   trend={{ value: 12.5, label: "from last month", isPercentage: true }}
 *   variant="success"
 * />
 *
 * // Warning variant
 * <StatCard
 *   title="Credit Outstanding"
 *   value="45,000 MVR"
 *   subtitle="8 customers"
 *   variant="warning"
 *   icon={CreditCard}
 * />
 *
 * // With loading state
 * <StatCard
 *   title="Bank Balance"
 *   value={bankBalance}
 *   isLoading={isLoading}
 * />
 * ```
 */
export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = "default",
  isLoading = false,
  className,
  onClick,
  href,
}: StatCardProps) {
  // Variant styling configuration
  const variantConfig = {
    default: {
      card: "bg-card",
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
      valueColor: "text-foreground",
    },
    success: {
      card: "bg-emerald-500/10 border-emerald-500/20",
      iconBg: "bg-emerald-500/20",
      iconColor: "text-emerald-600",
      valueColor: "text-emerald-700",
    },
    warning: {
      card: "bg-amber-500/10 border-amber-500/20",
      iconBg: "bg-amber-500/20",
      iconColor: "text-amber-600",
      valueColor: "text-amber-700",
    },
    danger: {
      card: "bg-rose-500/10 border-rose-500/20",
      iconBg: "bg-rose-500/20",
      iconColor: "text-rose-600",
      valueColor: "text-rose-700",
    },
    info: {
      card: "bg-blue-500/10 border-blue-500/20",
      iconBg: "bg-blue-500/20",
      iconColor: "text-blue-600",
      valueColor: "text-blue-700",
    },
  }

  const config = variantConfig[variant]

  // Trend color based on direction
  const getTrendColor = () => {
    if (!trend) return ""
    if (trend.value > 0) return "text-emerald-600"
    if (trend.value < 0) return "text-rose-600"
    return "text-muted-foreground"
  }

  // Trend icon based on direction - using inline rendering instead of component creation
  const getTrendIconElement = () => {
    if (!trend) return null
    if (trend.value > 0) {
      return <TrendingUp className="mr-1 h-3 w-3" />
    }
    if (trend.value < 0) {
      return <TrendingDown className="mr-1 h-3 w-3" />
    }
    return <Minus className="mr-1 h-3 w-3" />
  }

  // Format trend value
  const formatTrendValue = () => {
    if (!trend) return ""
    const prefix = trend.value > 0 ? "+" : ""
    const suffix = trend.isPercentage ? "%" : ""
    return `${prefix}${Math.abs(trend.value).toFixed(1)}${suffix}`
  }

  // Wrapper element (link or div)
  const isClickable = onClick || href
  const Wrapper = href ? "a" : "div"
  const wrapperProps = href
    ? { href }
    : onClick
      ? { onClick, role: "button", tabIndex: 0 }
      : {}

  return (
    <Card
      className={cn(
        config.card,
        isClickable && "cursor-pointer transition-colors hover:bg-muted/50",
        className
      )}
    >
      <Wrapper {...wrapperProps}>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
          {Icon && (
            <div className={cn("rounded-lg p-2", config.iconBg)}>
              <Icon className={cn("h-4 w-4", config.iconColor)} />
            </div>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <>
              <Skeleton className="h-8 w-24 mb-2" />
              {subtitle && <Skeleton className="h-4 w-16" />}
            </>
          ) : (
            <>
              <div className={cn("text-2xl font-bold", config.valueColor)}>
                {value}
              </div>
              {(subtitle || trend) && (
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  {trend && (
                    <span
                      className={cn(
                        "flex items-center text-xs font-medium",
                        getTrendColor()
                      )}
                    >
                      {getTrendIconElement()}
                      {formatTrendValue()}
                      {trend.label && (
                        <span className="ml-1 text-muted-foreground font-normal">
                          {trend.label}
                        </span>
                      )}
                    </span>
                  )}
                  {subtitle && !trend && (
                    <span className="text-xs text-muted-foreground">
                      {subtitle}
                    </span>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Wrapper>
    </Card>
  )
}

/**
 * Props for the StatCardGrid component
 */
export interface StatCardGridProps {
  /** Child StatCard components */
  children: React.ReactNode
  /** Number of columns (responsive) */
  columns?: 2 | 3 | 4
  /** Additional CSS classes */
  className?: string
}

/**
 * A grid container for StatCard components.
 *
 * @example
 * ```tsx
 * <StatCardGrid columns={4}>
 *   <StatCard title="Revenue" value="12,450" />
 *   <StatCard title="Cash" value="5,200" />
 *   <StatCard title="Bank" value="25,000" />
 *   <StatCard title="Credit" value="8,500" />
 * </StatCardGrid>
 * ```
 */
export function StatCardGrid({
  children,
  columns = 4,
  className,
}: StatCardGridProps) {
  const gridCols = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  }

  return (
    <div className={cn("grid gap-4", gridCols[columns], className)}>
      {children}
    </div>
  )
}

/**
 * Props for CompactStatCard
 */
export interface CompactStatCardProps {
  /** Label text */
  label: string
  /** Value to display */
  value: string | number
  /** Optional icon */
  icon?: LucideIcon
  /** Visual variant */
  variant?: "default" | "success" | "warning" | "danger"
  /** Additional CSS classes */
  className?: string
}

/**
 * A compact inline stat display.
 *
 * @example
 * ```tsx
 * <CompactStatCard
 *   label="Total"
 *   value="12,450 MVR"
 *   icon={DollarSign}
 * />
 * ```
 */
export function CompactStatCard({
  label,
  value,
  icon: Icon,
  variant = "default",
  className,
}: CompactStatCardProps) {
  const variantColors = {
    default: "text-foreground",
    success: "text-emerald-600",
    warning: "text-amber-600",
    danger: "text-rose-600",
  }

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {Icon && (
        <div className="rounded-md bg-muted p-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn("text-lg font-semibold", variantColors[variant])}>
          {value}
        </p>
      </div>
    </div>
  )
}
