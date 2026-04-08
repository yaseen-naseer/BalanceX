"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CheckCircle2, AlertCircle, XCircle, Wallet } from "lucide-react"
import { fmtCurrency } from "@/lib/constants"

interface CashFloatSummaryProps {
  cashFloat: CashFloatData | null
  isReadOnly: boolean
  onRecordOpening: () => void
  onRecordClosing: () => void
}

interface CashFloatData {
  id: string
  shiftName: string
  selectedFloatAmount: number
  openingTotal?: number
  closingTotal?: number
  variance?: number
  openingFloatVerified?: boolean
  closingFloatVerified?: boolean
  openingFloatNotes?: string
  closingFloatNotes?: string
}

export function CashFloatSummary({
  cashFloat,
  isReadOnly,
  onRecordOpening,
  onRecordClosing,
}: CashFloatSummaryProps) {
  if (!cashFloat) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Cash Float
          </CardTitle>
          <CardDescription>No cash float recorded for this entry</CardDescription>
        </CardHeader>
        <CardContent>
          {!isReadOnly && (
            <Button onClick={onRecordOpening} className="w-full">
              Record Opening Float
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  const hasOpening = cashFloat.openingTotal !== undefined && cashFloat.openingTotal > 0
  const hasClosing = cashFloat.closingTotal !== undefined && cashFloat.closingTotal > 0
  const variance = cashFloat.variance || 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Cash Float
          <Badge variant="outline">{cashFloat.shiftName}</Badge>
        </CardTitle>
        <CardDescription>
          Float Amount: {cashFloat.selectedFloatAmount ? fmtCurrency(cashFloat.selectedFloatAmount) : '0.00'} MVR
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Opening Float */}
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <div className="flex items-center gap-3">
            {hasOpening ? (
              cashFloat.openingFloatVerified ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-amber-600" />
              )
            ) : (
              <XCircle className="h-5 w-5 text-muted-foreground" />
            )}
            <div>
              <p className="font-medium">Opening Float</p>
              <p className="text-sm text-muted-foreground">
                {hasOpening ? `${cashFloat.openingTotal ? fmtCurrency(cashFloat.openingTotal) : '0.00'} MVR` : "Not recorded"}
              </p>
            </div>
          </div>
          {!isReadOnly && !hasOpening && (
            <Button size="sm" variant="outline" onClick={onRecordOpening}>
              Record
            </Button>
          )}
          {cashFloat.openingFloatVerified && (
            <Badge variant="outline" className="text-emerald-600">
              Verified
            </Badge>
          )}
        </div>

        {/* Closing Float */}
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <div className="flex items-center gap-3">
            {hasClosing ? (
              cashFloat.closingFloatVerified ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-amber-600" />
              )
            ) : (
              <XCircle className="h-5 w-5 text-muted-foreground" />
            )}
            <div>
              <p className="font-medium">Closing Float</p>
              <p className="text-sm text-muted-foreground">
                {hasClosing ? `${cashFloat.closingTotal ? fmtCurrency(cashFloat.closingTotal) : '0.00'} MVR` : "Not recorded"}
              </p>
            </div>
          </div>
          {!isReadOnly && hasOpening && !hasClosing && (
            <Button size="sm" variant="outline" onClick={onRecordClosing}>
              Record
            </Button>
          )}
          {cashFloat.closingFloatVerified && (
            <Badge variant="outline" className="text-emerald-600">
              Verified
            </Badge>
          )}
        </div>

        {/* Variance */}
        {hasClosing && (
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <span className="font-medium">Variance</span>
            <span
              className={`font-bold ${
                variance === 0
                  ? "text-emerald-600"
                  : Math.abs(variance) <= 50
                  ? "text-amber-600"
                  : "text-red-600"
              }`}
            >
              {variance >= 0 ? "+" : ""}
              {fmtCurrency(variance)} MVR
            </span>
          </div>
        )}

        {/* Notes */}
        {(cashFloat.openingFloatNotes || cashFloat.closingFloatNotes) && (
          <div className="text-sm text-muted-foreground">
            {cashFloat.openingFloatNotes && (
              <p>Opening notes: {cashFloat.openingFloatNotes}</p>
            )}
            {cashFloat.closingFloatNotes && (
              <p>Closing notes: {cashFloat.closingFloatNotes}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
