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
import { Plus, Search, UserPlus } from "lucide-react"
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
import type { SaleLineItemData, CreateSaleLineItemDto, WholesaleCustomerData, WholesaleDiscountTierData } from "@/types"

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
  categoryKey: string
  customerTypeLabel: string
  paymentMethodLabel: string
  onAdd: (amount: number, serviceNumber?: string, note?: string, wholesaleCustomerId?: string, cashAmount?: number, discountPercent?: number) => Promise<boolean>
  disabled?: boolean
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

function AddLineItemPopover({
  categoryLabel,
  categoryKey,
  customerTypeLabel,
  paymentMethodLabel,
  onAdd,
  disabled,
  wholesaleCustomers,
  wholesaleSearch,
  onWholesaleSearchChange,
  onCreateWholesaleCustomer,
  getDiscount,
  calculateReload,
  minCashAmount,
}: AddLineItemPopoverProps) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState("")
  const [cashAmount, setCashAmount] = useState("")
  const [serviceNumber, setServiceNumber] = useState("")
  const [note, setNote] = useState("")
  const [isAdding, setIsAdding] = useState(false)
  // Wholesale customer selection
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState("")
  const [newCustomerPhone, setNewCustomerPhone] = useState("")
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false)

  const isWholesaleReload = categoryKey === "WHOLESALE_RELOAD"
  const selectedCustomer = wholesaleCustomers?.find((c) => c.id === selectedCustomerId)

  // Wholesale calculator: derive discount and reload from cash amount
  const numCashAmount = parseFloat(cashAmount) || 0
  const wholesaleDiscount = isWholesaleReload && getDiscount && selectedCustomer
    ? getDiscount(numCashAmount, selectedCustomer)
    : null
  const wholesaleReloadAmount = isWholesaleReload && wholesaleDiscount != null && calculateReload && numCashAmount > 0
    ? calculateReload(numCashAmount, wholesaleDiscount)
    : null

  const reset = () => {
    setAmount("")
    setCashAmount("")
    setServiceNumber("")
    setNote("")
    setSelectedCustomerId(null)
    setShowNewCustomerForm(false)
    setNewCustomerName("")
    setNewCustomerPhone("")
    onWholesaleSearchChange?.("")
  }

  const handleCreateCustomer = async () => {
    if (!newCustomerName.trim() || !newCustomerPhone.trim()) {
      toast.error("Name and phone are required")
      return
    }
    if (!onCreateWholesaleCustomer) return
    setIsCreatingCustomer(true)
    try {
      const customer = await onCreateWholesaleCustomer({
        name: newCustomerName.trim(),
        phone: newCustomerPhone.trim(),
      })
      if (customer) {
        setSelectedCustomerId(customer.id)
        setShowNewCustomerForm(false)
        setNewCustomerName("")
        setNewCustomerPhone("")
        toast.success("Customer created")
      } else {
        toast.error("Failed to create customer")
      }
    } finally {
      setIsCreatingCustomer(false)
    }
  }

  const handleAdd = async () => {
    if (isWholesaleReload) {
      // Wholesale: validate cash amount and computed reload
      if (!selectedCustomerId) {
        toast.error("Select a customer for wholesale reload")
        return
      }
      if (!numCashAmount || numCashAmount <= 0) {
        toast.error("Enter a valid cash amount")
        return
      }
      if (minCashAmount && numCashAmount < minCashAmount) {
        toast.error(`Minimum cash amount is ${minCashAmount.toLocaleString()} MVR`)
        return
      }
      if (wholesaleDiscount == null) {
        toast.error("Cash amount does not qualify for any discount tier")
        return
      }
      if (!wholesaleReloadAmount) {
        toast.error("Cannot calculate reload amount")
        return
      }
      setIsAdding(true)
      try {
        const success = await onAdd(
          wholesaleReloadAmount,
          serviceNumber || undefined,
          note || undefined,
          selectedCustomerId,
          numCashAmount,
          wholesaleDiscount
        )
        if (success) {
          reset()
          setOpen(false)
          toast.success("Wholesale sale added")
        }
        // Error is already toasted by the caller
      } finally {
        setIsAdding(false)
      }
    } else {
      // Non-wholesale: use plain amount
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
        }
        // Error is already toasted by the caller
      } finally {
        setIsAdding(false)
      }
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
      <PopoverContent className={cn("p-3", isWholesaleReload ? "w-80" : "w-72")} align="start" side="bottom">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">{categoryLabel}</p>
            <p className="text-xs text-muted-foreground">{customerTypeLabel} &middot; {paymentMethodLabel}</p>
          </div>

          {/* Wholesale Customer selector */}
          {isWholesaleReload && wholesaleCustomers && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Customer</label>
              {selectedCustomer ? (
                <div className="flex items-center gap-2 p-2 rounded-md bg-primary/5 border border-primary/20">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{selectedCustomer.name}</p>
                    <p className="text-xs text-muted-foreground">{selectedCustomer.phone}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs shrink-0"
                    onClick={() => setSelectedCustomerId(null)}
                  >
                    Change
                  </Button>
                </div>
              ) : showNewCustomerForm ? (
                <div className="space-y-2 p-2 rounded-md border bg-muted/30">
                  <Input
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    placeholder="Customer name"
                    className="h-7 text-sm"
                    autoFocus
                  />
                  <Input
                    value={newCustomerPhone}
                    onChange={(e) => setNewCustomerPhone(e.target.value)}
                    placeholder="Phone number"
                    className="h-7 text-sm"
                  />
                  <div className="flex gap-1 justify-end">
                    <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setShowNewCustomerForm(false)}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="h-6 text-xs"
                      onClick={handleCreateCustomer}
                      disabled={isCreatingCustomer || !newCustomerName.trim() || !newCustomerPhone.trim()}
                    >
                      {isCreatingCustomer ? "..." : "Create"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={wholesaleSearch || ""}
                      onChange={(e) => onWholesaleSearchChange?.(e.target.value)}
                      placeholder="Search customers..."
                      className="h-8 text-sm pl-7"
                    />
                  </div>
                  <div className="max-h-32 overflow-y-auto rounded-md border">
                    {wholesaleCustomers.length === 0 ? (
                      <p className="text-xs text-muted-foreground p-2 text-center">No customers found</p>
                    ) : (
                      wholesaleCustomers.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className="w-full text-left px-2 py-1.5 text-sm hover:bg-muted/50 transition-colors flex items-center gap-2"
                          onClick={() => setSelectedCustomerId(c.id)}
                        >
                          <div className="flex-1 min-w-0">
                            <span className="font-medium truncate block">{c.name}</span>
                            <span className="text-xs text-muted-foreground">{c.phone}</span>
                          </div>
                          {c.purchaseCount > 0 && (
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {c.purchaseCount} sales
                            </span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-7 text-xs"
                    onClick={() => setShowNewCustomerForm(true)}
                  >
                    <UserPlus className="h-3 w-3 mr-1" />
                    New Customer
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            {isWholesaleReload ? (
              <>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Cash Amount *</label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={cashAmount}
                    onChange={(e) => {
                      if (e.target.value === "" || /^\d*\.?\d*$/.test(e.target.value)) {
                        setCashAmount(e.target.value)
                      }
                    }}
                    placeholder={minCashAmount ? `Min ${minCashAmount}` : "0.00"}
                    className="h-8 text-sm font-mono"
                    onKeyDown={(e) => { if (e.key === "Enter") handleAdd() }}
                  />
                </div>
                {selectedCustomer && numCashAmount > 0 && (
                  <div className="rounded-md bg-muted/50 p-2 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Discount</span>
                      <span className="font-medium">
                        {wholesaleDiscount != null
                          ? `${wholesaleDiscount}%${selectedCustomer.discountOverride != null ? " (fixed)" : ""}`
                          : "Below min threshold"}
                      </span>
                    </div>
                    {wholesaleReloadAmount != null && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Reload Amount</span>
                        <span className="font-mono font-semibold text-primary">
                          {wholesaleReloadAmount.toLocaleString()} MVR
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
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
                  autoFocus={!isWholesaleReload}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAdd() }}
                />
              </div>
            )}
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
              disabled={isAdding || (isWholesaleReload ? (!selectedCustomerId || !wholesaleReloadAmount) : !amount)}
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
