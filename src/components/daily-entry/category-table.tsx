"use client"

import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
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
import { AddLineItemPopover } from "./add-line-item-popover"
import type { SaleLineItemData, CreateSaleLineItemDto, WholesaleCustomerData } from "@/types"
import { fmtCurrency } from "@/lib/constants"

// Maps UI types to API types
function toApiCustomerType(ct: CustomerType): "CONSUMER" | "CORPORATE" {
  return ct === "consumer" ? "CONSUMER" : "CORPORATE"
}

function toApiPaymentMethod(pm: PaymentMethod): "CASH" | "TRANSFER" {
  return pm === "cash" ? "CASH" : "TRANSFER"
}

// ─── Main CategoryTable ────────────────────────────────────────────────

export interface CategoryTableProps {
  localData: LocalEntryData
  totals: TotalsData
  isReadOnly: boolean
  onValueChange: (category: Category, customerType: CustomerType, paymentMethod: PaymentMethod, value: number) => void
  onQuantityChange: (category: Category, value: number) => void
  getCategoryTotal: (category: Category) => number
  // Line item props
  dailyEntryId?: string | null
  hasLineItems?: (category: string, customerType: string, paymentMethod: string) => boolean
  getLineItemsForCell?: (category: string, customerType: string, paymentMethod: string) => SaleLineItemData[]
  getLineItemCount?: (category: string, customerType: string, paymentMethod: string) => number
  onAddLineItem?: (data: CreateSaleLineItemDto) => Promise<{ success: boolean; cellTotal?: number; cellCount?: number; error?: string }>
  onDeleteLineItem?: (id: string) => Promise<{ success: boolean; cellTotal?: number; cellCount?: number }>
  /** Called to ensure a draft entry exists before adding line items. Returns the entry ID or false. */
  onEnsureDraft?: () => Promise<string | false>
  // Wholesale customer props
  wholesaleCustomers?: WholesaleCustomerData[]
  wholesaleSearch?: string
  onWholesaleSearchChange?: (value: string) => void
  onCreateWholesaleCustomer?: (data: { name: string; phone: string }) => Promise<WholesaleCustomerData | null>
  // Wholesale calculator props
  getDiscount?: (cashAmount: number, customer: WholesaleCustomerData | null) => number | null
  calculateReload?: (cashAmount: number, discountPercent: number) => number
  minCashAmount?: number
}

export function CategoryTable({
  localData,
  totals,
  isReadOnly,
  onValueChange,
  onQuantityChange,
  getCategoryTotal,
  dailyEntryId,
  hasLineItems,
  getLineItemsForCell,
  getLineItemCount,
  onAddLineItem,
  onDeleteLineItem,
  onEnsureDraft,
  wholesaleCustomers,
  wholesaleSearch,
  onWholesaleSearchChange,
  onCreateWholesaleCustomer,
  getDiscount,
  calculateReload,
  minCashAmount,
}: CategoryTableProps) {
  // Line item functions are available (props were passed)
  const lineItemFunctionsAvailable = !!(hasLineItems && getLineItemsForCell && getLineItemCount && onAddLineItem && onDeleteLineItem)
  // Entry exists so we can query existing line items
  const lineItemsDataReady = !!(dailyEntryId && lineItemFunctionsAvailable)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sales by Category</CardTitle>
        <CardDescription>
          Enter amounts for each category split by customer type and payment method.
          {lineItemFunctionsAvailable && !isReadOnly && (
            <span className="text-primary ml-1">
              Click + next to a cell to log individual sales.
            </span>
          )}
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
              {CATEGORIES.map((category) => {
                return (
                  <tr key={category.key} className="border-b hover:bg-muted/30">
                    <td className="p-2 font-medium align-top">
                      {category.label}
                    </td>
                    {CUSTOMER_TYPES.map((ct) =>
                      PAYMENT_METHODS.map((pm, pmIndex) => {
                        const key = `${ct.key}${pm.key.charAt(0).toUpperCase() + pm.key.slice(1)}` as keyof typeof localData.categories[Category]
                        const creditCategories = ["DHIRAAGU_BILLS", "WHOLESALE_RELOAD"]
                        const notAllowed =
                          (pm.key === "credit" && !creditCategories.includes(category.key)) ||
                          (ct.key === "corporate" && category.key !== "DHIRAAGU_BILLS")
                        // Credit fields for allowed categories are auto-derived from linked credit sales
                        const isAutoCredit = pm.key === "credit" && creditCategories.includes(category.key)

                        // Check if this cell has line items (only when entry exists)
                        const isNonCreditEditableCell = !notAllowed && !isAutoCredit
                        const cellHasLineItems = lineItemsDataReady && isNonCreditEditableCell &&
                          hasLineItems!(category.key, toApiCustomerType(ct.key), toApiPaymentMethod(pm.key as "cash" | "transfer"))
                        // Show "+" button: functions available, not read-only, not credit column
                        const showAddButton = lineItemFunctionsAvailable && !isReadOnly && isNonCreditEditableCell

                        // Handler that auto-saves draft if needed, then adds the line item
                        const handleAddLineItem = async (amount: number, serviceNumber?: string, note?: string, wholesaleCustomerId?: string, itemCashAmount?: number, itemDiscountPercent?: number) => {
                          let entryId = dailyEntryId
                          // Auto-save draft if entry doesn't exist yet
                          if (!entryId && onEnsureDraft) {
                            const result = await onEnsureDraft()
                            if (!result) {
                              toast.error("Failed to save draft. Please save manually first.")
                              return false
                            }
                            entryId = result
                          }
                          if (!entryId) {
                            toast.error("Save the entry as draft first")
                            return false
                          }
                          const addResult = await onAddLineItem!({
                            dailyEntryId: entryId,
                            category: category.key,
                            customerType: toApiCustomerType(ct.key),
                            paymentMethod: toApiPaymentMethod(pm.key as "cash" | "transfer"),
                            amount,
                            serviceNumber,
                            note,
                            wholesaleCustomerId,
                            cashAmount: itemCashAmount,
                            discountPercent: itemDiscountPercent,
                          })
                          if (!addResult.success && addResult.error) {
                            toast.error(addResult.error)
                          }
                          return addResult.success
                        }

                        return (
                          <td
                            key={`${ct.key}-${pm.key}`}
                            className={cn(
                              "p-1 align-top",
                              ct.key === "consumer" && pmIndex === 0 && "border-l"
                            )}
                          >
                            {notAllowed ? (
                              <div className="h-8 w-24 flex items-center justify-center text-muted-foreground text-sm bg-muted/40 rounded-md">
                                —
                              </div>
                            ) : isAutoCredit ? (
                              <div className="h-8 w-24 flex items-center justify-end px-2 text-sm font-mono text-muted-foreground bg-muted/40 rounded-md border border-dashed">
                                {fmtCurrency((localData.categories[category.key][key] as number) || 0)}
                              </div>
                            ) : (
                              /* Read-only total + add button */
                              <div className="flex items-center gap-1">
                                <div className={cn(
                                  "h-8 w-24 flex items-center justify-end px-2 text-sm font-mono rounded-md",
                                  cellHasLineItems
                                    ? "font-medium bg-primary/5 border border-primary/20"
                                    : "text-muted-foreground bg-muted/20 border border-transparent"
                                )}>
                                  {fmtCurrency((localData.categories[category.key][key] as number) || 0)}
                                  {cellHasLineItems && (
                                    <span className="ml-1 text-[10px] bg-primary/10 text-primary rounded px-1">
                                      {getLineItemCount!(category.key, toApiCustomerType(ct.key), toApiPaymentMethod(pm.key as "cash" | "transfer"))}
                                    </span>
                                  )}
                                </div>
                                {showAddButton && (
                                  <AddLineItemPopover
                                    categoryLabel={category.label}
                                    categoryKey={category.key}
                                    customerTypeLabel={ct.label}
                                    paymentMethodLabel={pm.label}
                                    onAdd={handleAddLineItem}
                                    disabled={isReadOnly}
                                    wholesaleCustomers={category.key === "WHOLESALE_RELOAD" ? wholesaleCustomers : undefined}
                                    wholesaleSearch={category.key === "WHOLESALE_RELOAD" ? wholesaleSearch : undefined}
                                    onWholesaleSearchChange={category.key === "WHOLESALE_RELOAD" ? onWholesaleSearchChange : undefined}
                                    onCreateWholesaleCustomer={category.key === "WHOLESALE_RELOAD" ? onCreateWholesaleCustomer : undefined}
                                    getDiscount={category.key === "WHOLESALE_RELOAD" ? getDiscount : undefined}
                                    calculateReload={category.key === "WHOLESALE_RELOAD" ? calculateReload : undefined}
                                    minCashAmount={category.key === "WHOLESALE_RELOAD" ? minCashAmount : undefined}
                                  />
                                )}
                              </div>
                            )}
                          </td>
                        )
                      })
                    )}
                    <td className="p-1 border-l align-top">
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
                    <td className="p-2 text-right font-mono font-medium border-l align-top">
                      {fmtCurrency(getCategoryTotal(category.key))}
                    </td>
                  </tr>
                )
              })}
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
                        {fmtCurrency(total)}
                      </td>
                    )
                  })
                )}
                <td className="p-2 border-l"></td>
                <td className="p-2 text-right font-mono border-l">
                  {fmtCurrency(totals.totalRevenue)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
