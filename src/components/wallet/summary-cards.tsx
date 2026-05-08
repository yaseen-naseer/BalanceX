'use client'

import { SummaryCardsGrid } from '@/components/shared'

export interface WalletSummaryCardsProps {
  totalTopupsThisMonth: number
  monthlyUsage: number
  currentBalance: number
  isLoading: boolean
}

export function WalletSummaryCards({
  totalTopupsThisMonth,
  monthlyUsage,
  currentBalance,
  isLoading,
}: WalletSummaryCardsProps) {
  return (
    <SummaryCardsGrid
      cards={[
        {
          title: 'This Month Top-ups',
          value: `+${totalTopupsThisMonth.toLocaleString()} MVR`,
          valueClassName: 'text-emerald-600',
          isLoading,
        },
        {
          title: 'This Month Usage',
          value: `-${monthlyUsage.toLocaleString()} MVR`,
          valueClassName: 'text-rose-600',
          subtitle: 'Retail + Wholesale Reload Sales',
          isLoading,
        },
        {
          title: 'Current Balance',
          value: `${currentBalance.toLocaleString()} MVR`,
          cardClassName: 'bg-primary text-primary-foreground',
          titleClassName: 'opacity-80',
          skeletonClassName: 'bg-primary-foreground/20',
          isLoading,
        },
      ]}
    />
  )
}
