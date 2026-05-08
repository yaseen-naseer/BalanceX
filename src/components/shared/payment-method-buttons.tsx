"use client"

import { Button } from "@/components/ui/button"
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABEL,
  type PaymentMethod,
} from "@/hooks/use-split-payment"

export interface PaymentMethodButtonsProps {
  value: PaymentMethod
  onChange: (method: PaymentMethod) => void
  /** Methods to grey out (e.g. already-used in another split row). */
  disabledMethods?: readonly PaymentMethod[]
  size?: "sm" | "default"
  className?: string
}

/**
 * Three-button row for picking Cash / Transfer / Cheque.
 * Single source of truth for the wallet + settlement payment-method UI.
 */
export function PaymentMethodButtons({
  value,
  onChange,
  disabledMethods = [],
  size = "default",
  className = "flex gap-2",
}: PaymentMethodButtonsProps) {
  const sizeClass = size === "sm" ? "" : ""
  const buttonProps = size === "sm" ? { size: "sm" as const } : {}
  return (
    <div className={className}>
      {PAYMENT_METHODS.map((m) => (
        <Button
          key={m}
          type="button"
          variant={value === m ? "default" : "outline"}
          onClick={() => onChange(m)}
          disabled={disabledMethods.includes(m)}
          className={`flex-1 ${sizeClass}`}
          {...buttonProps}
        >
          {PAYMENT_METHOD_LABEL[m]}
        </Button>
      ))}
    </div>
  )
}
