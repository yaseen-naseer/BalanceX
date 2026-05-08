'use client'

import { ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { SummaryCardsGrid } from '@/components/shared'

export interface BankSummaryCardsProps {
  monthDeposits: number
  monthWithdrawals: number
  currentBalance: number
  isLoading: boolean
}

export function BankSummaryCards({
  monthDeposits,
  monthWithdrawals,
  currentBalance,
  isLoading,
}: BankSummaryCardsProps) {
  return (
    <SummaryCardsGrid
      cards={[
        {
          title: 'This Month Deposits',
          icon: <ArrowDownRight className="h-4 w-4 text-emerald-500" />,
          value: `+${monthDeposits.toLocaleString()} MVR`,
          valueClassName: 'text-emerald-600',
          isLoading,
        },
        {
          title: 'This Month Withdrawals',
          icon: <ArrowUpRight className="h-4 w-4 text-rose-500" />,
          value: `-${monthWithdrawals.toLocaleString()} MVR`,
          valueClassName: 'text-rose-600',
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
