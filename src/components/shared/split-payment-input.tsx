"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Trash2 } from "lucide-react"
import type { PaymentSplit } from "@/hooks/use-split-payment"
import { PaymentMethodButtons } from "./payment-method-buttons"

export interface SplitPaymentInputProps {
  splits: PaymentSplit[]
  onAdd: () => void
  onRemove: (index: number) => void
  onUpdate: (index: number, patch: Partial<PaymentSplit>) => void
  maxSplits?: number
  /** Footer slot — caller renders total / remaining / validation hint. */
  footer?: React.ReactNode
}

/**
 * Renders the split-payment list (one card per split with method buttons + amount).
 * State lives in `useSplitPayment()`.
 */
export function SplitPaymentInput({
  splits,
  onAdd,
  onRemove,
  onUpdate,
  maxSplits = 3,
  footer,
}: SplitPaymentInputProps) {
  return (
    <div className="space-y-3">
      {splits.map((split, index) => (
        <div key={index} className="rounded-lg border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Split {index + 1}</span>
            {splits.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => onRemove(index)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          <PaymentMethodButtons
            value={split.method}
            onChange={(m) => onUpdate(index, { method: m })}
            disabledMethods={splits.filter((_, i) => i !== index).map((s) => s.method)}
            size="sm"
          />

          <Input
            type="number"
            step="0.01"
            value={split.amount}
            onChange={(e) => onUpdate(index, { amount: e.target.value })}
            placeholder="Amount"
            className="font-mono"
          />
        </div>
      ))}
      {splits.length < maxSplits && (
        <Button type="button" variant="outline" size="sm" className="w-full" onClick={onAdd}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add Split
        </Button>
      )}
      {footer}
    </div>
  )
}
