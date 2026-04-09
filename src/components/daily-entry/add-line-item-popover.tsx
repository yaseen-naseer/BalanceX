"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { Plus, Search, UserPlus } from "lucide-react"
import { toast } from "sonner"
import type { WholesaleCustomerData } from "@/types"
import { GST_MULTIPLIER, fmtCurrency } from "@/lib/constants"

export interface AddLineItemPopoverProps {
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

export function AddLineItemPopover({
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
  const isRetailReload = categoryKey === "RETAIL_RELOAD"
  const [retailMode, setRetailMode] = useState<"cash" | "reload">("cash")
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
    setRetailMode("cash")
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
        toast.error(`Minimum cash amount is ${fmtCurrency(minCashAmount)} MVR`)
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
      // Non-wholesale: use plain amount (for retail reload in "reload" mode, convert to cash received)
      const numAmount = parseFloat(amount)
      if (!numAmount || numAmount <= 0) {
        toast.error("Enter a valid amount")
        return
      }
      const saleAmount = isRetailReload && retailMode === "reload"
        ? Math.round(numAmount * GST_MULTIPLIER * 100) / 100
        : Math.round(numAmount * 100) / 100
      setIsAdding(true)
      try {
        const success = await onAdd(
          saleAmount,
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
                          {fmtCurrency(wholesaleReloadAmount)} MVR
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : isRetailReload ? (
              <div className="space-y-2">
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant={retailMode === "cash" ? "default" : "outline"}
                    size="sm"
                    className="flex-1 h-7 text-xs"
                    onClick={() => { setRetailMode("cash"); setAmount("") }}
                  >
                    Cash Received
                  </Button>
                  <Button
                    type="button"
                    variant={retailMode === "reload" ? "default" : "outline"}
                    size="sm"
                    className="flex-1 h-7 text-xs"
                    onClick={() => { setRetailMode("reload"); setAmount("") }}
                  >
                    Reload Amount
                  </Button>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    {retailMode === "cash" ? "Cash Received *" : "Reload Amount *"}
                  </label>
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
                {parseFloat(amount) > 0 && (
                  <div className="rounded-md bg-muted/50 p-2 space-y-1">
                    {retailMode === "cash" ? (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Customer gets (excl. 8% GST)</span>
                        <span className="font-mono font-semibold text-primary">
                          {fmtCurrency(Math.round((parseFloat(amount) / GST_MULTIPLIER) * 100) / 100)} MVR
                        </span>
                      </div>
                    ) : (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Cash to collect (incl. 8% GST)</span>
                        <span className="font-mono font-semibold text-primary">
                          {fmtCurrency(Math.round(parseFloat(amount) * GST_MULTIPLIER * 100) / 100)} MVR
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
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
                  autoFocus
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
