"use client"

import { useState } from "react"
import { useApiClient } from "@/hooks/use-api-client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Users, Trash2, ChevronDown, ChevronUp } from "lucide-react"
import { toast } from "sonner"
import { CreditSaleDialog } from "@/components/credit/credit-sale-dialog"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { CURRENCY_CODE } from "@/lib/constants"
import type { DailyEntryWithRelations } from "@/types"

const DELETE_REASONS = [
  "Wrong amount entered",
  "Duplicate entry",
  "Wrong category selected",
  "Wrong customer type",
  "Sale was cancelled/reversed",
] as const

export interface CreditSalesSectionProps {
  entry: DailyEntryWithRelations | null
  linkedConsumerCreditTotal: number
  linkedCorporateCreditTotal: number
  isReadOnly: boolean
  onRefreshEntry: () => Promise<void>
  onSaveDraft: () => Promise<string | false>
}

/**
 * Credit Sales section component.
 * Displays linked credit sales for the daily entry.
 * Consumer/corporate credit grid values are auto-derived from these sales.
 */
export function CreditSalesSection({
  entry,
  linkedConsumerCreditTotal,
  linkedCorporateCreditTotal,
  isReadOnly,
  onRefreshEntry,
  onSaveDraft,
}: CreditSalesSectionProps) {
  const api = useApiClient()
  const [expanded, setExpanded] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<{
    id: string
    customerName: string
    amount: number
  } | null>(null)
  const [deleteReason, setDeleteReason] = useState("")
  const [deleteCustomReason, setDeleteCustomReason] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)

  const finalDeleteReason = deleteReason === "Other" ? deleteCustomReason.trim() : deleteReason

  const handleDeleteCreditSale = async () => {
    if (!pendingDelete) return
    if (!finalDeleteReason) {
      toast.error("Please provide a reason for removing this credit sale")
      return
    }
    setIsDeleting(true)
    try {
      const result = await api.delete("/api/credit-sales", {
        params: { id: pendingDelete.id },
        body: { reason: finalDeleteReason },
      })
      if (result.success) {
        toast.success("Credit sale removed")
        setPendingDelete(null)
        setDeleteReason("")
        setDeleteCustomReason("")
        onRefreshEntry()
      } else {
        toast.error(result.error || "Failed to remove credit sale")
      }
    } catch {
      toast.error("Failed to remove credit sale")
    } finally {
      setIsDeleting(false)
    }
  }

  const hasSales = entry?.creditSales && entry.creditSales.length > 0

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div
          className="flex-1 cursor-pointer select-none"
          onClick={() => setExpanded(!expanded)}
        >
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Credit Sales
            {hasSales && (
              <Badge variant="secondary" className="text-xs">
                {entry!.creditSales.length}
              </Badge>
            )}
          </CardTitle>
        </div>
        <div className="flex items-center gap-1">
          <CreditSaleDialog
            dailyEntryId={entry?.id || null}
            onSaleAdded={() => onRefreshEntry()}
            onSaveDraft={onSaveDraft}
            disabled={isReadOnly}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setExpanded(!expanded)}
            aria-label={expanded ? "Collapse credit sales" : "Expand credit sales"}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {expanded && <CardContent>
        {hasSales ? (
          <div className="space-y-3">
            {entry!.creditSales.map((sale) => (
              <div
                key={sale.id}
                className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100">
                    <Users className="h-4 w-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-medium">{sale.customer.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-xs">
                        {sale.customer.type === "CORPORATE" ? "Corporate" : "Consumer"}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {sale.category === "WHOLESALE_RELOAD" ? "Wholesale" : "Bills"}
                      </Badge>
                      {sale.reference && <span>Ref: {sale.reference}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {sale.cashAmount != null ? (
                    <div className="text-right">
                      <span className="font-mono font-semibold text-amber-600">
                        {Number(sale.cashAmount).toLocaleString()} {CURRENCY_CODE}
                      </span>
                      <span className="block text-[10px] text-muted-foreground">
                        {Number(sale.amount).toLocaleString()} reload @ {Number(sale.discountPercent)}%
                      </span>
                    </div>
                  ) : (
                    <span className="font-mono font-semibold text-amber-600">
                      {Number(sale.amount).toLocaleString()} {CURRENCY_CODE}
                    </span>
                  )}
                  {!isReadOnly && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-rose-600"
                      onClick={() => setPendingDelete({
                        id: sale.id,
                        customerName: sale.customer.name,
                        amount: Number(sale.amount),
                      })}
                      aria-label={`Delete credit sale for ${sale.customer.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            <Separator />
            <div className="flex items-center justify-end gap-6 pt-1 text-sm">
              {linkedConsumerCreditTotal > 0 && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <span>Consumer:</span>
                  <span className="font-mono font-semibold text-foreground">
                    {linkedConsumerCreditTotal.toLocaleString()} {CURRENCY_CODE}
                  </span>
                </div>
              )}
              {linkedCorporateCreditTotal > 0 && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <span>Corporate:</span>
                  <span className="font-mono font-semibold text-foreground">
                    {linkedCorporateCreditTotal.toLocaleString()} {CURRENCY_CODE}
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <Users className="h-12 w-12 opacity-20 mb-2" />
            <p className="text-sm">No credit sales linked</p>
            <p className="text-xs mt-1">
              Click &quot;Add Credit Sale&quot; to link customer credit sales
            </p>
          </div>
        )}
      </CardContent>}

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => { if (!open) { setPendingDelete(null); setDeleteReason(""); setDeleteCustomReason("") } }}
        title="Remove Credit Sale?"
        description={
          pendingDelete
            ? `Remove the ${pendingDelete.amount.toLocaleString()} ${CURRENCY_CODE} credit sale for ${pendingDelete.customerName}? This will reduce their outstanding balance.`
            : ''
        }
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={handleDeleteCreditSale}
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
    </Card>
  )
}
