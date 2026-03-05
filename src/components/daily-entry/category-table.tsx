"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  type Category,
  type CustomerType,
  type PaymentMethod,
  type LocalEntryData,
  type TotalsData,
  CATEGORIES,
  CUSTOMER_TYPES,
  PAYMENT_METHODS,
} from "./types"

interface CurrencyInputProps {
  value: number
  onChange: (value: number) => void
  className?: string
  disabled?: boolean
}

function CurrencyInput({ value, onChange, className, disabled }: CurrencyInputProps) {
  const [localValue, setLocalValue] = useState<string>(value === 0 ? "" : value.toString())
  const [isFocused, setIsFocused] = useState(false)

  // Sync from parent only when not focused (i.e. data loaded from server, not user typing)
  useEffect(() => {
    if (!isFocused) {
      setLocalValue(value === 0 ? "" : value.toString())
    }
  }, [value, isFocused])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value
    if (input === "" || /^\d*\.?\d*$/.test(input)) {
      setLocalValue(input)
      if (input !== "" && input !== "." && !input.endsWith(".")) {
        const numValue = parseFloat(input) || 0
        onChange(Math.round(numValue * 100) / 100)
      }
    }
  }

  const handleBlur = () => {
    setIsFocused(false)
    const numValue = parseFloat(localValue) || 0
    onChange(Math.round(numValue * 100) / 100)
    setLocalValue(numValue === 0 ? "" : numValue.toString())
  }

  return (
    <Input
      type="text"
      inputMode="decimal"
      value={localValue}
      onChange={handleChange}
      onFocus={() => setIsFocused(true)}
      onBlur={handleBlur}
      className={cn("text-right font-mono tabular-nums", className)}
      placeholder="0.00"
      disabled={disabled}
    />
  )
}

export interface CategoryTableProps {
  localData: LocalEntryData
  totals: TotalsData
  isReadOnly: boolean
  onValueChange: (category: Category, customerType: CustomerType, paymentMethod: PaymentMethod, value: number) => void
  onQuantityChange: (category: Category, value: number) => void
  getCategoryTotal: (category: Category) => number
}

/**
 * Sales by Category table component.
 * Displays a grid of sales amounts by category, customer type, and payment method.
 */
export function CategoryTable({
  localData,
  totals,
  isReadOnly,
  onValueChange,
  onQuantityChange,
  getCategoryTotal,
}: CategoryTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sales by Category</CardTitle>
        <CardDescription>
          Enter amounts for each category split by customer type and payment method
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="p-2 text-left font-medium text-muted-foreground w-40">Category</th>
                {CUSTOMER_TYPES.map((ct) => (
                  <th key={ct.key} colSpan={3} className="p-2 text-center font-medium border-l">
                    {ct.label}
                  </th>
                ))}
                <th className="p-2 text-center font-medium border-l w-20">Qty</th>
                <th className="p-2 text-right font-medium border-l w-28">Total</th>
              </tr>
              <tr className="border-b bg-muted/50">
                <th className="p-2"></th>
                {CUSTOMER_TYPES.map((ct) =>
                  PAYMENT_METHODS.map((pm) => (
                    <th
                      key={`${ct.key}-${pm.key}`}
                      className={cn(
                        "p-1 text-center text-xs font-medium",
                        pm.color,
                        ct.key === "consumer" && pm.key === "cash" && "border-l"
                      )}
                    >
                      {pm.label}
                    </th>
                  ))
                )}
                <th className="p-2 border-l"></th>
                <th className="p-2 border-l"></th>
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map((category) => (
                <tr key={category.key} className="border-b hover:bg-muted/30">
                  <td className="p-2 font-medium">{category.label}</td>
                  {CUSTOMER_TYPES.map((ct) =>
                    PAYMENT_METHODS.map((pm, pmIndex) => {
                      const key = `${ct.key}${pm.key.charAt(0).toUpperCase() + pm.key.slice(1)}` as keyof typeof localData.categories[Category]
                      const notAllowed =
                        (pm.key === 'credit' && category.key !== 'DHIRAAGU_BILLS') ||
                        (ct.key === 'corporate' && category.key !== 'DHIRAAGU_BILLS')
                      return (
                        <td
                          key={`${ct.key}-${pm.key}`}
                          className={cn("p-1", ct.key === "consumer" && pmIndex === 0 && "border-l")}
                        >
                          {notAllowed ? (
                            <div className="h-8 w-24 flex items-center justify-center text-muted-foreground text-sm bg-muted/40 rounded-md">
                              —
                            </div>
                          ) : (
                            <CurrencyInput
                              value={localData.categories[category.key][key] as number}
                              onChange={(v) => onValueChange(category.key, ct.key, pm.key, v)}
                              className="h-8 text-sm w-24"
                              disabled={isReadOnly}
                            />
                          )}
                        </td>
                      )
                    })
                  )}
                  <td className="p-1 border-l">
                    {category.hasQuantity ? (
                      <Input
                        type="number"
                        min="0"
                        value={localData.categories[category.key].quantity || ""}
                        onChange={(e) => onQuantityChange(category.key, parseInt(e.target.value) || 0)}
                        className="h-8 text-sm w-16 text-center"
                        placeholder="0"
                        disabled={isReadOnly}
                      />
                    ) : (
                      <span className="text-muted-foreground text-center block">-</span>
                    )}
                  </td>
                  <td className="p-2 text-right font-mono font-medium border-l">
                    {getCategoryTotal(category.key).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-muted/50 font-semibold">
                <td className="p-2">TOTAL</td>
                {CUSTOMER_TYPES.map((ct) =>
                  PAYMENT_METHODS.map((pm, pmIndex) => {
                    const key = `${ct.key}${pm.key.charAt(0).toUpperCase() + pm.key.slice(1)}` as keyof typeof localData.categories[Category]
                    const total = CATEGORIES.reduce(
                      (sum, cat) => sum + (localData.categories[cat.key][key] as number),
                      0
                    )
                    return (
                      <td
                        key={`total-${ct.key}-${pm.key}`}
                        className={cn(
                          "p-2 text-right font-mono",
                          pm.color,
                          ct.key === "consumer" && pmIndex === 0 && "border-l"
                        )}
                      >
                        {total.toLocaleString()}
                      </td>
                    )
                  })
                )}
                <td className="p-2 border-l"></td>
                <td className="p-2 text-right font-mono border-l">
                  {totals.totalRevenue.toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
