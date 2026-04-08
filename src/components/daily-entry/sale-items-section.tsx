"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronUp, List, Trash2, Pencil } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { DeleteLineItemDialog } from "./delete-line-item-dialog"
import { EditLineItemDialog } from "./edit-line-item-dialog"
import type { SaleLineItemData } from "@/types"
import { CATEGORIES, CUSTOMER_TYPES, PAYMENT_METHODS } from "./types"
import { fmtCurrency } from "@/lib/constants"

export interface SaleItemsSectionProps {
  lineItems: SaleLineItemData[]
  isLoading: boolean
  isReadOnly: boolean
  onEditLineItem: (id: string, data: { amount?: number; serviceNumber?: string | null; note?: string | null; reason: string }) => Promise<{ success: boolean; cellTotal?: number; cellCount?: number }>
  onDeleteLineItem: (id: string, reason?: string) => Promise<{ success: boolean; cellTotal?: number; cellCount?: number }>
}

// Human-readable labels
const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c.label])
)
const CUSTOMER_TYPE_LABELS: Record<string, string> = {
  CONSUMER: "Consumer",
  CORPORATE: "Corporate",
}
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  TRANSFER: "Transfer",
}

interface CellGroup {
  key: string
  category: string
  customerType: string
  paymentMethod: string
  items: SaleLineItemData[]
}

export function SaleItemsSection({
  lineItems,
  isLoading,
  isReadOnly,
  onEditLineItem,
  onDeleteLineItem,
}: SaleItemsSectionProps) {
  const [expanded, setExpanded] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [pendingDelete, setPendingDelete] = useState<SaleLineItemData | null>(null)
  const [pendingEdit, setPendingEdit] = useState<SaleLineItemData | null>(null)

  if (isLoading || lineItems.length === 0) return null

  // Group items by cell (category|customerType|paymentMethod)
  const groupMap = new Map<string, CellGroup>()
  for (const item of lineItems) {
    const key = `${item.category}|${item.customerType}|${item.paymentMethod}`
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        key,
        category: item.category,
        customerType: item.customerType,
        paymentMethod: item.paymentMethod,
        items: [],
      })
    }
    groupMap.get(key)!.items.push(item)
  }

  // Sort groups
  const groups = Array.from(groupMap.values()).sort((a, b) => {
    const catOrder = CATEGORIES.findIndex((c) => c.key === a.category) - CATEGORIES.findIndex((c) => c.key === b.category)
    if (catOrder !== 0) return catOrder
    const ctOrder = CUSTOMER_TYPES.findIndex((c) => c.key === a.customerType.toLowerCase()) - CUSTOMER_TYPES.findIndex((c) => c.key === b.customerType.toLowerCase())
    if (ctOrder !== 0) return ctOrder
    return PAYMENT_METHODS.findIndex((p) => p.key === a.paymentMethod.toLowerCase()) - PAYMENT_METHODS.findIndex((p) => p.key === b.paymentMethod.toLowerCase())
  })

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <List className="h-5 w-5" />
            Sale Items
            <Badge variant="secondary" className="text-xs">
              {lineItems.length}
            </Badge>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild aria-label={expanded ? "Collapse sale items" : "Expand sale items"}>
            <span>
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </span>
          </Button>
        </CardTitle>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 space-y-3">
          {groups.map((group) => {
            const isWholesale = group.category === "WHOLESALE_RELOAD"
            const groupTotal = group.items.reduce((sum, item) => {
              // For wholesale, show cash received total; for others, show amount
              return sum + (isWholesale && item.cashAmount != null ? Number(item.cashAmount) : Number(item.amount))
            }, 0)
            const isGroupExpanded = expandedGroups.has(group.key)

            return (
              <div key={group.key} className="rounded-lg border">
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/50 transition-colors"
                  onClick={() => toggleGroup(group.key)}
                >
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">
                      {CATEGORY_LABELS[group.category] || group.category}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {CUSTOMER_TYPE_LABELS[group.customerType] || group.customerType}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-xs",
                        group.paymentMethod === "CASH" && "text-emerald-600",
                        group.paymentMethod === "TRANSFER" && "text-blue-600"
                      )}
                    >
                      {PAYMENT_METHOD_LABELS[group.paymentMethod] || group.paymentMethod}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      ({group.items.length} item{group.items.length !== 1 ? "s" : ""})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-sm">
                      {fmtCurrency(groupTotal)} MVR
                    </span>
                    {isGroupExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </button>

                {isGroupExpanded && (
                  <div className="border-t divide-y text-sm">
                    {group.items
                      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                      .map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30"
                        >
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {format(new Date(item.timestamp), "hh:mm a")}
                          </span>
                          <span className="font-mono font-medium whitespace-nowrap">
                            {fmtCurrency(item.cashAmount != null && group.category === "WHOLESALE_RELOAD"
                              ? Number(item.cashAmount)
                              : Number(item.amount)
                            )} MVR
                          </span>
                          {item.wholesaleCustomer && (
                            <span className="text-xs bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 rounded px-1.5 py-0.5 truncate" title={`${item.wholesaleCustomer.name} (${item.wholesaleCustomer.phone})`}>
                              {item.wholesaleCustomer.name}
                            </span>
                          )}
                          {item.cashAmount != null && item.discountPercent != null && (
                            <span className="text-xs text-muted-foreground whitespace-nowrap" title={`Reload: ${fmtCurrency(Number(item.amount))} MVR, Discount: ${Number(item.discountPercent)}%`}>
                              Reload {fmtCurrency(Number(item.amount))} @ {Number(item.discountPercent)}%
                            </span>
                          )}
                          {item.serviceNumber && (
                            <span className="text-muted-foreground truncate text-xs" title={item.serviceNumber}>
                              #{item.serviceNumber}
                            </span>
                          )}
                          {item.note && (
                            <span className="text-muted-foreground truncate text-xs italic" title={item.note}>
                              {item.note}
                            </span>
                          )}
                          <span className="flex-1" />
                          {!isReadOnly && (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => setPendingEdit(item)}
                                className="text-muted-foreground hover:text-primary transition-colors"
                                title="Edit item"
                                aria-label="Edit item"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setPendingDelete(item)}
                                className="text-destructive/60 hover:text-destructive transition-colors"
                                title="Remove item"
                                aria-label="Remove item"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )
          })}
        </CardContent>
      )}

      <DeleteLineItemDialog
        item={pendingDelete}
        onClose={() => setPendingDelete(null)}
        onDelete={onDeleteLineItem}
      />

      <EditLineItemDialog
        item={pendingEdit}
        onClose={() => setPendingEdit(null)}
        onEdit={onEditLineItem}
      />
    </Card>
  )
}
