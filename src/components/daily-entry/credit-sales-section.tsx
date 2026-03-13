"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Users, Trash2, ChevronDown, ChevronUp } from "lucide-react"
import { toast } from "sonner"
import { CreditSaleDialog } from "@/components/credit/credit-sale-dialog"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import type { DailyEntryWithRelations } from "@/types"

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
  const [expanded, setExpanded] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<{
    id: string
    customerName: string
    amount: number
  } | null>(null)
  const [deleteReason, setDeleteReason] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDeleteCreditSale = async () => {
    if (!pendingDelete) return
    if (!deleteReason.trim()) {
      toast.error("Please provide a reason for removing this credit sale")
      return
    }
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/credit-sales?id=${pendingDelete.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: deleteReason.trim() }),
      })
      const data = await response.json()
      if (data.success) {
        toast.success("Credit sale removed")
        setPendingDelete(null)
        setDeleteReason("")
        onRefreshEntry()
      } else {
        toast.error(data.error || "Failed to remove credit sale")
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
                  <span className="font-mono font-semibold text-amber-600">
                    {Number(sale.amount).toLocaleString()} MVR
                  </span>
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
                    {linkedConsumerCreditTotal.toLocaleString()} MVR
                  </span>
                </div>
              )}
              {linkedCorporateCreditTotal > 0 && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <span>Corporate:</span>
                  <span className="font-mono font-semibold text-foreground">
                    {linkedCorporateCreditTotal.toLocaleString()} MVR
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
        onOpenChange={(open) => { if (!open) { setPendingDelete(null); setDeleteReason("") } }}
        title="Remove Credit Sale?"
        description={
          pendingDelete
            ? `Remove the ${pendingDelete.amount.toLocaleString()} MVR credit sale for ${pendingDelete.customerName}? This will reduce their outstanding balance.`
            : ''
        }
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={handleDeleteCreditSale}
        isLoading={isDeleting}
        loadingText="Removing..."
        disableConfirm={!deleteReason.trim()}
      >
        <div className="space-y-2">
          <Label htmlFor="delete-reason">Reason for removal *</Label>
          <Textarea
            id="delete-reason"
            placeholder="e.g. Entered wrong amount, duplicate entry..."
            value={deleteReason}
            onChange={(e) => setDeleteReason(e.target.value)}
            rows={3}
          />
        </div>
      </ConfirmDialog>
    </Card>
  )
}
