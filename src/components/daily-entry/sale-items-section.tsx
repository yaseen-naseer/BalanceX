"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ChevronDown, ChevronUp, List, Trash2, Pencil } from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import type { SaleLineItemData } from "@/types"
import { CATEGORIES, CUSTOMER_TYPES, PAYMENT_METHODS } from "./types"

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

const DELETE_REASONS = [
  "Wrong amount entered",
  "Duplicate entry",
  "Wrong category selected",
  "Wrong customer type",
  "Wrong payment method",
  "Sale was cancelled/reversed",
] as const

const EDIT_REASONS = [
  "Correcting amount",
  "Correcting service number",
  "Adding missing details",
  "Customer correction",
] as const

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

  // Delete state
  const [pendingDelete, setPendingDelete] = useState<SaleLineItemData | null>(null)
  const [deleteReason, setDeleteReason] = useState("")
  const [deleteCustomReason, setDeleteCustomReason] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)

  // Edit state
  const [pendingEdit, setPendingEdit] = useState<SaleLineItemData | null>(null)
  const [editAmount, setEditAmount] = useState("")
  const [editServiceNumber, setEditServiceNumber] = useState("")
  const [editNote, setEditNote] = useState("")
  const [editReason, setEditReason] = useState("")
  const [editCustomReason, setEditCustomReason] = useState("")
  const [isEditing, setIsEditing] = useState(false)

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

  // Delete handlers
  const finalDeleteReason = deleteReason === "Other" ? deleteCustomReason.trim() : deleteReason

  const handleConfirmDelete = async () => {
    if (!pendingDelete || !finalDeleteReason) return
    setIsDeleting(true)
    try {
      const result = await onDeleteLineItem(pendingDelete.id, finalDeleteReason)
      if (result.success) {
        toast.success("Sale item removed")
        setPendingDelete(null)
        setDeleteReason("")
        setDeleteCustomReason("")
      } else {
        toast.error("Failed to remove sale item")
      }
    } finally {
      setIsDeleting(false)
    }
  }

  // Edit handlers
  const finalEditReason = editReason === "Other" ? editCustomReason.trim() : editReason

  const openEditDialog = (item: SaleLineItemData) => {
    setPendingEdit(item)
    setEditAmount(Number(item.amount).toString())
    setEditServiceNumber(item.serviceNumber || "")
    setEditNote(item.note || "")
    setEditReason("")
    setEditCustomReason("")
  }

  const handleConfirmEdit = async () => {
    if (!pendingEdit || !finalEditReason) return

    const newAmount = parseFloat(editAmount)
    if (!newAmount || newAmount <= 0) {
      toast.error("Enter a valid amount")
      return
    }

    setIsEditing(true)
    try {
      const result = await onEditLineItem(pendingEdit.id, {
        amount: newAmount,
        serviceNumber: editServiceNumber || null,
        note: editNote || null,
        reason: finalEditReason,
      })
      if (result.success) {
        toast.success("Sale item updated")
        setPendingEdit(null)
      } else {
        toast.error("Failed to update sale item")
      }
    } finally {
      setIsEditing(false)
    }
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
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
            <span>
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </span>
          </Button>
        </CardTitle>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 space-y-3">
          {groups.map((group) => {
            const groupTotal = group.items.reduce((sum, item) => sum + Number(item.amount), 0)
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
                      {groupTotal.toLocaleString()} MVR
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
                            {Number(item.amount).toLocaleString()} MVR
                          </span>
                          {item.wholesaleCustomer && (
                            <span className="text-xs bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 rounded px-1.5 py-0.5 truncate" title={`${item.wholesaleCustomer.name} (${item.wholesaleCustomer.phone})`}>
                              {item.wholesaleCustomer.name}
                            </span>
                          )}
                          {item.cashAmount != null && item.discountPercent != null && (
                            <span className="text-xs text-muted-foreground whitespace-nowrap" title={`Cash: ${Number(item.cashAmount).toLocaleString()} MVR, Discount: ${Number(item.discountPercent)}%`}>
                              💵{Number(item.cashAmount).toLocaleString()} @ {Number(item.discountPercent)}%
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
                                onClick={() => openEditDialog(item)}
                                className="text-muted-foreground hover:text-primary transition-colors"
                                title="Edit item"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setPendingDelete(item)
                                  setDeleteReason("")
                                  setDeleteCustomReason("")
                                }}
                                className="text-destructive/60 hover:text-destructive transition-colors"
                                title="Remove item"
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

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null)
            setDeleteReason("")
            setDeleteCustomReason("")
          }
        }}
        title="Remove Sale Item?"
        description={
          pendingDelete
            ? `Remove the ${Number(pendingDelete.amount).toLocaleString()} MVR sale${pendingDelete.serviceNumber ? ` (#${pendingDelete.serviceNumber})` : ""}?`
            : ""
        }
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
        loadingText="Removing..."
        disableConfirm={!finalDeleteReason}
      >
        <div className="space-y-3">
          <Label>Reason for removal *</Label>
          <Select
            value={deleteReason}
            onValueChange={(v) => {
              setDeleteReason(v)
              if (v !== "Other") setDeleteCustomReason("")
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a reason..." />
            </SelectTrigger>
            <SelectContent>
              {DELETE_REASONS.map((reason) => (
                <SelectItem key={reason} value={reason}>{reason}</SelectItem>
              ))}
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
          {deleteReason === "Other" && (
            <Input
              placeholder="Enter reason..."
              value={deleteCustomReason}
              onChange={(e) => setDeleteCustomReason(e.target.value)}
              autoFocus
            />
          )}
        </div>
      </ConfirmDialog>

      {/* Edit Dialog */}
      <ConfirmDialog
        open={!!pendingEdit}
        onOpenChange={(open) => {
          if (!open) setPendingEdit(null)
        }}
        title="Edit Sale Item"
        description={
          pendingEdit
            ? `Editing ${Number(pendingEdit.amount).toLocaleString()} MVR sale${pendingEdit.serviceNumber ? ` (#${pendingEdit.serviceNumber})` : ""}`
            : ""
        }
        confirmLabel="Save Changes"
        variant="default"
        onConfirm={handleConfirmEdit}
        isLoading={isEditing}
        loadingText="Saving..."
        disableConfirm={!finalEditReason || !editAmount || parseFloat(editAmount) <= 0}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Amount (MVR) *</Label>
            <Input
              type="text"
              inputMode="decimal"
              value={editAmount}
              onChange={(e) => {
                if (e.target.value === "" || /^\d*\.?\d*$/.test(e.target.value)) {
                  setEditAmount(e.target.value)
                }
              }}
              placeholder="0.00"
              className="font-mono"
            />
          </div>
          <div className="space-y-2">
            <Label>Service #</Label>
            <Input
              value={editServiceNumber}
              onChange={(e) => setEditServiceNumber(e.target.value)}
              placeholder="e.g. 77xxxxx"
              maxLength={50}
            />
          </div>
          <div className="space-y-2">
            <Label>Note</Label>
            <Input
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              placeholder="Optional note"
              maxLength={500}
            />
          </div>
          <div className="space-y-2">
            <Label>Reason for editing *</Label>
            <Select
              value={editReason}
              onValueChange={(v) => {
                setEditReason(v)
                if (v !== "Other") setEditCustomReason("")
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a reason..." />
              </SelectTrigger>
              <SelectContent>
                {EDIT_REASONS.map((reason) => (
                  <SelectItem key={reason} value={reason}>{reason}</SelectItem>
                ))}
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
            {editReason === "Other" && (
              <Input
                placeholder="Enter reason..."
                value={editCustomReason}
                onChange={(e) => setEditCustomReason(e.target.value)}
                autoFocus
              />
            )}
          </div>
        </div>
      </ConfirmDialog>
    </Card>
  )
}
