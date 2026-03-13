"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { Plus } from "lucide-react"
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
import type { SaleLineItemData, CreateSaleLineItemDto } from "@/types"

// ─── CurrencyInput (unchanged) ────────────────────────────────────────

interface CurrencyInputProps {
  value: number
  onChange: (value: number) => void
  className?: string
  disabled?: boolean
}

function CurrencyInput({ value, onChange, className, disabled }: CurrencyInputProps) {
  const [localValue, setLocalValue] = useState<string>(value === 0 ? "" : value.toString())
  const [isFocused, setIsFocused] = useState(false)

  useEffect(() => {
    if (!isFocused) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

// ─── AddLineItemPopover ────────────────────────────────────────────────

interface AddLineItemPopoverProps {
  categoryLabel: string
  customerTypeLabel: string
  paymentMethodLabel: string
  onAdd: (amount: number, serviceNumber?: string, note?: string) => Promise<boolean>
  disabled?: boolean
}

function AddLineItemPopover({
  categoryLabel,
  customerTypeLabel,
  paymentMethodLabel,
  onAdd,
  disabled,
}: AddLineItemPopoverProps) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState("")
  const [serviceNumber, setServiceNumber] = useState("")
  const [note, setNote] = useState("")
  const [isAdding, setIsAdding] = useState(false)

  const reset = () => {
    setAmount("")
    setServiceNumber("")
    setNote("")
  }

  const handleAdd = async () => {
    const numAmount = parseFloat(amount)
    if (!numAmount || numAmount <= 0) {
      toast.error("Enter a valid amount")
      return
    }
    setIsAdding(true)
    try {
      const success = await onAdd(
        Math.round(numAmount * 100) / 100,
        serviceNumber || undefined,
        note || undefined
      )
      if (success) {
        reset()
        setOpen(false)
        toast.success("Sale added")
      } else {
        toast.error("Failed to add sale")
      }
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "shrink-0 h-6 w-6 rounded bg-primary/10 text-primary",
            "flex items-center justify-center hover:bg-primary/20 transition-colors",
            disabled && "hidden"
          )}
          tabIndex={-1}
          title="Add individual sale"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start" side="bottom">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">{categoryLabel}</p>
            <p className="text-xs text-muted-foreground">{customerTypeLabel} &middot; {paymentMethodLabel}</p>
          </div>
          <div className="space-y-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Amount *</label>
              <Input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => {
                  if (e.target.value === "" || /^\d*\.?\d*$/.test(e.target.value)) {
                    setAmount(e.target.value)
                  }
                }}
                placeholder="0.00"
                className="h-8 text-sm font-mono"
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") handleAdd() }}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Service #</label>
              <Input
                value={serviceNumber}
                onChange={(e) => setServiceNumber(e.target.value)}
                placeholder="e.g. 77xxxxx"
                className="h-8 text-sm"
                maxLength={50}
                onKeyDown={(e) => { if (e.key === "Enter") handleAdd() }}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Note</label>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional note"
                className="h-8 text-sm"
                maxLength={500}
                onKeyDown={(e) => { if (e.key === "Enter") handleAdd() }}
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { reset(); setOpen(false) }}
              className="h-7 text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={isAdding || !amount}
              className="h-7 text-xs"
            >
              {isAdding ? "Adding..." : "Add Sale"}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
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
  onAddLineItem?: (data: CreateSaleLineItemDto) => Promise<{ success: boolean; cellTotal?: number; cellCount?: number }>
  onDeleteLineItem?: (id: string) => Promise<{ success: boolean; cellTotal?: number; cellCount?: number }>
  /** Called to ensure a draft entry exists before adding line items. Returns the entry ID or false. */
  onEnsureDraft?: () => Promise<string | false>
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
}: CategoryTableProps) {
  // Line item functions are available (props were passed)
  const lineItemFunctionsAvailable = !!(hasLineItems && getLineItemsForCell && getLineItemCount && onAddLineItem && onDeleteLineItem)
  // Entry exists so we can query existing line items
  const lineItemsDataReady = !!(dailyEntryId && lineItemFunctionsAvailable)

  // Maps UI types to API types
  const toApiCustomerType = (ct: CustomerType): "CONSUMER" | "CORPORATE" =>
    ct === "consumer" ? "CONSUMER" : "CORPORATE"

  const toApiPaymentMethod = (pm: PaymentMethod): "CASH" | "TRANSFER" =>
    pm === "cash" ? "CASH" : "TRANSFER"

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
                        const handleAddLineItem = async (amount: number, serviceNumber?: string, note?: string) => {
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
                          })
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
                                {((localData.categories[category.key][key] as number) || 0).toLocaleString()}
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
                                  {((localData.categories[category.key][key] as number) || 0).toLocaleString()}
                                  {cellHasLineItems && (
                                    <span className="ml-1 text-[10px] bg-primary/10 text-primary rounded px-1">
                                      {getLineItemCount!(category.key, toApiCustomerType(ct.key), toApiPaymentMethod(pm.key as "cash" | "transfer"))}
                                    </span>
                                  )}
                                </div>
                                {showAddButton && (
                                  <AddLineItemPopover
                                    categoryLabel={category.label}
                                    customerTypeLabel={ct.label}
                                    paymentMethodLabel={pm.label}
                                    onAdd={handleAddLineItem}
                                    disabled={isReadOnly}
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
                      {getCategoryTotal(category.key).toLocaleString()}
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
