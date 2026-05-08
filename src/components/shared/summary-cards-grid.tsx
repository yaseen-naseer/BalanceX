"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export interface SummaryCard {
  title: string
  /** Pre-formatted value (caller is responsible for currency / sign formatting). */
  value: string | React.ReactNode
  isLoading?: boolean
  /** Optional CSS classes applied to the rendered value (color/size overrides). */
  valueClassName?: string
  /** Optional CSS classes applied to the Card wrapper (background tint, border tint). */
  cardClassName?: string
  /** Optional CSS classes for the loading skeleton (e.g. lighter on dark bg). */
  skeletonClassName?: string
  /** Optional CSS classes for the title row (e.g. `opacity-80` on a dark-bg card). */
  titleClassName?: string
  /** Optional inline icon rendered before the title. */
  icon?: React.ReactNode
  /** Optional small text below the value. */
  subtitle?: string
}

export interface SummaryCardsGridProps {
  cards: SummaryCard[]
  /** Defaults to 3, matching the existing wallet/bank/credit layouts. */
  columns?: 2 | 3 | 4
  className?: string
}

/**
 * Configurable 3-up summary card grid used by wallet, bank, and credit pages.
 * Lighter-weight than `<StatCard />`: takes pre-formatted values + arbitrary
 * tailwind classes, so callers preserve their existing color schemes (the
 * wallet/bank "primary highlight" card and credit's amount-driven tints).
 */
export function SummaryCardsGrid({ cards, columns = 3, className }: SummaryCardsGridProps) {
  const gridCols = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "md:grid-cols-3",
    4: "md:grid-cols-4",
  }
  return (
    <div className={cn("grid gap-4", gridCols[columns], className)}>
      {cards.map((card, i) => (
        <Card key={i} className={card.cardClassName}>
          <CardHeader className="pb-2">
            <CardTitle
              className={cn(
                "text-sm font-medium text-muted-foreground flex items-center gap-2",
                card.titleClassName,
              )}
            >
              {card.icon}
              {card.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {card.isLoading ? (
              <Skeleton className={cn("h-8 w-24", card.skeletonClassName)} />
            ) : (
              <span className={cn("text-2xl font-bold", card.valueClassName)}>{card.value}</span>
            )}
            {card.subtitle && !card.isLoading && (
              <p className="text-xs text-muted-foreground mt-1">{card.subtitle}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
