"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Users, Trash2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { CreditSaleDialog } from "@/components/credit/credit-sale-dialog"
import type { DailyEntryWithRelations } from "@/types"

export interface CreditSalesSectionProps {
  entry: DailyEntryWithRelations | null
  currentDate: string
  gridCreditTotal: number
  linkedCreditTotal: number
  creditBalanced: boolean
  isReadOnly: boolean
  onRefreshEntry: () => Promise<void>
  onSaveDraft: () => Promise<string | false>
}

/**
 * Credit Sales section component.
 * Displays linked credit sales for the daily entry.
 */
export function CreditSalesSection({
  entry,
  currentDate,
  gridCreditTotal,
  linkedCreditTotal,
  creditBalanced,
  isReadOnly,
  onRefreshEntry,
  onSaveDraft,
}: CreditSalesSectionProps) {
  const handleDeleteCreditSale = async (saleId: string) => {
    try {
      const response = await fetch(`/api/credit-sales?id=${saleId}`, {
        method: "DELETE",
      })
      const data = await response.json()
      if (data.success) {
        toast.success("Credit sale removed")
        onRefreshEntry()
      } else {
        toast.error(data.error || "Failed to remove credit sale")
      }
    } catch {
      toast.error("Failed to remove credit sale")
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Credit Sales
          </CardTitle>
          <CardDescription>
            Linked credit sales for this day (goes to Dhiraagu Bills)
          </CardDescription>
        </div>
        <div className="flex items-center gap-3">
          {/* Credit Balance Indicator */}
          {(gridCreditTotal > 0 || linkedCreditTotal > 0) && (
            <Badge
              variant={creditBalanced ? "default" : "destructive"}
              className={cn("gap-1", creditBalanced && "bg-emerald-600")}
            >
              {creditBalanced ? (
                <>
                  <CheckCircle2 className="h-3 w-3" /> Credit Balanced
                </>
              ) : (
                <>
                  <XCircle className="h-3 w-3" /> Credit Mismatch
                </>
              )}
            </Badge>
          )}
          <CreditSaleDialog
            dailyEntryId={entry?.id || null}
            onSaleAdded={() => onRefreshEntry()}
            onSaveDraft={onSaveDraft}
            disabled={isReadOnly}
          />
        </div>
      </CardHeader>
      <CardContent>
        {entry?.creditSales && entry.creditSales.length > 0 ? (
          <div className="space-y-3">
            {entry.creditSales.map((sale) => (
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
                      onClick={() => handleDeleteCreditSale(sale.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            <Separator />
            <div className="flex items-center justify-between pt-2">
              <div className="text-sm text-muted-foreground">
                Grid Credit Total:{" "}
                <span className="font-mono font-medium">{gridCreditTotal.toLocaleString()} MVR</span>
              </div>
              <div className="text-sm">
                Linked Total:{" "}
                <span className="font-mono font-semibold text-amber-600">
                  {linkedCreditTotal.toLocaleString()} MVR
                </span>
              </div>
            </div>
            {!creditBalanced && (
              <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-700">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <p>
                  The credit amounts in the grid ({gridCreditTotal.toLocaleString()} MVR) don&apos;t
                  match the linked credit sales ({linkedCreditTotal.toLocaleString()} MVR).
                  {gridCreditTotal > linkedCreditTotal
                    ? " Add more credit sales or reduce grid values."
                    : " Remove credit sales or increase grid values."}
                </p>
              </div>
            )}
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
      </CardContent>
    </Card>
  )
}
