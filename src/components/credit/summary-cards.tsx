'use client'

import { fmtCurrency } from '@/lib/constants'
import { SummaryCardsGrid } from '@/components/shared'
import type { CreditCustomerWithBalance } from '@/types'

export interface CreditSummaryCardsProps {
  customers: CreditCustomerWithBalance[]
  isLoading: boolean
}

export function CreditSummaryCards({ customers, isLoading }: CreditSummaryCardsProps) {
  const totalOutstanding = customers.reduce((sum, c) => sum + c.outstandingBalance, 0)
  const consumerOutstanding = customers
    .filter((c) => c.type === 'CONSUMER')
    .reduce((sum, c) => sum + c.outstandingBalance, 0)
  const corporateOutstanding = customers
    .filter((c) => c.type === 'CORPORATE')
    .reduce((sum, c) => sum + c.outstandingBalance, 0)

  const consumerCount = customers.filter((c) => c.type === 'CONSUMER').length
  const corporateCount = customers.filter((c) => c.type === 'CORPORATE').length

  return (
    <SummaryCardsGrid
      cards={[
        {
          title: 'Total Outstanding',
          value: `${fmtCurrency(totalOutstanding)} MVR`,
          valueClassName: totalOutstanding > 0 ? 'text-rose-600' : 'text-emerald-600',
          cardClassName: totalOutstanding > 0 ? 'bg-rose-50 border-rose-200' : '',
          subtitle: `${customers.length} customers`,
          isLoading,
        },
        {
          title: 'Consumer Outstanding',
          value: `${fmtCurrency(consumerOutstanding)} MVR`,
          valueClassName: consumerOutstanding > 0 ? 'text-amber-600' : 'text-emerald-600',
          cardClassName: consumerOutstanding > 0 ? 'bg-amber-50 border-amber-200' : '',
          subtitle: `${consumerCount} consumers`,
          isLoading,
        },
        {
          title: 'Corporate Outstanding',
          value: `${fmtCurrency(corporateOutstanding)} MVR`,
          valueClassName: corporateOutstanding > 0 ? 'text-blue-600' : 'text-emerald-600',
          cardClassName: corporateOutstanding > 0 ? 'bg-blue-50 border-blue-200' : '',
          subtitle: `${corporateCount} corporates`,
          isLoading,
        },
      ]}
    />
  )
}
