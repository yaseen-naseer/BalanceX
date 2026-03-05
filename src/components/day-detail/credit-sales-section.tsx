'use client'

interface CreditSale {
  id: string
  amount: number | string
  customer: {
    name: string
  }
}

export interface CreditSalesSectionProps {
  creditSales: CreditSale[]
}

export function CreditSalesSection({ creditSales }: CreditSalesSectionProps) {
  if (!creditSales || creditSales.length === 0) return null

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-muted-foreground">
        Credit Sales ({creditSales.length})
      </h4>
      <div className="space-y-1">
        {creditSales.map((sale) => (
          <div key={sale.id} className="flex justify-between text-sm">
            <span>{sale.customer.name}</span>
            <span className="font-mono">{Number(sale.amount).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
