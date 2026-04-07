"use client"

import { useState } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import type { SaleLineItemData } from "@/types"

const EDIT_REASONS = [
  "Correcting amount",
  "Correcting service number",
  "Adding missing details",
  "Customer correction",
] as const

interface EditLineItemDialogProps {
  item: SaleLineItemData | null
  onClose: () => void
  onEdit: (id: string, data: { amount?: number; serviceNumber?: string | null; note?: string | null; reason: string }) => Promise<{ success: boolean; cellTotal?: number; cellCount?: number }>
}

export function EditLineItemDialog({ item, onClose, onEdit }: EditLineItemDialogProps) {
  const [editAmount, setEditAmount] = useState("")
  const [editServiceNumber, setEditServiceNumber] = useState("")
  const [editNote, setEditNote] = useState("")
  const [editReason, setEditReason] = useState("")
  const [editCustomReason, setEditCustomReason] = useState("")
  const [isEditing, setIsEditing] = useState(false)

  const finalEditReason = editReason === "Other" ? editCustomReason.trim() : editReason

  // Reset fields when item changes
  const openItem = item
  if (openItem && editAmount === "" && !isEditing) {
    // Initialize on first render with this item
    setTimeout(() => {
      setEditAmount(Number(openItem.amount).toString())
      setEditServiceNumber(openItem.serviceNumber || "")
      setEditNote(openItem.note || "")
      setEditReason("")
      setEditCustomReason("")
    }, 0)
  }

  const handleConfirmEdit = async () => {
    if (!item || !finalEditReason) return

    const newAmount = parseFloat(editAmount)
    if (!newAmount || newAmount <= 0) {
      toast.error("Enter a valid amount")
      return
    }

    setIsEditing(true)
    try {
      const result = await onEdit(item.id, {
        amount: newAmount,
        serviceNumber: editServiceNumber || null,
        note: editNote || null,
        reason: finalEditReason,
      })
      if (result.success) {
        toast.success("Sale item updated")
        onClose()
      } else {
        toast.error("Failed to update sale item")
      }
    } finally {
      setIsEditing(false)
    }
  }

  return (
    <ConfirmDialog
      open={!!item}
      onOpenChange={(open) => {
        if (!open) {
          onClose()
          setEditAmount("")
          setEditReason("")
          setEditCustomReason("")
        }
      }}
      title="Edit Sale Item"
      description={
        item
          ? `Editing ${Number(item.amount).toLocaleString()} MVR sale${item.serviceNumber ? ` (#${item.serviceNumber})` : ""}`
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
  )
}
