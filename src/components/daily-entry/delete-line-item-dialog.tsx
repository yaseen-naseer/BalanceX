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

const DELETE_REASONS = [
  "Wrong amount entered",
  "Duplicate entry",
  "Wrong category selected",
  "Wrong customer type",
  "Wrong payment method",
  "Sale was cancelled/reversed",
] as const

interface DeleteLineItemDialogProps {
  item: SaleLineItemData | null
  onClose: () => void
  onDelete: (id: string, reason?: string) => Promise<{ success: boolean; cellTotal?: number; cellCount?: number }>
}

export function DeleteLineItemDialog({ item, onClose, onDelete }: DeleteLineItemDialogProps) {
  const [deleteReason, setDeleteReason] = useState("")
  const [deleteCustomReason, setDeleteCustomReason] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)

  const finalDeleteReason = deleteReason === "Other" ? deleteCustomReason.trim() : deleteReason

  const handleConfirmDelete = async () => {
    if (!item || !finalDeleteReason) return
    setIsDeleting(true)
    try {
      const result = await onDelete(item.id, finalDeleteReason)
      if (result.success) {
        toast.success("Sale item removed")
        onClose()
        setDeleteReason("")
        setDeleteCustomReason("")
      } else {
        toast.error("Failed to remove sale item")
      }
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <ConfirmDialog
      open={!!item}
      onOpenChange={(open) => {
        if (!open) {
          onClose()
          setDeleteReason("")
          setDeleteCustomReason("")
        }
      }}
      title="Remove Sale Item?"
      description={
        item
          ? `Remove the ${Number(item.amount).toLocaleString()} MVR sale${item.serviceNumber ? ` (#${item.serviceNumber})` : ""}?`
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
  )
}
